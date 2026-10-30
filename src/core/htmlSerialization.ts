/*! @license Jsoup 1.16.2 outer HTML serialization
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
import { isTag, type AnyNode, type Element } from 'domhandler';
import { DomUtils } from 'htmlparser2';
import {
  sourceBareAttribute,
  sourceDocumentSyntax,
  sourceSelfClosing,
  sourceDataText,
} from './htmlDom';
import {
  sourceHtmlBlock,
  sourceHtmlFormatsBlock,
  sourceHtmlPreservesWhitespace,
  sourceHtmlEmptyTag,
} from './htmlTagMetadata';

const booleanAttributes = new Set(
  'allowfullscreen async autofocus checked compact declare default defer disabled formnovalidate hidden inert ismap itemscope multiple muted nohref noresize noshade novalidate nowrap open readonly required reversed seamless selected sortable truespeed typemustmatch'.split(
    ' ',
  ),
);
const blank = (value: string) => /^[ \t\n\f\r]*$/.test(value);
const wholeText = (node: AnyNode): string =>
  node.type === 'text'
    ? node.data
    : 'children' in node
      ? node.children.map(wholeText).join('')
      : '';
const isText = (node: AnyNode | null) =>
  !!node && (node.type === 'text' || node.type === 'cdata');
const effectivelyFirst = (node: AnyNode) =>
  !node.prev ||
  (!node.prev.prev && isText(node.prev) && blank(wholeText(node.prev)));
const inlineable = (node: Element) =>
  !sourceHtmlBlock(node) &&
  (!node.parent || sourceHtmlBlock(node.parent)) &&
  !effectivelyFirst(node) &&
  node.name.toLowerCase() !== 'br';
const shouldIndent = (node: Element) =>
  (sourceHtmlBlock(node) || sourceHtmlFormatsBlock(node.parent)) &&
  !inlineable(node) &&
  !sourceHtmlPreservesWhitespace(node.parent);

function escape(
  value: string,
  xml: boolean,
  attribute = false,
  normalize = false,
  leading = false,
  trailing = false,
) {
  let result = '',
    lastWasWhite = false,
    reachedNonWhite = false,
    skipped = false;
  for (const character of value) {
    if (normalize) {
      if (/[ \t\n\f\r]/.test(character)) {
        if ((leading && !reachedNonWhite) || lastWasWhite) continue;
        if (trailing) {
          skipped = true;
          continue;
        }
        result += ' ';
        lastWasWhite = true;
        continue;
      }
      lastWasWhite = false;
      reachedNonWhite = true;
      if (skipped) {
        result += ' ';
        skipped = false;
      }
    }
    const code = character.codePointAt(0)!;
    if (character === '&') result += '&amp;';
    else if (character === '\u00a0') result += xml ? '&#xa0;' : '&nbsp;';
    else if (character === '<') result += !attribute || xml ? '&lt;' : '<';
    else if (character === '>') result += attribute ? '>' : '&gt;';
    else if (character === '"') result += attribute ? '&quot;' : '"';
    else if (
      (code < 0x20 && ![9, 10, 13].includes(code)) ||
      (code >= 0xd800 && code <= 0xdfff)
    )
      result += `&#x${code.toString(16)};`;
    else result += character;
  }
  return result;
}

function attributes(node: Element, xml: boolean) {
  let output = '';
  for (const [rawKey, value] of Object.entries(node.attribs)) {
    const key = xml
      ? rawKey.replace(/[^-a-zA-Z0-9_:.]/g, '')
      : rawKey.replace(/[\u0000-\u001f\u007f-\u009f "'/=]/g, '');
    if (!key || (xml && !/^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(key))) continue;
    const collapse =
      !xml &&
      (sourceBareAttribute(node, rawKey) ||
        ((!value || value.toLowerCase() === key.toLowerCase()) &&
          booleanAttributes.has(key.toLowerCase())));
    output += ` ${key}${collapse ? '' : `="${escape(value, xml, true)}"`}`;
  }
  return output;
}

function directive(node: AnyNode, xml: boolean) {
  if (node.type !== 'directive') return '';
  if (node.name.toLowerCase() === '!doctype') {
    const match = node.data.match(
      /^!doctype\s+(\S+)(?:\s+(PUBLIC|SYSTEM)\s+(["'])(.*?)\3(?:\s+(["'])(.*?)\5)?)?/i,
    );
    const name = match?.[1] ?? 'html',
      kind = match?.[2]?.toUpperCase();
    return `<!${!xml && !kind ? 'doctype' : 'DOCTYPE'} ${name}${kind ? ` ${kind} "${match?.[4] ?? ''}"${match?.[6] ? ` "${match[6]}"` : ''}` : ''}>`;
  }
  return `<${node.data}>`;
}

function outerHtml(root: AnyNode) {
  const xml = sourceDocumentSyntax(root) === 'xml';
  let output = '';
  const indent = (depth: number) => {
    output += `\n${' '.repeat(Math.min(30, depth))}`;
  };
  const stack: Array<{ node: AnyNode; depth: number; tail: boolean }> = [
    { node: root, depth: 0, tail: false },
  ];
  while (stack.length) {
    const { node, depth, tail } = stack.pop()!;
    if (isTag(node)) {
      const children = node.children;
      const closed =
        !children.length &&
        (sourceHtmlEmptyTag(node) || sourceSelfClosing(node));
      if (tail) {
        if (!closed) {
          if (
            !xml &&
            children.length &&
            sourceHtmlFormatsBlock(node) &&
            !sourceHtmlPreservesWhitespace(node.parent)
          )
            indent(depth);
          output += `</${node.name}>`;
        }
        continue;
      }
      if (!xml && shouldIndent(node) && output.length) indent(depth);
      output += `<${node.name}${attributes(node, xml)}${closed && (xml || !sourceHtmlEmptyTag(node)) ? ' />' : '>'}`;
    } else if (node.type === 'text') {
      if (tail) continue;
      if (sourceDataText(node)) {
        output += node.data;
        continue;
      }
      const parent = node.parent,
        previous = node.prev,
        next = node.next;
      const normalise = !xml && !sourceHtmlPreservesWhitespace(parent);
      const trimLikeBlock =
        sourceHtmlBlock(parent) || sourceHtmlFormatsBlock(parent);
      let leading = false,
        trailing = false;
      if (normalise) {
        leading = (trimLikeBlock && !previous) || parent?.type === 'root';
        trailing = trimLikeBlock && !next;
        const couldSkip =
          (next && isTag(next) && shouldIndent(next)) ||
          (isText(next) && blank(wholeText(next!))) ||
          (previous &&
            isTag(previous) &&
            (sourceHtmlBlock(previous) ||
              previous.name.toLowerCase() === 'br'));
        const isBlank = blank(node.data);
        if (couldSkip && isBlank) continue;
        if (
          (!previous && sourceHtmlFormatsBlock(parent) && !isBlank) ||
          (previous && isTag(previous) && previous.name.toLowerCase() === 'br')
        )
          indent(depth);
      }
      output += escape(node.data, xml, false, normalise, leading, trailing);
      continue;
    } else if (node.type === 'cdata') {
      if (!tail) output += `<![CDATA[${wholeText(node)}]]>`;
      continue;
    } else if (node.type === 'comment') {
      if (!tail) {
        if (
          !xml &&
          effectivelyFirst(node) &&
          sourceHtmlFormatsBlock(node.parent)
        )
          indent(depth);
        output += `<!--${node.data}-->`;
      }
      continue;
    } else if (node.type === 'directive') {
      if (!tail) {
        if (!xml && node.name.toLowerCase() === '!doctype' && node.prev)
          output += '\n';
        output += directive(node, xml);
      }
      continue;
    }
    if (!tail) {
      stack.push({ node, depth, tail: true });
      if ('children' in node)
        for (let index = node.children.length - 1; index >= 0; index--)
          stack.push({
            node: node.children[index],
            depth: node.type === 'root' ? depth : depth + 1,
            tail: false,
          });
    }
  }
  return root.type === 'root' && !xml
    ? output.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '')
    : output;
}

/**
 * Serializes a selected collection as native outer HTML, joined by newlines.
 * HTML extraction first removes script/style nodes from the original DOM, as
 * AnalyzeByJSoup does; 'all' preserves those nodes. Output uses the owning
 * document's HTML/XML syntax and Jsoup 1.16.2 formatting/entity rules.
 */
export function serializeSourceHtml(nodes: AnyNode[], clean: boolean) {
  if (clean)
    for (const tag of ['script', 'style']) {
      const found = new Set<AnyNode>();
      for (const root of nodes) {
        const stack = [root];
        while (stack.length) {
          const node = stack.pop()!;
          if (isTag(node) && node.name.toLowerCase() === tag) found.add(node);
          if ('children' in node)
            for (const child of node.children) stack.push(child);
        }
      }
      for (const node of found) DomUtils.removeElement(node);
    }
  let result = '';
  for (const node of nodes) {
    if (result) result += '\n';
    result += outerHtml(node);
  }
  return result;
}
