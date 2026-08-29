jest.mock('../src/data/storage', () => {
  const values = new Map<string, string>();
  return {
    appStorage: {
      getString: (key: string) => values.get(key),
      set: (key: string, value: unknown) => values.set(key, String(value)),
    },
  };
});

import {
  filterSearchResults,
  groupSearchResults,
  loadBookSearchPreferences,
  rememberSearchKeyword,
  removeSearchKeyword,
  saveBookSearchPreferences,
  searchBookIndicator,
  searchLocalBooks,
  selectSearchSources,
} from '../src/data/bookSearch';
import type { Book, BookSource, SearchBook } from '../src/types';

const source = (name: string, group: string): BookSource => ({
  bookSourceName: name,
  bookSourceUrl: `https://${name}`,
  bookSourceGroup: group,
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
  searchUrl: '/search',
});
const book = (name: string, author: string, kind = ''): SearchBook => ({
  name,
  author,
  kind,
  bookUrl: name,
  origin: '',
  originName: '',
  sourceType: 0,
});

test('persists search scope, precision, filters and bounded history', () => {
  let value = saveBookSearchPreferences({
    precision: true,
    showReadRecord: true,
    filter: '广告',
    groups: ['正版'],
    history: [],
  });
  value = rememberSearchKeyword(value, '三体', 10);
  value = rememberSearchKeyword(value, '三体', 20);
  saveBookSearchPreferences(value);
  expect(loadBookSearchPreferences()).toMatchObject({
    precision: true,
    filter: '广告',
    groups: ['正版'],
    history: [{ word: '三体', usage: 2, lastUseTime: 20 }],
  });
  expect(removeSearchKeyword(value, '三体').history).toEqual([]);
});

test('selects enabled sources by any comma-separated group', () => {
  expect(
    selectSearchSources(
      [
        source('a', '正版,发现'),
        source('b', '自用'),
        { ...source('c', '正版'), enabled: false },
      ],
      ['正版'],
    ).map(item => item.bookSourceName),
  ).toEqual(['a']);
  expect(
    selectSearchSources(
      [{ ...source('disabled', '自用'), enabled: false }],
      [],
      'https://disabled',
    ).map(item => item.bookSourceName),
  ).toEqual(['disabled']);
});

test('applies Android precision and newline exclusion filters', () => {
  const books = [
    book('三体', '刘慈欣', '科幻'),
    book('三体广告版', '其他'),
    book('球状闪电', '刘慈欣'),
  ];
  expect(filterSearchResults(books, '三体', true, '广告\n盗版')).toEqual([
    books[0],
  ]);
});

test('finds local suggestions and applies bookshelf/read-record indicators', () => {
  const local = {
    id: '1',
    name: '三体',
    author: '刘慈欣',
    intro: '',
    chapterTitle: '',
    content: '',
    progress: 0,
    updatedAt: 0,
    bookUrl: 'https://book/1',
  } as Book;
  expect(searchLocalBooks([local], '刘慈欣')).toEqual([local]);
  expect(
    searchBookIndicator(
      { ...book('三体', '刘慈欣'), bookUrl: 'https://book/1' },
      [local],
      [],
      true,
    ),
  ).toBe('bookshelf');
  expect(
    searchBookIndicator(
      book('球状闪电', '刘慈欣'),
      [],
      [
        {
          bookId: 'old',
          bookName: '球状闪电',
          author: '',
          readTime: 1,
          lastRead: 1,
        },
      ],
      true,
    ),
  ).toBe('read');
  expect(
    searchBookIndicator(
      book('球状闪电', '刘慈欣'),
      [],
      [
        {
          bookId: 'old',
          bookName: '球状闪电',
          author: '',
          readTime: 1,
          lastRead: 1,
        },
      ],
      false,
    ),
  ).toBe('none');
});

test('merges same-name/author books across sources and ranks Android match buckets', () => {
  const exactA = {
    ...book('三体', '刘慈欣'),
    origin: 'a',
    originName: '源A',
    bookUrl: 'a',
  };
  const exactB = {
    ...book('三体', '刘慈欣'),
    origin: 'b',
    originName: '源B',
    bookUrl: 'b',
  };
  const tag = { ...book('别的书', '作者', '三体'), origin: 'c', bookUrl: 'c' };
  const contains = { ...book('三体续集', '作者'), origin: 'd', bookUrl: 'd' };
  const grouped = groupSearchResults([contains, exactA, tag, exactB], '三体');
  expect(grouped.map(item => item.book.name)).toEqual([
    '三体',
    '别的书',
    '三体续集',
  ]);
  expect(grouped[0].origins.map(item => item.origin)).toEqual(['a', 'b']);
});
