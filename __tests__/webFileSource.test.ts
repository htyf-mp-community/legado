jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn() },
}));
jest.mock('../src/core/sourceRequest', () => ({
  buildSourcePageRequest: jest.fn(),
  executeSourceRequest: async () => ({
    url: 'https://source.test/catalog/book',
    data: { files: ['/files/one.txt', '/files/two.epub', '/files/one.txt'] },
  }),
}));
import { loadBookInfo } from '../src/core/webBook';
import type { BookSource, SearchBook } from '../src/types';

const source: BookSource = {
  bookSourceUrl: 'https://source.test',
  bookSourceName: '文件源',
  bookSourceType: 3,
  customOrder: 0,
  enabled: true,
  enabledExplore: false,
  ruleBookInfo: { downloadUrls: '$.files[*]' },
};
const book: SearchBook = {
  bookUrl: 'https://source.test/catalog/book',
  origin: source.bookSourceUrl,
  originName: source.bookSourceName,
  name: '书',
  author: '作者',
  sourceType: 3,
};

test('file source resolves and deduplicates download links against the final detail URL', async () => {
  expect(await loadBookInfo(source, book)).toMatchObject({
    downloadUrls: [
      'https://source.test/files/one.txt',
      'https://source.test/files/two.epub',
    ],
  });
});

test('file source reports an empty download rule instead of inventing a chapter URL', async () => {
  await expect(
    loadBookInfo({ ...source, ruleBookInfo: {} }, book),
  ).rejects.toThrow('下载链接为空');
});
