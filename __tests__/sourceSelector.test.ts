import { parseSourceDocument } from '../src/core/htmlDom';
import { selectSourceElements } from '../src/core/sourceSelector';

const doc = parseSourceDocument('<main><div id="a"><div id="b" class="x">文本<b>标题</b></div><div id="c"></div></div><div id="d"></div></main>');
const context = selectSourceElements('#a', doc)[0];
const ids = (selector: string, array = false) => selectSourceElements(selector, array ? [context] : context).map(node => node.attribs.id);

test('distinguishes descendant queries from queries including the context node', () => {
  expect(ids('div')).toEqual(['b', 'c']);
  expect(ids('div', true)).toEqual(['a', 'b', 'c']);
  expect(ids('div > div')).toEqual([]);
  expect(ids('div > div', true)).toEqual(['b', 'c']);
});

test('preserves the original scope for child and grouped selectors', () => {
  expect(ids(':scope')).toEqual([]);
  expect(ids(':scope', true)).toEqual(['a']);
  expect(ids(':scope > div')).toEqual(['b', 'c']);
  expect(ids(':scope > div', true)).toEqual(['b', 'c']);
  expect(ids('div, :scope > div', true)).toEqual(['a', 'b', 'c']);
  expect(ids('div:is(:scope)', true)).toEqual(['a']);
});

test('preserves text, descendant, and sibling selector behavior', () => {
  expect(ids('div:contains(文本)', true)).toEqual(['a', 'b']);
  expect(ids('div:has(b)', true)).toEqual(['a', 'b']);
  expect(ids('div + div', true)).toEqual(['c']);
});
