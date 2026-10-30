import {
  sourceRuleText,
  sourceRuleTexts,
  sourceRuleValues,
} from '../src/core/sourceRule';
import reference from './fixtures/legacySelectorIndex.native.json';

const page =
  '<section>' +
  Array.from(
    { length: 6 },
    (_, index) => `<i data-index="${index}">${index}</i>`,
  ).join('') +
  '</section>';
const cases: [string, string[]][] = [
  ['tag.i.4:1:-1:1', ['4', '1', '5']],
  ['tag.i!0:2:-1', ['1', '3', '4']],
  ['tag.i[1:3]', ['1', '2', '3']],
  ['tag.i[0:-1:2]', ['0', '2', '4']],
  ['tag.i[-1:0:2]', ['5', '3', '1']],
  ['tag.i[4,1:3,1,-1]', ['4', '1', '2', '3', '5']],
  ['tag.i[!1:3,-1]', ['0', '4']],
  ['tag.i[0:-1:-2]', ['0', '4']],
  ['tag.i[0:-1:-6]', ['0', '1', '2', '3', '4', '5']],
  ['tag.i[0:-1:0]', ['0']],
  ['tag.i[5:0:0]', ['5']],
  ['tag.i[2:5:99]', ['2']],
  ['tag.i[:2]', ['0', '1', '2']],
  ['tag.i[3:]', ['3', '4', '5']],
  ['tag.i[:]', ['0', '1', '2', '3', '4', '5']],
  ['tag.i[-99:2]', ['0', '1', '2']],
  ['tag.i[3:99]', ['3', '4', '5']],
  ['tag.i[-99:-90]', []],
  ['tag.i[99:100]', []],
  ['tag.i[ 4, 1 : 3 : 2, -1 ]', ['4', '1', '3', '5']],
  ['tag.i[99,-99,2,2]', ['2']],
];

test.each(cases)(
  'matches native index order and bounds: %s',
  (selector, expected) => {
    expect(sourceRuleTexts(page, `${selector}@text`)).toEqual(expected);
    expect(
      sourceRuleValues(page, selector).map(node =>
        sourceRuleText(node, 'text'),
      ),
    ).toEqual(expected);
  },
);

test('applies root and children indexes to each selected parent', () => {
  const groups =
    '<main><div><b>A</b><b>B</b><b>C</b></div><div><b>D</b><b>E</b><b>F</b></div></main>';
  expect(sourceRuleTexts(groups, 'tag.div@[2,0]@text')).toEqual([
    'C',
    'A',
    'F',
    'D',
  ]);
  expect(sourceRuleTexts(groups, 'tag.div@children[!1]@text')).toEqual([
    'A',
    'C',
    'D',
    'F',
  ]);
  expect(sourceRuleTexts(groups, 'tag.div@.1@text')).toEqual(['B', 'E']);
});

test('keeps numeric CSS attribute selectors and named elements intact', () => {
  const node = sourceRuleValues(page, 'tag.i.2')[0];
  expect(sourceRuleText(node, 'tag.i@text')).toBe('2');
  expect(sourceRuleTexts(page, 'i[data-index="2"]@text')).toEqual(['2']);
  expect(
    sourceRuleTexts('<h1>T</h1><p class="book2">B</p>', 'h1@text'),
  ).toEqual(['T']);
  expect(sourceRuleTexts('<p class="book2">B</p>', 'class.book2@text')).toEqual(
    ['B'],
  );
});

test('matches the unchanged native Kotlin implementation across generated index boundaries', () => {
  expect(reference.cases).toHaveLength(reference.caseCount);
  expect(reference.caseCount).toBeGreaterThanOrEqual(2400);
  for (const row of reference.cases) {
    const input =
      '<section>' +
      Array.from({ length: row.count }, (_, index) => `<i>${index}</i>`).join(
        '',
      ) +
      '</section>';
    if ('error' in row && row.error) {
      expect(() => sourceRuleValues(input, row.rule)).toThrow(RangeError);
    } else {
      const values = sourceRuleValues(input, row.rule).map(node =>
        sourceRuleText(node, 'text'),
      );
      expect({ count: row.count, rule: row.rule, values }).toEqual({
        count: row.count,
        rule: row.rule,
        values: row.values,
      });
    }
  }
});
