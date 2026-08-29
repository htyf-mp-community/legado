jest.mock('@react-native-documents/picker', () => ({
  saveDocuments: jest.fn(),
}));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));

import { saveDocuments } from '@react-native-documents/picker';
import { unlink, writeFile } from '@dr.pogodin/react-native-fs';
import {
  androidBookmarkExport,
  renderBookmarkMarkdown,
  saveBookmarkExport,
} from '../src/core/annotationExport';
import type { Book, Bookmark } from '../src/types';

const books = [
  {
    id: 'book-1',
    name: '测试书',
    author: '作者甲',
    chapters: [
      { id: 'chapter-1', title: '第一章' },
      { id: 'chapter-2', title: '第二章' },
    ],
  },
] as Book[];
const bookmarks: Bookmark[] = [
  {
    id: 'bookmark-1',
    bookId: 'book-1',
    chapterId: 'chapter-2',
    chapterTitle: '第二章',
    position: 18,
    excerpt: '书签摘录',
    createdAt: 100,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  (unlink as jest.Mock).mockResolvedValue(undefined);
  (writeFile as jest.Mock).mockResolvedValue(undefined);
  (saveDocuments as jest.Mock).mockResolvedValue([
    { uri: 'content://bookmark', error: null },
  ]);
});

test('renders Android-compatible bookmark records and lossless HTYF fields', () => {
  expect(androidBookmarkExport(bookmarks, books)[0]).toMatchObject({
    time: 100,
    bookName: '测试书',
    bookAuthor: '作者甲',
    chapterIndex: 1,
    chapterName: '第二章',
    chapterPos: 18,
    bookText: '书签摘录',
    htyf: bookmarks[0],
  });
});

test('renders grouped Markdown and saves through the system document picker', async () => {
  expect(renderBookmarkMarkdown(bookmarks, books)).toContain(
    '## 测试书 作者甲\n\n#### 第二章',
  );
  await expect(
    saveBookmarkExport(bookmarks, books, 'markdown', Date.UTC(2026, 7, 29)),
  ).resolves.toMatchObject({ uri: 'content://bookmark' });
  expect(writeFile).toHaveBeenCalledWith(
    expect.stringMatching(/bookmark-260829\d{6}\.md$/),
    expect.stringContaining('###### 原文'),
    'utf8',
  );
  expect(saveDocuments).toHaveBeenCalledWith(
    expect.objectContaining({ mimeType: 'text/markdown', copy: true }),
  );
  expect(unlink).toHaveBeenCalled();
});

test('rejects empty exports and cleans temporary files after picker failures', async () => {
  await expect(saveBookmarkExport([], books, 'json')).rejects.toThrow(
    '没有可导出的书签',
  );
  (saveDocuments as jest.Mock).mockResolvedValue([
    { uri: '', error: '保存失败' },
  ]);
  await expect(saveBookmarkExport(bookmarks, books, 'json')).rejects.toThrow(
    '保存失败',
  );
  expect(unlink).toHaveBeenCalled();
});
