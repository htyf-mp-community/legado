const mockValues = new Map<string, string>();
jest.mock('../src/data/storage', () => ({ appStorage: {
  getString: (key: string) => mockValues.get(key),
  set: (key: string, value: string) => mockValues.set(key, value),
  remove: (key: string) => mockValues.delete(key),
}}));
import { loadSources, saveSources } from '../src/data/sources';

beforeEach(() => mockValues.clear());
test('installs the default source once and respects its deletion', async () => {
  const sources = await loadSources();
  expect(sources.map(source => source.bookSourceUrl)).toEqual(['http://www.kkbiquge.net']);
  expect(sources[0].bookSourceName).toBe('kk笔趣阁新站');
  await saveSources([]);
  expect(await loadSources()).toEqual([]);
});
test('keeps existing customisations of the same source', async () => {
  mockValues.set('sources.v1', JSON.stringify([{bookSourceUrl:'http://www.kkbiquge.net',bookSourceName:'我的书源',enabled:false}]));
  const sources = await loadSources();
  expect(sources).toHaveLength(1);
  expect(sources[0]).toMatchObject({bookSourceName:'我的书源', enabled:false});
});
test('merges with existing sources without overwriting them', async () => {
  mockValues.set('sources.v1', JSON.stringify([{bookSourceUrl:'https://example.org',bookSourceName:'已有书源',enabled:true}]));
  expect((await loadSources()).map(source => source.bookSourceUrl)).toEqual(expect.arrayContaining(['https://example.org', 'http://www.kkbiquge.net']));
});
test('adds the new default once for existing installations without removing the previous source', async () => {
  mockValues.set('sources.default-8043.v1', '1');
  mockValues.set('sources.v1', JSON.stringify([{bookSourceUrl:'http://www.xsbook.org',bookSourceName:'旧书源',enabled:false}]));
  const sources = await loadSources();
  expect(sources.map(source => source.bookSourceUrl)).toEqual(['http://www.xsbook.org', 'http://www.kkbiquge.net']);
  expect(sources[0]).toMatchObject({bookSourceName:'旧书源',enabled:false});
  await saveSources(sources.filter(source => source.bookSourceUrl !== 'http://www.kkbiquge.net'));
  expect((await loadSources()).map(source => source.bookSourceUrl)).toEqual(['http://www.xsbook.org']);
});
test('does not overwrite damaged existing storage', async () => {
  mockValues.set('sources.v1', '{bad json');
  expect(await loadSources()).toEqual([]);
  expect(mockValues.get('sources.v1')).toBe('{bad json');
});
