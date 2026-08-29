import iconv from 'iconv-lite';
import { toByteArray } from 'react-native-quick-base64';

export const TXT_CHARSETS = [
  'UTF-8',
  'GB18030',
  'GBK',
  'BIG5',
  'UTF-16LE',
  'UTF-16BE',
] as const;

export function decodeTxtBase64(base64: string, charset = 'UTF-8') {
  if (!iconv.encodingExists(charset)) throw new Error('UNSUPPORTED_CHARSET');
  return iconv.decode(toByteArray(base64), charset).replace(/^\uFEFF/, '');
}

/** Deterministic variant of Legado's paragraph repair for broken TXT lines. */
export function reSegmentText(content: string, chapterTitle = '') {
  const lines = content
    .replace(/&quot;/gi, '“')
    .replace(/[:：]['"‘”“]+/g, '：“')
    .replace(/["”“]+\s*["”“]+/g, '”\n“')
    .split(/\r?\n/)
    .map(line => line.replace(/[\u3000\t ]+/g, '').trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    if (line === chapterTitle.trim()) continue;
    const previous = out[out.length - 1];
    if (previous && !/[。！？?!~”]$/.test(previous)) out[out.length - 1] += line;
    else out.push(line);
  }
  return out
    .join('\n')
    .replace(/([问说喊唱叫骂道着答])[。.]/g, '$1。\n')
    .replace(/”([。！？?!~])“/g, '”$1\n“')
    .replace(/”([。！？?!~])([^“”\n])/g, '”$1\n$2')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
