import {
  sourceRuleText,
  sourceRuleTexts,
  sourceRuleValues,
} from '../src/core/sourceRule';
import reference from './fixtures/htmlText.native.json';

test('separates block and br text while excluding script/style data', () => {
  const page =
    '<div id="x"><p>甲</p><p>乙<br>丙</p>尾<script>bad()</script><style>.ad{}</style>末</div>';
  expect(sourceRuleText(page, '#x@text')).toBe('甲 乙 丙 尾 末');
  expect(sourceRuleTexts(page, 'script@text')).toEqual([]);
  expect(sourceRuleTexts(page, 'style@text')).toEqual([]);
});

test('joins direct text nodes with native newline boundaries', () => {
  const page = '<p id="x">A <b>skip</b>  B\n C <i>skip</i>\n D</p>';
  expect(sourceRuleText(page, '#x@textNodes')).toBe('A\nB C\nD');
  expect(sourceRuleText(page, '#x@ownText')).toBe('A B C D');
});

test('retains preformatted whitespace and native Unicode normalization', () => {
  expect(sourceRuleText('<pre id="x">\n A \n B </pre>', '#x@text')).toBe(
    'A \n B',
  );
  expect(sourceRuleText('<pre id="x">\n A \n B </pre>', '#x@textNodes')).toBe(
    'A B',
  );
  expect(
    sourceRuleText(
      '<div id="x">\u2003A\u200bB\u00adC\u200dD\u2003</div>',
      '#x@text',
    ),
  ).toBe('\u2003ABC\u200dD\u2003');
});

test('deduplicates nonblank raw attributes without deduplicating text', () => {
  const page =
    '<a href="/a">same</a><a href="/a">same</a><a href=" \t">same</a><a href="/b">same</a><a href="\u2003">same</a>';
  expect(sourceRuleTexts(page, 'a@href')).toEqual(['/a', '/b']);
  expect(sourceRuleTexts(page, 'a@text')).toEqual([
    'same',
    'same',
    'same',
    'same',
    'same',
  ]);
  expect(sourceRuleTexts(page, 'a@href##/a|/b##same')).toEqual([
    'same',
    'same',
  ]);
});

test('preserves extraction of nodes and root-level own text', () => {
  const node = sourceRuleValues('<p>head<b>skip</b>mid<br>tail</p>', 'p')[0];
  expect(sourceRuleText(node, 'ownText')).toBe('headmid tail');
  expect(sourceRuleText(node, 'textNodes')).toBe('head\nmid\ntail');
});

test('combines HTML string and element lists without losing list boundaries', () => {
  const page = '<p>A</p><p>B</p><a>X</a><a>Y</a><a>Z</a>';
  expect(sourceRuleTexts(page, 'p@text&&a@text')).toEqual([
    'A',
    'B',
    'X',
    'Y',
    'Z',
  ]);
  expect(sourceRuleTexts(page, 'p@text%%a@text')).toEqual(['A', 'X', 'B', 'Y']);
  expect(sourceRuleValues(page, 'p&&a')).toHaveLength(5);
  expect(
    sourceRuleTexts(
      '<main><a data-custom="A">x</a></main>',
      'tag.main@tag.a@data-custom##A##&&',
    ),
  ).toEqual(['&&']);
});

test('matches unchanged native AnalyzeByJSoup and RuleAnalyzer text/attribute output', () => {
  expect(reference.cases).toHaveLength(reference.caseCount);
  expect(reference.caseCount).toBeGreaterThan(80);
  for (const row of reference.cases) {
    expect({
      html: row.html,
      rule: row.rule,
      values: sourceRuleTexts(row.html, row.rule),
    }).toEqual({ html: row.html, rule: row.rule, values: row.values });
  }
});
