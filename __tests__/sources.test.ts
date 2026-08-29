jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
import {
  exportBookSources,
  mergeBookSources,
  parseBookSources,
  upsertBookSource,
} from '../src/data/sources';
describe('book source import', () => {
  test('normalizes a single source and defaults', () =>
    expect(
      parseBookSources(
        '{"bookSourceUrl":"https://a","bookSourceName":" A "}',
      )[0],
    ).toMatchObject({
      bookSourceUrl: 'https://a',
      bookSourceName: 'A',
      bookSourceType: 0,
      enabled: true,
      enabledExplore: true,
    }));
  test('supports arrays and overwrite-by-url semantics', () => {
    const old = parseBookSources(
        '{"bookSourceUrl":"u","bookSourceName":"old","enabled":false}',
      ),
      next = parseBookSources(
        '[{"bookSourceUrl":"u","bookSourceName":"new"},{"bookSourceUrl":"v","bookSourceName":"two"}]',
      );
    expect(mergeBookSources(old, next).map(x => x.bookSourceName)).toEqual([
      'new',
      'two',
    ]);
  });
  test('rejects malformed entries', () => {
    expect(() => parseBookSources('{')).toThrow('JSON');
    expect(() => parseBookSources('{}')).toThrow('缺少');
  });
});
test('exports and edits sources without duplicating changed URLs', () => {
  const old = parseBookSources(
    '[{"bookSourceUrl":"old","bookSourceName":"A"},{"bookSourceUrl":"b","bookSourceName":"B"}]',
  );
  const next = upsertBookSource(
    old,
    { ...old[0], bookSourceUrl: 'new', bookSourceName: 'New' },
    'old',
  );
  expect(next.map(x => x.bookSourceUrl).sort()).toEqual(['b', 'new']);
  expect(parseBookSources(exportBookSources(next))).toHaveLength(2);
});
