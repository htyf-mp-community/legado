import {
  cacheTaskChapters,
  countNewTaskChapters,
  newTaskChapters,
  taskActions,
  taskBoolean,
  taskInteger,
  taskString,
} from '../src/core/autoTaskProtocol';
import type { LocalChapter } from '../src/types';
const chapter = (url: string, isVolume = false): LocalChapter => ({
  id: url,
  url,
  title: url,
  content: '',
  isVolume,
});
test('protocol accepts objects, arrays and case-insensitive action containers, dropping non-map array entries', () => {
  const action = { TYPE: 'ReFrEsHtOc', BookUrl: ' https://source/book ' };
  expect(taskActions({ ACTIONS: [null, action, 1, []] })).toEqual([action]);
  expect(taskActions(action)).toEqual([action]);
  expect(taskActions([action])).toEqual([action]);
  expect(taskString(action, 'type')).toBe('ReFrEsHtOc');
  expect(taskString(action, 'bookUrl')).toBe('https://source/book');
});
test('native boolean and integer conversion retains source-specific string and numeric semantics', () => {
  expect(taskBoolean({ enable: 'no' }, 'enable', true)).toBe(false);
  expect(taskBoolean({ enable: '00' }, 'enable', false)).toBe(true);
  expect(taskBoolean({ enable: 0.5 }, 'enable', true)).toBe(false);
  expect(taskBoolean({ enable: 'null' }, 'enable', true)).toBe(true);
  expect(taskBoolean({ enable: '   ' }, 'enable', false)).toBe(false);
  expect(taskInteger({ n: 1.9 }, 'n')).toBe(1);
  expect(taskInteger({ n: '1.9' }, 'n')).toBeUndefined();
  expect(taskInteger({ n: 1e99 }, 'n')).toBe(2147483647);
  expect(taskInteger({ n: '2147483648' }, 'n')).toBeUndefined();
});
test('new chapter counts exclude volumes, while cache candidates also use URL identity and are capped by the count delta', () => {
  const before = [chapter('volume', true), chapter('one'), chapter('two')],
    after = [
      chapter('new-volume', true),
      chapter('renamed-one'),
      chapter('two'),
      chapter('three'),
    ];
  expect(countNewTaskChapters(before, after)).toBe(1);
  expect(newTaskChapters(before, after).map(value => value.url)).toEqual([
    'three',
  ]);
  expect(countNewTaskChapters(after, before)).toBe(0);
  expect(newTaskChapters(before, [chapter('one'), chapter('two')])).toEqual([]);
});
test('cache retries three times, continues later chapters and finally reports the first persistent failure', async () => {
  const failure = new Error('first failure'),
    pause = jest.fn(async () => {}),
    failed = jest.fn(),
    attempts: string[] = [];
  await expect(
    cacheTaskChapters(
      [chapter('one'), chapter('two')],
      async value => {
        attempts.push(value.id);
        if (value.id === 'one') throw failure;
      },
      failed,
      pause,
    ),
  ).rejects.toBe(failure);
  expect(attempts).toEqual(['one', 'one', 'one', 'two']);
  expect(pause).toHaveBeenCalledTimes(2);
  expect(failed).toHaveBeenCalledTimes(1);
});
test('a recovered cache counts once and cancellation stops retries immediately', async () => {
  let attempts = 0;
  const pause = jest.fn(async () => {});
  await expect(
    cacheTaskChapters(
      [chapter('one')],
      async () => {
        if (++attempts < 3) throw new Error('temporary');
      },
      () => {},
      pause,
    ),
  ).resolves.toBe(1);
  const cancelled = new Error('cancelled');
  cancelled.name = 'AbortError';
  const cache = jest.fn(async () => {
    throw cancelled;
  });
  await expect(
    cacheTaskChapters([chapter('two')], cache, () => {}, pause),
  ).rejects.toBe(cancelled);
  expect(cache).toHaveBeenCalledTimes(1);
});
