jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));

import {
  inspectSourceCompatibility,
  summarizeSourceCompatibility,
} from '../src/core/sourceCompatibility';
import type { BookSource } from '../src/types';

const source = (overrides: Partial<BookSource> = {}): BookSource => ({
  bookSourceName: 'Source',
  bookSourceUrl: 'https://example.com',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
  searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '.book', name: '.name@text' },
  ruleContent: { content: '#content@html' },
  ...overrides,
});

test('keeps declarative collection entries available', () => {
  expect(inspectSourceCompatibility(source())).toEqual({
    search: 'supported',
    content: 'supported',
    issues: [],
  });
});

test('reports arbitrary Legado JavaScript search and content rules', () => {
  const result = inspectSourceCompatibility(
    source({
      searchUrl: '@js:java.ajax(baseUrl);result=url',
      ruleContent: { content: '<js>java.ajax(url)</js>' },
    }),
  );
  expect(result).toEqual({
    search: 'unsupported',
    content: 'unsupported',
    issues: ['search-js', 'content-js'],
  });
});

test('summarizes mixed source collections without rejecting compatible entries', () => {
  expect(
    summarizeSourceCompatibility([
      source(),
      source({
        bookSourceUrl: 'https://blocked.example',
        searchUrl: '@js:java.ajax(baseUrl);result=url',
      }),
    ]),
  ).toEqual({ total: 2, searchable: 1, searchBlocked: 1, contentBlocked: 0 });
});
