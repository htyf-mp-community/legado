import type { Book } from '../types';
import { readableChapterIndex } from '../core/readerToc';
import { appStorage } from './storage';
const KEY = 'library.v1';
export const starterBooks: Book[] = [
  {
    id: 'welcome',
    name: '欢迎使用阅读',
    author: '阅读',
    intro:
      '这是迁移版书架中的示例书籍。导入本地书籍或搜索书源后，它会被你的书籍替换。',
    chapterTitle: '第一章 开始阅读',
    content:
      '阅读是一款自由、开源的阅读工具。\n\nHTYF 迁移版正在保留原项目的书架、搜索、阅读进度与阅读器体验。轻触屏幕可显示或隐藏阅读控制栏。',
    chapters: [
      {
        id: 'welcome-1',
        title: '第一章 开始阅读',
        content:
          '阅读是一款自由、开源的阅读工具。\n\nHTYF 迁移版正在保留原项目的书架、搜索、阅读进度与阅读器体验。轻触屏幕可显示或隐藏阅读控制栏。',
      },
    ],
    currentChapterIndex: 0,
    progress: 0,
    updatedAt: Date.now(),
  },
];
export function normalizeBook(book: Book): Book {
  const chapters = book.chapters?.length
    ? book.chapters
    : [
        {
          id: `${book.id}-legacy`,
          title: book.chapterTitle,
          content: book.content,
        },
      ];
  const index = readableChapterIndex(chapters, book.currentChapterIndex ?? 0);
  return {
    ...book,
    chapters,
    currentChapterIndex: index,
    chapterTitle: chapters[index].title,
    content: chapters[index].content,
  };
}
export async function loadLibrary(): Promise<Book[]> {
  const value = appStorage.getString(KEY);
  if (!value) return starterBooks;
  try {
    const books = JSON.parse(value) as Book[];
    return books.map(normalizeBook);
  } catch {
    return starterBooks;
  }
}
export async function saveLibrary(books: Book[]) {
  appStorage.set(KEY, JSON.stringify(books));
}
