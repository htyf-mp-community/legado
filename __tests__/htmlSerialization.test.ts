import {
  sourceRuleText,
  sourceRuleTexts,
  sourceRuleValues,
} from '../src/core/sourceRule';
import reference from './fixtures/htmlSerialization.native.json';

test('serializes the selected collection as one outer-HTML result', () => {
  const html =
    '<main><div class="item"><b>A</b></div><div class="item"><b>B</b></div></main>';
  const result = sourceRuleTexts(html, '.item@html');
  expect(result).toHaveLength(1);
  expect(result[0]).toContain('<div class="item">');
  expect(result[0]).toContain('</div>\n<div class="item">');
});

test('html removes descendant script/style nodes in the original selected DOM, while all retains them', () => {
  const html =
    '<section><div><script>secret()</script><style>.x{color:red}</style><p>Body</p></div></section>';
  expect(sourceRuleText(html, 'div@all')).toContain(
    '<script>secret()</script>',
  );
  const root = sourceRuleValues(html, 'section')[0];
  expect(sourceRuleText(root, 'div@html')).toContain('<div>');
  expect(sourceRuleText(root, 'div@all')).not.toMatch(/script|style|secret/);
  expect(sourceRuleValues(root, 'script')).toHaveLength(0);
});

test('keeps native attribute and entity serialization', () => {
  const html =
    '<p data-value="a&amp;&quot;&lt;" hidden="hidden">A&nbsp;&amp;&lt;&gt;😀</p>';
  expect(sourceRuleText(html, 'p@all')).toBe(
    '<p data-value="a&amp;&quot;<" hidden>A&nbsp;&amp;&lt;&gt;😀</p>',
  );
});

test('formats native block/text boundaries with one-space indentation', () => {
  expect(
    sourceRuleText(
      '<div id="x">Hello<br>World<p>A</p><p>B</p></div>',
      '#x@html',
    ),
  ).toBe('<div id="x">\n Hello\n <br>\n World\n <p>A</p>\n <p>B</p>\n</div>');
});

test('uses the native HTML parser for undeclared processing instructions', () => {
  const html = '<root><!--note--><?reader ok?></root>';
  expect(sourceRuleValues(html, '//root/descendant::comment()')).toHaveLength(
    2,
  );
  expect(
    sourceRuleValues(html, '//root/descendant::processing-instruction()'),
  ).toHaveLength(0);
});

test('preserves native cleanup side effects between branches of one rule', () => {
  const values = sourceRuleTexts(
    '<div><script>secret()</script><p>Body</p></div>',
    'div@html&&div@all',
  );
  expect(values).toHaveLength(2);
  expect(values[0]).toBe(values[1]);
  expect(values[1]).not.toContain('script');
});

test('matches unchanged native collection HTML serialization', () => {
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
