jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
import {
  dueAutoTasks,
  runAutoTask,
  runDueAutoTasks,
} from '../src/core/autoTask';
import {
  exportAutoTasks,
  filterAutoTasks,
  loadAutoTaskServiceEnabled,
  mergeAutoTasks,
  moveAutoTask,
  normalizeAutoTask,
  normalizeAutoTaskScript,
  parseAutoTasks,
  patchAutoTasks,
  saveAutoTaskServiceEnabled,
} from '../src/data/autoTasks';
import { appStorage } from '../src/data/storage';

const rule = (values: Record<string, unknown> = {}) =>
  normalizeAutoTask({
    id: 'one',
    name: '任务',
    cron: '*/5 * * * *',
    script: '({"type":"log","message":"ok"})',
    ...values,
  });
describe('auto tasks', () => {
  test('keeps the Android-compatible global service disabled by default and persists opt-in', async () => {
    expect(loadAutoTaskServiceEnabled()).toBe(false);
    expect(saveAutoTaskServiceEnabled(true)).toBe(true);
    expect(appStorage.set).toHaveBeenCalledWith(
      'auto.tasks.service.enabled.v1',
      'true',
    );
    await expect(runDueAutoTasks()).resolves.toBe(0);
  });
  test('normalizes Android JS wrappers', () => {
    expect(normalizeAutoTaskScript('@js: 1+1')).toBe('1+1');
    expect(normalizeAutoTaskScript('<js> hello </js>')).toBe('hello');
  });
  test('parses and validates imported rules', () => {
    expect(parseAutoTasks(JSON.stringify([rule()]))).toHaveLength(1);
    expect(() =>
      parseAutoTasks('[{"name":"bad","cron":"x","script":"1"}]'),
    ).toThrow('Cron');
  });
  test('preserves local order and run state while importing', () => {
    const local = rule({ lastRunAt: 10, lastLog: 'old', customOrder: 4 }),
      incoming = rule({ name: '新名称', lastRunAt: 0, customOrder: 0 });
    expect(mergeAutoTasks([local], [incoming])[0]).toMatchObject({
      name: '新名称',
      lastRunAt: 10,
      lastLog: 'old',
      customOrder: 4,
    });
  });
  test('moves tasks and normalizes their persistent order', () => {
    const a = rule({ id: 'a', customOrder: 4 }),
      b = rule({ id: 'b', customOrder: 8 }),
      c = rule({ id: 'c', customOrder: 12 });
    expect(
      moveAutoTask([a, b, c], 'b', -1).map(item => [item.id, item.customOrder]),
    ).toEqual([
      ['b', 0],
      ['a', 1],
      ['c', 2],
    ]);
    expect(moveAutoTask([a, b, c], 'a', -1).map(item => item.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
  test('filters task names case-insensitively', () =>
    expect(
      filterAutoTasks(
        [rule({ name: 'Morning Check' }), rule({ id: 'two', name: 'Night' })],
        'check',
      ).map(item => item.name),
    ).toEqual(['Morning Check']));
  test('patches only selected tasks for batch actions', () => {
    const a = rule({ id: 'a', enable: false }),
      b = rule({ id: 'b', enable: false });
    expect(
      patchAutoTasks([a, b], new Set(['b']), {
        enable: true,
        cron: '0 8 * * *',
      }),
    ).toEqual([a, { ...b, enable: true, cron: '0 8 * * *' }]);
  });
  test('does not export local run state', () => {
    const output = exportAutoTasks([
      rule({ lastRunAt: 10, lastLog: 'secret' }),
    ]);
    expect(output).not.toContain('lastRunAt');
    expect(output).not.toContain('secret');
  });
  test('applies first-run grace when finding due tasks', () => {
    const now = new Date(2026, 7, 31, 12, 5, 30).getTime();
    expect(
      dueAutoTasks([rule({ cron: '*/5 * * * *', lastRunAt: 0 })], now),
    ).toHaveLength(1);
  });
  test('runs declarative log and HTTP actions', async () => {
    await expect(runAutoTask(rule())).resolves.toMatchObject({
      success: true,
      result: 'ok',
    });
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'body',
    })) as unknown as typeof fetch;
    await expect(
      runAutoTask(
        rule({ script: '{"type":"http","url":"https://example.test"}' }),
        fetcher,
      ),
    ).resolves.toMatchObject({ success: true, result: 'body' });
    expect(fetcher).toHaveBeenCalled();
  });
  test('reports missing QuickJS explicitly for arbitrary JS', async () =>
    expect(runAutoTask(rule({ script: '1 + 1' }))).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('QuickJS'),
    }));
});
