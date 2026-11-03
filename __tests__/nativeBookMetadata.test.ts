jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn() },
}));
jest.mock('../src/core/sourceRequest', () => ({
  buildSourcePageRequest: jest.fn(),
  executeSourceRequest: async () => ({
    url: 'https://source.test/book',
    data: {
      name: '骆驼祥子 作者：老舍',
      author: '作者：老舍 著',
      tags: ['小说', '经典'],
      words: '12500',
    },
  }),
}));
import { loadBookInfo, parseSearchBooks } from '../src/core/webBook';
import type { BookSource, SearchBook } from '../src/types';
const source: BookSource = {
  bookSourceUrl: 'https://source.test',
  bookSourceName: 'fixture',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
  ruleSearch: {
    bookList: '$.items[*]',
    name: '$.name',
    author: '$.author',
    bookUrl: '$.url',
    kind: '$.tags[*]',
    wordCount: '$.words',
  },
  ruleBookInfo: {
    name: '$.name',
    author: '$.author',
    kind: '$.tags[*]',
    wordCount: '$.words',
  },
};
const book: SearchBook = {
  origin: source.bookSourceUrl,
  originName: 'fixture',
  bookUrl: 'https://source.test/book',
  name: '',
  author: '',
};
test('search metadata follows native title, author, category and word count formatting', () => {
  const books = parseSearchBooks(
    source,
    {
      items: [
        {
          name: '骆驼祥子 作者：老舍',
          author: '作者：老舍 著',
          url: '/book',
          tags: ['小说', '经典'],
          words: '12500',
        },
      ],
    },
    'https://source.test',
  );
  expect(books).toHaveLength(1);
  expect(books[0]).toMatchObject({
    name: '骆驼祥子',
    author: '老舍',
    kind: '小说,经典',
    wordCount: '1.2万字',
  });
});
test('book details use the same native metadata formatting', async () => {
  expect(await loadBookInfo(source, book)).toMatchObject({
    name: '骆驼祥子',
    author: '老舍',
    kind: '小说,经典',
    wordCount: '1.2万字',
  });
});

import native from './fixtures/nativeBookMetadata.json';
import {
  formatNativeBookName,
  formatNativeBookAuthor,
  formatNativeWordCount,
} from '../src/core/nativeBookMetadata';
test('metadata formatting matches the JVM native-pattern oracle across finite boundary inputs', () => {
  for (const [input, expected] of native.name)
    expect(formatNativeBookName(input!)).toBe(expected);
  for (const [input, expected] of native.author)
    expect(formatNativeBookAuthor(input!)).toBe(expected);
  for (const [input, expected] of native.wordCount)
    expect(formatNativeWordCount(input!)).toBe(expected ?? undefined);
});

test('long numeric input preserves native Int parsing without unbounded integer conversion', () => {
  expect(formatNativeWordCount('0'.repeat(10000) + '1')).toBe('1字');
  expect(formatNativeWordCount('9'.repeat(10000))).toBeUndefined();
});
