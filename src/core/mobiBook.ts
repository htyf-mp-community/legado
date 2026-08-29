import { readFile, unlink } from '@dr.pogodin/react-native-fs';
import { keepLocalCopy } from '@react-native-documents/picker';
import { toByteArray } from 'react-native-quick-base64';
import type { Book, LocalChapter } from '../types';

const u16 = (bytes: Uint8Array, offset: number) => (bytes[offset] << 8) | bytes[offset + 1];
const u32 = (bytes: Uint8Array, offset: number) => ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
const ascii = (bytes: Uint8Array, offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));

export function decompressPalmDoc(input: Uint8Array) {
  const output: number[] = [];
  for (let cursor = 0; cursor < input.length;) {
    const value = input[cursor++];
    if (value === 0 || (value >= 9 && value <= 0x7f)) output.push(value);
    else if (value >= 1 && value <= 8) { const end = Math.min(input.length, cursor + value); while (cursor < end) output.push(input[cursor++]); }
    else if (value >= 0xc0) output.push(0x20, value ^ 0x80);
    else {
      if (cursor >= input.length) throw new Error('PalmDOC 压缩数据不完整');
      const pair = (value << 8) | input[cursor++], distance = (pair >> 3) & 0x7ff, length = (pair & 7) + 3;
      if (!distance || distance > output.length) throw new Error('PalmDOC 回溯距离无效');
      for (let index = 0; index < length; index++) output.push(output[output.length - distance]);
    }
  }
  return Uint8Array.from(output);
}

function decode(bytes: Uint8Array, encoding: number) {
  if (encoding !== 65001) return Array.from(bytes, value => String.fromCharCode(value)).join('');
  let encoded = '';
  for (const value of bytes) encoded += `%${value.toString(16).padStart(2, '0')}`;
  try { return decodeURIComponent(encoded); }
  catch { throw new Error('MOBI UTF-8 正文编码无效'); }
}
const entities: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"' };
const entity = (value: string) => value.replace(/&#(x?[0-9a-f]+);|&(nbsp|amp|lt|gt|quot);/gi, (_, number: string, named: string) => number ? String.fromCodePoint(Number.parseInt(number.replace(/^x/i, ''), /^x/i.test(number) ? 16 : 10)) : entities[named.toLowerCase()]);
const plain = (html: string) => entity(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|h[1-6]|li)>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export function parseMobi(bytes: Uint8Array) {
  if (bytes.length < 100) throw new Error('MOBI 文件过短');
  const recordCount = u16(bytes, 76);
  if (!recordCount || 78 + recordCount * 8 > bytes.length) throw new Error('MOBI PalmDB 记录表无效');
  const offsets = Array.from({ length: recordCount }, (_, index) => u32(bytes, 78 + index * 8)); offsets.push(bytes.length);
  if (offsets.some((offset, index) => offset > bytes.length || (index && offset < offsets[index - 1]))) throw new Error('MOBI PalmDB 记录偏移无效');
  const first = offsets[0];
  if (first + 92 > bytes.length || ascii(bytes, first + 16, 4) !== 'MOBI') throw new Error('文件不是受支持的 MOBI/PalmDOC');
  const compression = u16(bytes, first), textLength = u32(bytes, first + 4), textRecords = u16(bytes, first + 8), encoding = u32(bytes, first + 28);
  if (![1, 2].includes(compression)) throw new Error(`暂不支持 MOBI 压缩类型 ${compression}`);
  const chunks: Uint8Array[] = [];
  for (let index = 1; index <= textRecords && index < offsets.length - 1; index++) { const record = bytes.slice(offsets[index], offsets[index + 1]); chunks.push(compression === 2 ? decompressPalmDoc(record) : record); }
  const joined = new Uint8Array(chunks.reduce((sum, item) => sum + item.length, 0)); let position = 0;
  for (const chunk of chunks) { joined.set(chunk, position); position += chunk.length; }
  const html = decode(joined.slice(0, Math.min(textLength, joined.length)), encoding), titleOffset = u32(bytes, first + 84), titleLength = u32(bytes, first + 88);
  const title = titleLength && first + titleOffset + titleLength <= offsets[1] ? decode(bytes.slice(first + titleOffset, first + titleOffset + titleLength), encoding).trim() : '';
  const sections: string[] = html.split(/<mbp:pagebreak\b[^>]*\/?\s*>/i).map(plain).filter(Boolean), chapters: LocalChapter[] = sections.map((content: string, index: number) => { const firstLine = content.split('\n').find((line: string) => line.trim())?.trim() ?? ''; return { id: `mobi-${index}`, title: firstLine && firstLine.length <= 60 ? firstLine : `第 ${index + 1} 章`, content }; });
  if (!chapters.length) throw new Error('MOBI 中没有可阅读的正文');
  return { title, chapters };
}

export async function importMobiBook(uri: string, fileName = '本地书籍.mobi'): Promise<Book> {
  const copies = await keepLocalCopy({ files: [{ uri, fileName }], destination: 'cachesDirectory' }), copy = copies[0];
  if (copy.status === 'error') throw new Error(copy.copyError);
  const archive = decodeURIComponent(copy.localUri.replace(/^file:\/\//, ''));
  try {
    const parsed = parseMobi(toByteArray(await readFile(archive, 'base64'))), first = parsed.chapters[0], id = `local-mobi:${uri}`;
    return { id, name: parsed.title || fileName.replace(/\.(?:mobi|prc|azw)$/i, ''), author: '', intro: '本地 MOBI / PalmDOC 电子书', chapterTitle: first.title, content: first.content, chapters: parsed.chapters.map(chapter => ({ ...chapter, id: `${id}#${chapter.id}` })), currentChapterIndex: 0, progress: 0, updatedAt: Date.now(), origin: 'local', originName: fileName, bookUrl: uri, sourceType: 0 };
  } finally { try { await unlink(archive); } catch {} }
}
