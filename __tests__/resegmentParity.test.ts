jest.mock('react-native-quick-base64', () => ({ toByteArray: jest.fn() }));

import { reSegmentText } from '../src/core/txtEncoding';
import native from './fixtures/resegment.native.json';

test('matches complete native output and random-consumption order', () => {
  const failures: unknown[] = [];
  for (const [index, row] of native.cases.entries()) {
    let calls = 0;
    let content: string | undefined, error: unknown;
    try { content = reSegmentText(row.content, row.title, () => row.randomTape[calls++ % row.randomTape.length]); }
    catch (e) { error = e; }
    const expected = row.expected as { content?: string; error?: string; randomCalls: number };
    if (content !== expected.content || !!error !== !!expected.error || calls !== expected.randomCalls) failures.push({ index, row, content, error, calls });
  }
  expect(failures).toEqual([]);
});

test('preserves the native ASCII whitespace boundary inside a paragraph', () => {
  expect(reSegmentText('甲\u00a0乙。', '第一章')).toBe('甲\u00a0乙。');
});

test('does not discard a later paragraph merely because it equals the chapter title', () => {
  expect(reSegmentText('正文。\n第一章', '第一章')).toBe('正文。\n第一章');
});
