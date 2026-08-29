import {
  TemporaryDirectoryPath,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import { saveDocuments } from '@react-native-documents/picker';
import type { Book, Bookmark } from '../types';

export type BookmarkExportFormat = 'json' | 'markdown';

export function androidBookmarkExport(bookmarks: Bookmark[], books: Book[]) {
  const byId = new Map(books.map(book => [book.id, book]));
  return bookmarks.map(bookmark => {
    const book = byId.get(bookmark.bookId),
      chapterIndex = Math.max(
        0,
        book?.chapters?.findIndex(
          chapter => chapter.id === bookmark.chapterId,
        ) ?? 0,
      );
    return {
      time: bookmark.createdAt,
      bookName: book?.name ?? '',
      bookAuthor: book?.author ?? '',
      chapterIndex,
      chapterName: bookmark.chapterTitle,
      chapterPos: bookmark.position,
      bookText: bookmark.excerpt,
      content: bookmark.excerpt,
      htyf: bookmark,
    };
  });
}

export const renderBookmarkJson = (bookmarks: Bookmark[], books: Book[]) =>
  JSON.stringify(androidBookmarkExport(bookmarks, books), null, 2);

export function renderBookmarkMarkdown(bookmarks: Bookmark[], books: Book[]) {
  const entries = androidBookmarkExport(bookmarks, books);
  let identity = '';
  return entries
    .map(entry => {
      const nextIdentity = `${entry.bookName}\u0000${entry.bookAuthor}`,
        heading =
          identity === nextIdentity
            ? ''
            : `## ${entry.bookName || '已删除书籍'}${entry.bookAuthor ? ` ${entry.bookAuthor}` : ''}\n\n`;
      identity = nextIdentity;
      return `${heading}#### ${entry.chapterName}\n\n###### 原文\n\n${entry.bookText}\n\n###### 摘要\n\n${entry.content}\n`;
    })
    .join('\n');
}

const stamp = (now: number) => {
  const date = new Date(now),
    part = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear()).slice(-2)}${part(date.getMonth() + 1)}${part(date.getDate())}${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}`;
};

export async function saveBookmarkExport(
  bookmarks: Bookmark[],
  books: Book[],
  format: BookmarkExportFormat,
  now = Date.now(),
) {
  if (!bookmarks.length) throw new Error('没有可导出的书签');
  const extension = format === 'json' ? 'json' : 'md',
    fileName = `bookmark-${stamp(now)}.${extension}`,
    path = `${TemporaryDirectoryPath}/${fileName}`,
    content =
      format === 'json'
        ? renderBookmarkJson(bookmarks, books)
        : renderBookmarkMarkdown(bookmarks, books);
  await writeFile(path, content, 'utf8');
  try {
    const result = await saveDocuments({
      sourceUris: [`file://${path}`],
      mimeType: format === 'json' ? 'application/json' : 'text/markdown',
      fileName,
      copy: true,
    });
    if (!result[0] || result[0].error)
      throw new Error(result[0]?.error ?? '未保存书签文件');
    return result[0];
  } finally {
    await unlink(path).catch(() => undefined);
  }
}
