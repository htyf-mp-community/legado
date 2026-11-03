import { runSourceJavaScript } from '../src/core/sourceJavaScript';
import { sourceRuleText } from '../src/core/sourceRule';
import { sourceChapterNumber } from '../src/core/sourceChapterNumber';

test.each([
  ['第十二章 余下标题', '第12章'],
  ['正文 第 一 千 二 章 标题', '第1200章'],
  ['第０１２章', '第12章'],
  ['第壹佰零叁章', '第103章'],
  ['第一零二五章', '第1025章'],
  ['第两万零二章', '第20002章'],
  ['第foo章', '第-1章'],
  ['第   章', '第0章'],
  ['第2147483648章', '第-1章'],
  ['第十二回', '第十二回'],
  ['第十\n二章', '第十\n二章'],
])('converts native chapter numbers: %s', (input, expected) => {
  expect(sourceRuleText(input, '@js:java.toNumChapter(result)')).toBe(expected);
});

test('handles very long unmatched titles and keeps the earliest viable match', () => {
  const unmatched = '第'.repeat(100_000);
  expect(sourceChapterNumber(unmatched)).toBe(unmatched);
  expect(sourceChapterNumber('第章第十二章')).toBe('第-1章');
});

test('preserves null and handles the original source call inside a replacement chain', () => {
  expect(runSourceJavaScript('java.toNumChapter(null)', '')).toBeNull();
  // The expression is used by the 格格党 book source in the supplied collection.
  expect(sourceRuleText('第十二章', '@js:result.replace(/第([零一二两三四五六七八九十百千]+)章/g,java.toNumChapter(result))')).toBe('第12章');
});
