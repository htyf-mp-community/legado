import {
  CachesDirectoryPath,
  mkdir,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import { saveDocuments } from '@react-native-documents/picker';
import iconv from 'iconv-lite';
import { fromByteArray } from 'react-native-quick-base64';
import { getUnzip } from 'react-native-nitro-unzip';
import {
  DEFAULT_BOOK_EXPORT_PREFERENCES,
  exportFileBaseName,
  type BookExportPreferences,
} from '../data/exportPreferences';
import { applyReplaceRules, loadReplaceRules } from '../data/replaceRules';
import { loadWebDavConfig } from '../data/remoteBackup';
import { loadSources } from '../data/sources';
import type { Book } from '../types';
import {
  renderBookEpub,
  renderBookPdf,
  renderBookTxt,
  safeExportName,
  type BookExportFormat,
} from './bookExport';
import { uploadRemoteBookFile } from './remoteBooks';
import { downloadBookExportImages } from './bookExportImages';

export type BulkBookExportFormat = Exclude<BookExportFormat, 'json'>;
export type BulkBookExportEntry = { book: Book; fileName: string };

export function parseChapterScope(scope: string, total: number) {
  const value = scope.replace(/\s+/g, '');
  if (!value) return Array.from({ length: total }, (_, index) => index);
  if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(value))
    throw new Error('INVALID_CHAPTER_SCOPE');
  const selected = new Set<number>();
  for (const part of value.split(',')) {
    const [startValue, endValue = startValue] = part.split('-'),
      start = Number(startValue),
      end = Number(endValue);
    if (start < 1 || end < start) throw new Error('INVALID_CHAPTER_SCOPE');
    for (let chapter = start; chapter <= Math.min(end, total); chapter += 1)
      selected.add(chapter - 1);
  }
  if (!selected.size) throw new Error('EMPTY_CHAPTER_SCOPE');
  return [...selected].sort((a, b) => a - b);
}

export function bulkBookExportEntries(
  books: Book[],
  selectedIds: ReadonlySet<string>,
  format: BulkBookExportFormat,
  preferences: BookExportPreferences = DEFAULT_BOOK_EXPORT_PREFERENCES,
) {
  const used = new Map<string, number>();
  return books
    .filter(book => selectedIds.has(book.id))
    .flatMap(book => {
      const chapters = book.chapters?.length
          ? book.chapters
          : [
              {
                id: `${book.id}-legacy`,
                title: book.chapterTitle,
                content: book.content,
              },
            ],
        selectedChapters =
          format === 'epub'
            ? parseChapterScope(
                preferences.epubChapterScope,
                chapters.length,
              ).map(index => chapters[index])
            : chapters,
        size =
          format === 'epub' && preferences.epubChaptersPerFile > 0
            ? preferences.epubChaptersPerFile
            : selectedChapters.length,
        chunks = Array.from(
          { length: Math.ceil(selectedChapters.length / Math.max(1, size)) },
          (_, index) =>
            selectedChapters.slice(index * size, (index + 1) * size),
        );
      const base = safeExportName(
          exportFileBaseName(preferences.fileNamePattern, book),
        ),
        count = used.get(base) ?? 0;
      used.set(base, count + 1);
      const uniqueBase = `${base}${count ? `_${count + 1}` : ''}`;
      return chunks.map((chapterChunk, index) => ({
        book: {
          ...book,
          chapterTitle: chapterChunk[0]?.title ?? book.chapterTitle,
          content: chapterChunk[0]?.content ?? book.content,
          chapters: chapterChunk,
        },
        fileName: `${uniqueBase}${chunks.length > 1 ? `_${index + 1}` : ''}.${format}`,
      }));
    });
}

export async function saveBulkBookExport(
  books: Book[],
  selectedIds: ReadonlySet<string>,
  format: BulkBookExportFormat,
  onProgress?: (completed: number, total: number, bookName: string) => void,
  preferences: BookExportPreferences = DEFAULT_BOOK_EXPORT_PREFERENCES,
) {
  const entries = bulkBookExportEntries(
    books,
    selectedIds,
    format,
    preferences,
  );
  if (!entries.length) throw new Error('no books selected');
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    directory = `${CachesDirectoryPath}/legado-bulk-export-${token}`,
    archive = `${CachesDirectoryPath}/legado-books-${token}.zip`;
  await mkdir(directory);
  try {
    const rules = preferences.useReplace ? loadReplaceRules() : [],
      sources =
        preferences.exportPictureFile && format === 'txt'
          ? await loadSources()
          : [],
      prepare = (book: Book): Book => {
        if (!rules.length) return book;
        const context = { name: book.name, origin: book.origin ?? '' },
          replace = (value: string, target: 'title' | 'content') =>
            applyReplaceRules(value, rules, target, context);
        return {
          ...book,
          chapterTitle: replace(book.chapterTitle, 'title'),
          content: replace(book.content, 'content'),
          chapters: book.chapters?.map(chapter => ({
            ...chapter,
            title: replace(chapter.title, 'title'),
            content: replace(chapter.content, 'content'),
          })),
        };
      };
    let completed = 0,
      imageFailures = 0;
    const webDav = preferences.exportToWebDav ? loadWebDavConfig() : undefined;
    const write = async (entry: BulkBookExportEntry) => {
      const book = prepare(entry.book),
        path = `${directory}/${entry.fileName}`;
      if (format === 'txt') {
        await writeFile(
          path,
          fromByteArray(
            iconv.encode(renderBookTxt(book, preferences), preferences.charset),
          ),
          'base64',
        );
      } else {
        await writeFile(
          path,
          fromByteArray(
            format === 'epub'
              ? renderBookEpub(book, preferences)
              : renderBookPdf(book, preferences),
          ),
          'base64',
        );
      }
      if (format === 'txt' && preferences.exportPictureFile) {
        const source = sources.find(
            item => item.bookSourceUrl === entry.book.origin,
          ),
          images = await downloadBookExportImages(
            entry.book,
            directory,
            source,
            preferences.parallel ? 3 : 1,
          );
        imageFailures += images.failures.length;
      }
      if (webDav)
        await uploadRemoteBookFile(
          webDav,
          path,
          entry.fileName,
          format === 'txt'
            ? `text/plain; charset=${preferences.charset}`
            : format === 'epub'
              ? 'application/epub+zip'
              : 'application/pdf',
        );
      completed += 1;
      onProgress?.(completed, entries.length, entry.book.name);
    };
    if (preferences.parallel) await Promise.all(entries.map(write));
    else for (const entry of entries) await write(entry);
    await getUnzip().zip(directory, archive).await();
    const result = await saveDocuments({
      sourceUris: [`file://${archive}`],
      mimeType: 'application/zip',
      fileName: `legado-books-${format}.zip`,
      copy: true,
    });
    if (result[0].error) throw new Error(result[0].error);
    return { ...result[0], imageFailures };
  } finally {
    await unlink(directory).catch(() => undefined);
    await unlink(archive).catch(() => undefined);
  }
}
