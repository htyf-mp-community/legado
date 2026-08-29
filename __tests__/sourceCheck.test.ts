import { checkBookSource, checkBookSources } from '../src/core/sourceCheck';
import { UnsupportedRuleError } from '../src/core/errors';

jest.mock('../src/data/storage', () => ({ appStorage: { getString: () => undefined, set: () => undefined, remove: () => undefined } }));

const source = { bookSourceName: '测试', bookSourceUrl: 'https://test', bookSourceType: 0, customOrder: 0, enabled: false, enabledExplore: true };

test('explicit checking includes disabled sources and classifies results', async () => {
  const success = await checkBookSource(source, '三体', async checked => {
    expect(checked.enabled).toBe(true);
    return [{ name: '三体', author: '刘慈欣', bookUrl: '/1', origin: checked.bookSourceUrl, originName: checked.bookSourceName, sourceType: 0 }];
  });
  expect(success.status).toBe('success');
  expect((await checkBookSource(source, 'x', async () => [])).status).toBe('empty');
  expect((await checkBookSource(source, 'x', async () => { throw new UnsupportedRuleError('JavaScript URL'); })).status).toBe('unsupported');
  expect((await checkBookSource(source, 'x', async () => { throw new Error('network'); })).status).toBe('failed');
});

test('batch checking is bounded and reports progress', async () => {
  let active = 0, peak = 0, progress = 0;
  const sources = Array.from({ length: 7 }, (_, index) => ({ ...source, bookSourceUrl: `https://${index}` }));
  const results = await checkBookSources(sources, '三体', { concurrency: 2, search: async () => { active++; peak = Math.max(peak, active); await Promise.resolve(); active--; return []; }, onResult: (_result, completed) => { progress = completed; } });
  expect(results).toHaveLength(7);
  expect(peak).toBeLessThanOrEqual(2);
  expect(progress).toBe(7);
});
