jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));

import { parseExploreBooks, parseSearchBooks } from '../src/core/webBook';
import type { BookSource } from '../src/types';

const source: BookSource = {
  bookSourceUrl: 'https://example.com',
  bookSourceName: '列表规则',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
  ruleSearch: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' },
};
const body = { items: [
  { name: '甲', url: '/a' },
  { name: '乙', url: '/b' },
  { name: '甲重复', url: '/a' },
  { name: '丙', url: '/c' },
] };
const base = 'https://example.com/list';
const names = (books: ReturnType<typeof parseSearchBooks>) => books.map(book => book.name);

test('search consumes source list order prefixes and reverses after URL deduplication', () => {
  const withRule = (bookList: string) => ({ ...source, ruleSearch: { ...source.ruleSearch, bookList } });
  expect(names(parseSearchBooks(withRule('+$.items[*]'), body, base))).toEqual(['甲', '乙', '丙']);
  expect(names(parseSearchBooks(withRule('-$.items[*]'), body, base))).toEqual(['丙', '乙', '甲']);
  expect(names(parseSearchBooks(withRule('-+$.items[*]'), body, base))).toEqual(['丙', '乙', '甲']);
});

test('explore uses the complete search rule when its list rule is blank', () => {
  const withExplore = { ...source, ruleExplore: { bookList: '  ', name: '$.wrong' } };
  expect(names(parseExploreBooks(withExplore, body, base))).toEqual(['甲', '乙', '丙']);
  expect(names(parseExploreBooks({ ...source, ruleExplore: undefined }, body, base))).toEqual(['甲', '乙', '丙']);
});

test('explore honors its own nonblank rule and its list order', () => {
  const withExplore = { ...source, ruleExplore: { bookList: '-$.items[*]', name: '$.name', bookUrl: '$.url' } };
  expect(names(parseExploreBooks(withExplore, body, base))).toEqual(['丙', '乙', '甲']);
});

test('accepts the prefixed CSS list selector present in the supplied collection', () => {
  const imported = { ...source, ruleSearch: {
    bookList: '+@css:.bookbox', name: '.bookname@text', bookUrl: 'a@href',
  } };
  const html = '<div class="bookbox"><a href="/a" class="bookname">甲</a></div>';
  expect(names(parseSearchBooks(imported, html, base))).toEqual(['甲']);
});

test('finds names when a selected book-list element itself has the requested class', () => {
  const imported = { ...source, ruleSearch: {
    bookList: 'class.container@tag.li!0',
    name: 'class.menu-item@tag.a.0@text',
    bookUrl: 'tag.a@href',
  }, ruleExplore: {} };
  const html = '<div class="container"><ul><li class="menu-item"><a href="/first">首项</a></li><li class="menu-item"><a href="/second">第二项</a></li></ul></div>';
  expect(names(parseExploreBooks(imported, html, base))).toEqual(['第二项']);
});
