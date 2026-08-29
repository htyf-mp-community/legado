jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }) }));
import { mergeExploreBooks, selectExploreSources } from '../src/core/explore';
import type { BookSource, SearchBook } from '../src/types';

const book = (origin: string, bookUrl: string, name = bookUrl): SearchBook => ({ origin, originName: origin, bookUrl, name, author: '' });

test('appends discover pages in order and deduplicates by source and book URL', () => {
  expect(mergeExploreBooks([book('a', '1')], [book('a', '1', 'renamed'), book('a', '2'), book('b', '1')])).toEqual([book('a', '1'), book('a', '2'), book('b', '1')]);
});

test('keeps the current page unchanged when the next page is empty', () => {
  const current = [book('a', '1')];
  expect(mergeExploreBooks(current, [])).toEqual(current);
});

test('isolates malformed explore configuration from other enabled sources', () => {
  const source = (url: string, enabled = true): BookSource => ({ bookSourceUrl: url, bookSourceName: url, bookSourceType: 0, customOrder: 0, enabled, enabledExplore: true, exploreUrl: '/hot' });
  const result = selectExploreSources([source('good'), source('bad'), source('disabled', false)], item => { if (item.bookSourceUrl === 'bad') throw new Error('invalid'); return [{ title: 'Hot', url: '/hot' }]; });
  expect(result).toEqual({ available: [expect.objectContaining({ bookSourceUrl: 'good' })], failed: 1 });
});
