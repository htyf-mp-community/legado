/*! @license Jsoup 1.16.2 text semantics
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
import { sourceDataText } from './htmlDom';
import {
  sourceHtmlBlock,
  sourceHtmlFormatsBlock,
  sourceHtmlPreservesWhitespace,
} from './htmlTagMetadata';

const asciiTrim = (text: string) =>
  text.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');
const isElement = (node: AnyNode | null): node is Element =>
  !!node && ['tag', 'script', 'style'].includes(node.type);
const name = (node: Element) => node.name.toLowerCase();
const isText = (node: AnyNode) =>
  (node.type === 'text' || node.type === 'cdata') && !sourceDataText(node);
const wholeText = (node: AnyNode): string =>
  node.type === 'text'
    ? node.data
    : 'children' in node
      ? node.children.map(wholeText).join('')
      : '';

type Accumulator = { chunks: string[]; endsSpace: boolean };
const accumulator = (): Accumulator => ({ chunks: [], endsSpace: false });
function append(output: Accumulator, value: string) {
  if (!value) return;
  output.chunks.push(value);
  output.endsSpace = value.endsWith(' ');
}
function normalize(output: Accumulator, value: string, stripLeading: boolean) {
  let lastWasWhite = false,
    reachedNonWhite = false,
    text = '';
  for (const character of value) {
    if (/[ \t\n\f\r\u00a0]/.test(character)) {
      if ((stripLeading && !reachedNonWhite) || lastWasWhite) continue;
      text += ' ';
      lastWasWhite = true;
    } else if (character !== '\u200b' && character !== '\u00ad') {
      text += character;
      lastWasWhite = false;
      reachedNonWhite = true;
    }
  }
  append(output, text);
}
function preserve(node: AnyNode) {
  return (
    sourceHtmlPreservesWhitespace(node.parent) ||
    node.type === 'cdata' ||
    node.parent?.type === 'cdata'
  );
}
function appendNode(output: Accumulator, node: AnyNode) {
  if (preserve(node)) append(output, wholeText(node));
  else normalize(output, wholeText(node), output.endsSpace);
}

/**
 * Extracts Jsoup-compatible visible, direct, or line-separated direct text.
 * Script/style data and comments are excluded; preformatted text and the
 * source's ASCII trimming / Unicode whitespace rules are retained.
 */
export function sourceHtmlText(
  node: AnyNode,
  mode: 'text' | 'owntext' | 'textnodes' = 'text',
) {
  const output = accumulator();
  if (mode !== 'text') {
    const children = 'children' in node ? node.children : [];
    if (mode === 'textnodes')
      return children
        .filter(isText)
        .map(child => {
          const text = accumulator();
          normalize(text, wholeText(child), false);
          return asciiTrim(text.chunks.join(''));
        })
        .filter(Boolean)
        .join('\n');
    for (const child of children) {
      if (isText(child)) appendNode(output, child);
      else if (isElement(child) && name(child) === 'br' && !output.endsSpace)
        append(output, ' ');
    }
  } else {
    const stack: Array<{ node: AnyNode; tail: boolean }> = [
      { node, tail: false },
    ];
    while (stack.length) {
      const entry = stack.pop()!;
      const current = entry.node;
      if (entry.tail) {
        const next = current.next;
        if (
          isElement(current) &&
          sourceHtmlBlock(current) &&
          next &&
          (isText(next) ||
            (isElement(next) && !sourceHtmlFormatsBlock(next))) &&
          !output.endsSpace
        )
          append(output, ' ');
      } else {
        if (isText(current)) appendNode(output, current);
        else if (
          isElement(current) &&
          output.chunks.length &&
          (sourceHtmlBlock(current) || name(current) === 'br') &&
          !output.endsSpace
        )
          append(output, ' ');
        stack.push({ node: current, tail: true });
        if ('children' in current && current.type !== 'cdata')
          for (let index = current.children.length - 1; index >= 0; index--)
            stack.push({ node: current.children[index], tail: false });
      }
    }
  }
  return asciiTrim(output.chunks.join(''));
}

/** Kotlin String.isBlank includes Unicode space separators but excludes BOM. */
export const isBlankHtmlAttribute = (value: string) =>
  /^[\u0009-\u000d\u001c-\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/.test(
    value,
  );
