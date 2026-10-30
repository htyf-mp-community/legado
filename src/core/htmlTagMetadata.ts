/*! @license Jsoup 1.16.2 tag metadata
The MIT License

Copyright (c) 2009-2023 Jonathan Hedley <https://jsoup.org/>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import type { AnyNode, Element } from 'domhandler';
const isElement = (node: AnyNode | null): node is Element =>
  !!node && ['tag', 'script', 'style'].includes(node.type);
const name = (node: Element) => node.name.toLowerCase();
const blocks = new Set(
  `html head body frameset script noscript style meta link title frame noframes
  section nav aside hgroup header footer p h1 h2 h3 h4 h5 h6 ul ol pre div
  blockquote hr address figure figcaption form fieldset ins del dl dt dd li table
  caption thead tfoot tbody colgroup col tr th td video audio canvas details menu
  plaintext template article main svg math center dir applet marquee listing`.split(
    /\s+/,
  ),
);
const inlineFormatting = new Set(
  `object base font tt i b u big small em strong dfn code samp kbd var cite abbr
  time acronym mark ruby rt rp rtc a img br wbr map q sub sup bdo iframe embed
  span input select textarea label button optgroup option legend datalist keygen
  output progress meter area param source track summary command device basefont
  bgsound menuitem data bdi s strike nobr rb text mi mo msup mn mtext title p h1
  h2 h3 h4 h5 h6 pre address li th td script style ins del`.split(/\s+/),
);
const preservesWhitespace = new Set(['pre', 'plaintext', 'title', 'textarea']);
const xmlTags = new WeakSet<Element>();
const emptyTags = new Set(
  'meta link base frame img br wbr embed hr input keygen col command device area basefont bgsound menuitem param source track'.split(
    ' ',
  ),
);

/** XML namespace tags keep their native unknown-tag properties after removal. */
export const markSourceXmlTag = (node: Element) => {
  xmlTags.add(node);
};

/** Native HTML void-tag status belongs to the original tag namespace. */
export const sourceHtmlEmptyTag = (node: Element) =>
  !xmlTags.has(node) && emptyTags.has(name(node));
/** Jsoup's block-tag metadata, including script/style and excluding unknown tags. */
export const sourceHtmlBlock = (node: AnyNode | null) =>
  isElement(node) && !xmlTags.has(node) && blocks.has(name(node));

/** Unknown tags format as blocks in Jsoup even though they are inline elements. */
export const sourceHtmlFormatsBlock = (node: AnyNode | null) =>
  !!node &&
  (node.type === 'root' ||
    (isElement(node) &&
      (xmlTags.has(node) || !inlineFormatting.has(name(node)))));

/** Checks an element and at most five ancestors for a preformatted tag. */
export function sourceHtmlPreservesWhitespace(node: AnyNode | null) {
  let parent = node;
  // Native Jsoup checks the parent and at most five more ancestors.
  for (let depth = 0; depth < 6 && isElement(parent); depth++) {
    if (!xmlTags.has(parent) && preservesWhitespace.has(name(parent)))
      return true;
    parent = parent.parent;
  }
  return false;
}
/** Whether Jsoup 1.16.2 registers the tag instead of creating an unknown tag. */
export const sourceHtmlKnownTag = (tag: string) =>
  blocks.has(tag.toLowerCase()) || inlineFormatting.has(tag.toLowerCase());
