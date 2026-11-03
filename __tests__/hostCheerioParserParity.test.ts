import { Parser, Token, parseFragment, html } from 'parse5';
import type { Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { sourceHtmlKnownTag } from '../src/core/htmlTagMetadata';
import { sourceHtmlAdapter as adapter, parseSourceHtml, parseSourceHtmlFragment } from '../src/core/sourceDomOperations';
import { sourceRuleText } from '../src/core/sourceRule';

// Baseline is the previous parser implementation, pinned to parse5 7.3.0.
class PreviousParser extends Parser<Htmlparser2TreeAdapterMap> {
  override onStartTag(token: Token.TagToken) {
    const close = token.selfClosing && !sourceHtmlKnownTag(token.tagName);
    super.onStartTag(token);
    const current = this.openElements.current;
    if (close && current && adapter.getNodeSourceCodeLocation(current)?.startTag?.startOffset === token.location?.startOffset)
      this.onEndTag({...token, type: Token.TokenType.END_TAG});
  }
}

const snapshot = (node: any): unknown => ({
  type: node.type, name: node.name, data: node.data, attribs: node.attribs,
  location: node.sourceCodeLocation,
  children: node.children?.map(snapshot),
});

test('host Cheerio parser preserves the previous tree and source locations', () => {
  const corpus = [
    '<x-one a/><p>after</p><x-two data-x="1>2" /><b>after</b>',
    '<div/><span>A</span><unknown/>B<unknown>nested</unknown>',
    '<table><x-one/><tr><td>A<x-two/>B</td></tr></table>',
    '<select><x-one/><option>A</option></select><p>Z</p>',
    '<template><x-one/><p>A</p><x-two/></template>',
    '<svg><x-foreign/><g><x-other /></g></svg><x-html/>z',
    '<script>"<fake/>"</script><!-- <fake/> --><style>x { a: "<x/>" }</style>',
    '<p><x-one a b="" c=x/><x-two/><span>tail</span>',
  ];
  const wrappers = ['', '<html><head></head><body>', '<div><p>', '<table><tbody><tr><td>'];
  for (const prefix of wrappers) for (const item of corpus) {
    const input = prefix + item;
    const expected = PreviousParser.parse(input, {treeAdapter:adapter, sourceCodeLocationInfo:true, scriptingEnabled:false});
    expect(snapshot(parseSourceHtml(input))).toEqual(snapshot(expected));
  }
});

test('matches the previous parser across mixed malformed markup', () => {
  const parts = ['<x-a/>','<x-b data-a/>','<p/>','</p>','<table>','</table>','<tr>','<td>','</td>','<template>','</template>','<svg>','</svg>','<select>','</select>','<option>','</option>','<div>','</div>','text','<!--x-->','<br>'];
  let state = 0x12345678;
  for (let sample = 0; sample < 500; sample++) {
    let input = '';
    for (let i = 0; i < 10; i++) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; input += parts[state % parts.length]; }
    const expected = PreviousParser.parse(input, {treeAdapter:adapter, sourceCodeLocationInfo:true, scriptingEnabled:false});
    expect(snapshot(parseSourceHtml(input))).toEqual(snapshot(expected));
  }
});

test('host Cheerio parses head fragments in the same body context', () => {
  const cases = ['<head><meta charset="GBK"></head>', '<head><noscript><meta charset="GBK"></noscript><meta charset="UTF-8"></head>', '<head><table><meta charset="GBK"></table></head>', '<head><template><meta charset="GBK"></template></head>'];
  for (const input of cases) {
    const expected = parseFragment(adapter.createElement('body', html.NS.HTML, []), input, {treeAdapter:adapter, scriptingEnabled:false});
    expect(snapshot(parseSourceHtmlFragment(input))).toEqual(snapshot(expected));
  }
});

test('a custom self-closing tag does not adopt its following sibling', () => {
  const rule = 'tag.x-foo@tag.div@text';
  expect(sourceRuleText('<x-foo><div>tail</div></x-foo>', rule)).toBe('tail');
  expect(sourceRuleText('<x-foo/><div>tail</div>', rule)).toBe('');
});
