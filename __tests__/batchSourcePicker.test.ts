import type { BookSource } from '../src/types';
import {
  batchSourceDisplayName,
  selectableBatchSources,
} from '../src/core/batchSourcePicker';
const source = (
  name: string,
  order: number,
  patch: Partial<BookSource> = {},
): BookSource => ({
  bookSourceUrl: `https://${name}.example`,
  bookSourceName: name,
  bookSourceType: 0,
  enabled: true,
  enabledExplore: false,
  customOrder: order,
  ...patch,
});
test('lists every enabled type in ascending native order, including sources without search URLs', () => {
  const a = source('A', 9),
    b = source('B', -1, { bookSourceType: 4 }),
    c = source('C', 2, { enabled: false });
  expect(selectableBatchSources([a, b, c], '')).toEqual([b, a]);
});
test('search matches four fields with SQLite ASCII folding and SQL wildcard semantics', () => {
  const a = source('Alpha', 0, {
      bookSourceGroup: '组甲',
      bookSourceComment: 'A_B%',
    }),
    b = source('École', 1);
  for (const query of [
    'alpha',
    'ALPHA',
    'https://alpha',
    '组甲',
    'A_B%',
    'A%a',
  ])
    expect(selectableBatchSources([a], query)).toEqual([a]);
  expect(selectableBatchSources([a], ' Alpha')).toEqual([]);
  expect(selectableBatchSources([b], 'école')).toEqual([]);
  expect(selectableBatchSources([b], 'École')).toEqual([b]);
  expect(selectableBatchSources([source('😀', 0)], '_')).toHaveLength(1);
});
test('display uses the complete native name and raw group spelling', () => {
  expect(
    batchSourceDisplayName(source('S', 0, { bookSourceGroup: ' A, B ' })),
  ).toBe('S ( A, B )');
  expect(
    batchSourceDisplayName(source('S', 0, { bookSourceGroup: '  ' })),
  ).toBe('S');
});
