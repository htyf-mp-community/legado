import { appStorage } from './storage';

const KEY = 'book-export.preferences.v1';

export type ExportCharset =
  | 'UTF-8'
  | 'GB18030'
  | 'GBK'
  | 'BIG5'
  | 'UTF-16LE'
  | 'UTF-16BE';
export type BookExportPreferences = {
  useReplace: boolean;
  noChapterName: boolean;
  parallel: boolean;
  charset: ExportCharset;
  fileNamePattern: string;
  epubChapterScope: string;
  epubChaptersPerFile: number;
  exportToWebDav: boolean;
  exportPictureFile: boolean;
};

export const DEFAULT_BOOK_EXPORT_PREFERENCES: BookExportPreferences = {
  useReplace: false,
  noChapterName: false,
  parallel: false,
  charset: 'UTF-8',
  fileNamePattern: '{name}_{author}',
  epubChapterScope: '',
  epubChaptersPerFile: 0,
  exportToWebDav: false,
  exportPictureFile: false,
};

const charsets = new Set<ExportCharset>([
  'UTF-8',
  'GB18030',
  'GBK',
  'BIG5',
  'UTF-16LE',
  'UTF-16BE',
]);

export function loadBookExportPreferences(): BookExportPreferences {
  try {
    const value = JSON.parse(
      appStorage.getString(KEY) ?? '{}',
    ) as Partial<BookExportPreferences>;
    return {
      useReplace: value.useReplace === true,
      noChapterName: value.noChapterName === true,
      parallel: value.parallel === true,
      charset: charsets.has(value.charset as ExportCharset)
        ? (value.charset as ExportCharset)
        : 'UTF-8',
      fileNamePattern:
        typeof value.fileNamePattern === 'string' &&
        value.fileNamePattern.trim()
          ? value.fileNamePattern.slice(0, 120)
          : DEFAULT_BOOK_EXPORT_PREFERENCES.fileNamePattern,
      epubChapterScope:
        typeof value.epubChapterScope === 'string'
          ? value.epubChapterScope.replace(/\s+/g, '').slice(0, 500)
          : '',
      epubChaptersPerFile: Math.max(
        0,
        Math.min(10000, Math.trunc(Number(value.epubChaptersPerFile) || 0)),
      ),
      exportToWebDav: value.exportToWebDav === true,
      exportPictureFile: value.exportPictureFile === true,
    };
  } catch {
    return DEFAULT_BOOK_EXPORT_PREFERENCES;
  }
}

export function saveBookExportPreferences(value: BookExportPreferences) {
  appStorage.set(KEY, JSON.stringify(value));
  return value;
}

export function exportFileBaseName(
  pattern: string,
  book: { name: string; author?: string },
) {
  return pattern
    .replace(/\{name\}/gi, book.name)
    .replace(/\{author\}/gi, book.author || '')
    .trim();
}
