import {
  nativeTextOffset,
  displayTextOffset,
} from '../src/core/readerPosition';
import { paginateText, paginateTextRanges } from '../src/core/pagination';
test('uses actual trimmed page ranges instead of page index times capacity', () => {
  const text = '  abc\n def\n';
  expect(paginateTextRanges(text, 5)).toEqual([
    { text: 'abc', start: 2, end: 5 },
    { text: 'def', start: 7, end: 10 },
  ]);
  expect(paginateText(text, 5)).toEqual(['abc', 'def']);
});
test('special page breaks retain offsets in the original chapter text', () => {
  expect(paginateTextRanges('a\n[newpage]\nb', 100, true)).toEqual([
    { text: 'a', start: 0, end: 1 },
    { text: 'b', start: 12, end: 13 },
  ]);
});
test('native title, indentation and nonempty paragraphs use UTF-16 offsets including emoji', () => {
  const title = '第😀章',
    body = '　　alpha\n\n　　beta😀end';
  expect(nativeTextOffset(title, body, 15)).toBe(19);
  expect(displayTextOffset(title, body, 19)).toBe(15);
  expect(nativeTextOffset(title, body, 16)).toBe(20);
  expect(displayTextOffset(title, body, 20)).toBe(16);
  expect(displayTextOffset(title, body, 0)).toBe(0);
});
test('hidden native titles and CRLF/blank paragraphs do not shift the restored body character', () => {
  expect(
    displayTextOffset('Hidden', '  alpha  \r\n\tbeta \n\n', 10, '　　', false),
  ).toBe(12);
  expect(
    nativeTextOffset('Hidden', '  alpha  \r\n\tbeta \n\n', 12, '　　', false),
  ).toBe(10);
  expect(displayTextOffset('Title', 'abc', 999)).toBe(3);
});

test('enabled native page-break markers consume no position while retaining display slice offsets', () => {
  const text = 'abc\n[newpage]\ndef';
  expect(displayTextOffset('T', text, 6, '', true, true)).toBe(14);
  expect(nativeTextOffset('T', text, 14, '', true, true)).toBe(6);
  expect(displayTextOffset('T', text, 6, '', true, false)).toBe(4);
  expect(nativeTextOffset('T', 'abc\n\ndef', 5, '', true, true)).toBe(6);
});
