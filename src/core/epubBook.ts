import {
  DocumentDirectoryPath,
  readFile,
  unlink,
} from '@dr.pogodin/react-native-fs';
import { keepLocalCopy } from '@react-native-documents/picker';
import { getUnzip } from 'react-native-nitro-unzip';
import type { Book, LocalChapter } from '../types';
import { readerHtmlToText } from './readerImages';

const clean = (uri: string) =>
  decodeURIComponent(uri.replace(/^file:\/\//, ''));
const decodeXml = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
const strip = (value: string) =>
  decodeXml(
    value
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/(?:p|div|h[1-6]|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n'),
  );
const tag = (xml: string, name: string) => {
  const match = xml.match(
    new RegExp(
      `<(?:(?:\\w+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${name}>`,
      'i',
    ),
  );
  return match ? strip(match[1]) : '';
};
const attr = (source: string, name: string) =>
  source.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] ??
  '';
const safeRootPath = (value: string) => {
  const decoded = decodeXml(value).replace(/\\/g, '/');
  if (
    !decoded ||
    decoded.startsWith('/') ||
    decoded.split('/').some(part => part === '..')
  )
    throw new Error('EPUB OPF 路径越界');
  return decoded
    .split('/')
    .filter(part => part && part !== '.')
    .join('/');
};
const resolve = (base: string, relative: string) => {
  const parts = `${base}/${decodeXml(relative)}`.split('/'),
    out: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
};

export type EpubPackage = {
  title: string;
  author: string;
  description: string;
  chapters: Array<{ id: string; href: string; title?: string }>;
};

export async function cleanupEpubAssets(book: Book) {
  const root = book.epubAssetRoot?.replace(/\/+$/, ''),
    allowed = `${DocumentDirectoryPath.replace(/\/+$/, '')}/legado-epub-`;
  if (!root || !root.startsWith(allowed) || root.includes('/../')) return false;
  await unlink(root);
  return true;
}

export function parseEpubPackage(container: string, opf: string): EpubPackage {
  const root = container.match(/<rootfile\b[^>]*>/i)?.[0],
    rawPath = root ? attr(root, 'full-path') : '';
  if (!rawPath) throw new Error('EPUB container 缺少 OPF 路径');
  const opfPath = safeRootPath(rawPath),
    directory = opfPath.includes('/')
      ? opfPath.slice(0, opfPath.lastIndexOf('/'))
      : '',
    manifest = new Map<string, string>();
  for (const match of opf.matchAll(/<item\b[^>]*>/gi)) {
    const id = attr(match[0], 'id'),
      href = attr(match[0], 'href'),
      type = attr(match[0], 'media-type');
    if (
      id &&
      href &&
      (type === 'application/xhtml+xml' || /\.x?html?$/i.test(href))
    )
      manifest.set(id, resolve(directory, href));
  }
  const chapters: Array<{ id: string; href: string }> = [];
  for (const match of opf.matchAll(/<itemref\b[^>]*>/gi)) {
    const id = attr(match[0], 'idref'),
      href = manifest.get(id);
    if (href) chapters.push({ id, href });
  }
  if (!chapters.length) throw new Error('EPUB 书脊中没有可读章节');
  return {
    title: tag(opf, 'title'),
    author: tag(opf, 'creator'),
    description: tag(opf, 'description'),
    chapters,
  };
}

export async function importEpubBook(
  uri: string,
  fileName = '本地书籍.epub',
): Promise<Book> {
  const copies = await keepLocalCopy({
      files: [{ uri, fileName }],
      destination: 'cachesDirectory',
    }),
    copy = copies[0];
  if (copy.status === 'error') throw new Error(copy.copyError);
  const archive = clean(copy.localUri),
    directory = `${DocumentDirectoryPath}/legado-epub-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let imported = false;
  try {
    await getUnzip().extract(archive, directory).await();
    const container = await readFile(
        `${directory}/META-INF/container.xml`,
        'utf8',
      ),
      root = container.match(/<rootfile\b[^>]*>/i)?.[0],
      opfRelative = safeRootPath(root ? attr(root, 'full-path') : '');
    const opf = await readFile(`${directory}/${opfRelative}`, 'utf8'),
      metadata = parseEpubPackage(container, opf),
      chapters: LocalChapter[] = [];
    for (const [index, item] of metadata.chapters.entries()) {
      const html = await readFile(`${directory}/${item.href}`, 'utf8'),
        title = tag(html, 'title') || tag(html, 'h1') || `第 ${index + 1} 章`,
        content = readerHtmlToText(
          html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html,
          `file://${directory}/${item.href}`,
        );
      chapters.push({
        id: `${uri}#${item.id}`,
        title,
        content,
        url: item.href,
      });
    }
    const first = chapters[0],
      id = `local-epub:${uri}`;
    const book: Book = {
      id,
      name: metadata.title || fileName.replace(/\.epub$/i, ''),
      author: metadata.author,
      intro: metadata.description,
      chapterTitle: first.title,
      content: first.content,
      chapters,
      currentChapterIndex: 0,
      progress: 0,
      updatedAt: Date.now(),
      origin: 'local',
      originName: fileName,
      bookUrl: uri,
      sourceType: 0,
      localUri: uri,
      epubAssetRoot: directory,
    };
    imported = true;
    return book;
  } finally {
    if (!imported)
      try {
        await unlink(directory);
      } catch {}
    try {
      await unlink(archive);
    } catch {}
  }
}
