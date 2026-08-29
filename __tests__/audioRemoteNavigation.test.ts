import { resolveRemoteQueueIndex } from '../src/core/audioRemoteNavigation';

const queue = [
  { id: 'book:0:tts:0' },
  { id: 'book:0:tts:1' },
  { id: 'book:1:tts:0' },
  { id: 'book:1:tts:1' },
  { id: 'book:2:0' },
];

test('remote media buttons move one segment when segment mode is enabled', () => {
  expect(resolveRemoteQueueIndex(queue, 1, 1, true)).toBe(2);
  expect(resolveRemoteQueueIndex(queue, 1, -1, true)).toBe(0);
  expect(resolveRemoteQueueIndex(queue, 0, -1, true)).toBeUndefined();
});

test('remote media buttons move to chapter boundaries by default', () => {
  expect(resolveRemoteQueueIndex(queue, 0, 1, false)).toBe(2);
  expect(resolveRemoteQueueIndex(queue, 1, 1, false)).toBe(2);
  expect(resolveRemoteQueueIndex(queue, 3, -1, false)).toBe(0);
  expect(resolveRemoteQueueIndex(queue, 4, -1, false)).toBe(2);
  expect(resolveRemoteQueueIndex(queue, 4, 1, false)).toBeUndefined();
});

test('invalid or foreign queue ids fail safely', () => {
  expect(resolveRemoteQueueIndex([{ id: 'foreign' }], 0, 1, false)).toBeUndefined();
  expect(resolveRemoteQueueIndex(queue, -1, 1, false)).toBeUndefined();
});
