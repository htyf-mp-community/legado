import { downloadFile, mkdir, unlink } from '@dr.pogodin/react-native-fs';
import type { Book, BookSource } from '../types';
import { safeExportName } from './bookExport';
import { buildSourceRequest } from './sourceRequest';

export type ExportImage = { chapterTitle: string; line: number; url: string };

const absolute = (value: string, base?: string) => {
  try {
    return new URL(value, base || undefined).toString();
  } catch {
    return '';
  }
};
const extension = (url: string) =>
  url.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i)?.[1]?.toLowerCase() ?? 'jpg';
const hash = (value: string) => {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return (output >>> 0).toString(36);
};

export function discoverBookExportImages(book: Book) {
  const chapters = book.chapters?.length
      ? book.chapters
      : [
          {
            id: `${book.id}-legacy`,
            title: book.chapterTitle,
            content: book.content,
            url: book.bookUrl,
          },
        ],
    images: ExportImage[] = [],
    seen = new Set<string>();
  for (const chapter of chapters) {
    const base = chapter.url || book.bookUrl || book.origin;
    chapter.content.split(/\r?\n/).forEach((line, lineIndex) => {
      const values = [
        ...line.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi),
      ].map(match => match[1]);
      if (/^\s*(?:https?:)?\/\/\S+\s*$/i.test(line)) values.push(line.trim());
      for (const value of values) {
        const url = absolute(value, base);
        if (!/^https?:\/\//i.test(url)) continue;
        const key = `${chapter.id}\n${url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        images.push({ chapterTitle: chapter.title, line: lineIndex, url });
      }
    });
  }
  return images;
}

export async function downloadBookExportImages(
  book: Book,
  exportRoot: string,
  source?: BookSource,
  concurrency = 3,
) {
  const images = discoverBookExportImages(book),
    failures: Array<{ url: string; error: string }> = [];
  let cursor = 0,
    completed = 0;
  const worker = async () => {
    while (cursor < images.length) {
      const image = images[cursor++],
        directory = `${exportRoot}/${safeExportName(`${book.name}_${book.author}`)}/images/${safeExportName(image.chapterTitle)}`,
        path = `${directory}/${image.line}-${hash(image.url)}.${extension(image.url)}`;
      try {
        await mkdir(directory);
        const headers = source
            ? buildSourceRequest(source, image.url).headers
            : {},
          result = await downloadFile({
            fromUrl: image.url,
            toFile: path,
            headers,
            connectionTimeout: 15000,
            readTimeout: 30000,
            cacheable: true,
          }).promise;
        if (result.statusCode < 200 || result.statusCode >= 300)
          throw new Error(`HTTP ${result.statusCode}`);
      } catch (error) {
        await unlink(path).catch(() => undefined);
        failures.push({
          url: image.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      completed += 1;
    }
  };
  await Promise.all(
    Array.from(
      {
        length: Math.min(Math.max(1, concurrency), Math.max(1, images.length)),
      },
      worker,
    ),
  );
  return { total: images.length, completed, failures };
}
