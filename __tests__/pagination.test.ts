import {
  estimatePageCapacity,
  paginateText,
  paginateTextRanges,
  stripSpecialPageBreaks,
} from '../src/core/pagination';

test('estimates more content for a larger viewport', () => {
  expect(estimatePageCapacity(900, 900, 18, 30)).toBeGreaterThan(
    estimatePageCapacity(320, 600, 18, 30),
  );
});

test('paginates without losing or duplicating text', () => {
  const input = '第一段内容\n第二段内容很长\n第三段内容';
  const pages = paginateText(input, 8);
  expect(pages.length).toBeGreaterThan(1);
  expect(pages.join('').replace(/\n/g, '')).toBe(input.replace(/\n/g, ''));
});

test('keeps configured paragraph indentation on the first page and in its UTF-16 range', () => {
  const text = '　　第一段\n　　第二段';
  expect(paginateTextRanges(text, 100)).toEqual([{ text, start: 0, end: text.length }]);
});

test('handles empty text and invalid capacity safely', () => {
  expect(paginateText('', 100)).toEqual(['']);
  expect(paginateText('abc', 0)).toEqual(['a', 'b', 'c']);
});

test('honors Android standalone newpage markers without leaking them', () => {
  expect(paginateText('第一页\n[newpage]\n第二页', 100, true)).toEqual([
    '第一页',
    '第二页',
  ]);
  expect(paginateText('第一页\n[newpage]\n第二页', 100, false)).toEqual([
    '第一页\n[newpage]\n第二页',
  ]);
});

test('hides newpage control markers in scrolling special-style mode', () => {
  expect(stripSpecialPageBreaks('甲\n [newpage] \n乙')).toBe('甲\n\n乙');
  expect(stripSpecialPageBreaks('正文里的[newpage]不处理')).toBe(
    '正文里的[newpage]不处理',
  );
});
