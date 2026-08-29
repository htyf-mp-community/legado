jest.mock('@dr.pogodin/react-native-fs', () => ({
  downloadFile: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-native-quick-base64', () => ({ fromByteArray: jest.fn() }));
jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }) }));
import { downloadFile, mkdir, unlink } from '@dr.pogodin/react-native-fs';
import {
  discoverBookExportImages,
  downloadBookExportImages,
} from '../src/core/bookExportImages';
import type { Book, BookSource } from '../src/types';

const book: Book = {
  id: 'b',
  name: 'Book',
  author: 'Author',
  intro: '',
  chapterTitle: 'One',
  content: '',
  progress: 0,
  updatedAt: 1,
  bookUrl: 'https://book.example/detail',
  origin: 'https://source.example/',
  chapters: [
    {
      id: 'c1',
      title: 'One/1',
      url: 'https://book.example/chapter/1',
      content:
        '<p><img src="../a.jpg"></p>\nhttps://cdn.example/b.png\n<img src="../a.jpg">',
    },
  ],
};
const source = {
  bookSourceUrl: 'https://source.example/',
  bookSourceName: 'Source',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
  header: '{"Referer":"https://source.example/"}',
} as BookSource;

test('discovers absolute, relative and standalone chapter images without duplicates', () => {
  expect(discoverBookExportImages(book)).toEqual([
    { chapterTitle: 'One/1', line: 0, url: 'https://book.example/a.jpg' },
    { chapterTitle: 'One/1', line: 1, url: 'https://cdn.example/b.png' },
  ]);
});

test('downloads with source headers and isolates individual failures', async () => {
  (downloadFile as jest.Mock)
    .mockReturnValueOnce({ promise: Promise.resolve({ statusCode: 200 }) })
    .mockReturnValueOnce({ promise: Promise.resolve({ statusCode: 403 }) });
  const result = await downloadBookExportImages(book, '/export', source, 1);
  expect(result).toMatchObject({
    total: 2,
    completed: 2,
    failures: [{ url: 'https://cdn.example/b.png', error: 'HTTP 403' }],
  });
  expect(mkdir).toHaveBeenCalledWith('/export/Book_Author/images/One_1');
  expect(downloadFile).toHaveBeenCalledWith(
    expect.objectContaining({
      headers: { Referer: 'https://source.example/' },
    }),
  );
  expect(unlink).toHaveBeenCalledTimes(1);
});
