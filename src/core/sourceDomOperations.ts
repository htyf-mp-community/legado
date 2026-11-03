import { load } from 'cheerio/slim';
import { load as loadHtml } from 'cheerio';
import type { AnyNode, Document } from 'domhandler';
import type { TreeAdapter, html } from 'parse5';
import type { Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { sourceHtmlKnownTag } from './htmlTagMetadata';

// Use the host's existing Cheerio API for DOM operations and XML parsing.
export const sourceCheerio = load([]);

// Cheerio initializes its own parse5 adapter in the parsed root options.
// Reuse that adapter for the source-compatible parser and fragment handling.
const htmlOptions = loadHtml('', { scriptingEnabled: false }).root().options;
export const sourceHtmlAdapter = htmlOptions.treeAdapter as TreeAdapter<Htmlparser2TreeAdapterMap>;

// Cheerio 1.2.0's parse5 error callback is invoked with the parser as `this`.
// It fires immediately after an unacknowledged self-closing start tag, at the
// same point where our former parser subclass synthesized the matching end tag.
type OpenTag = { type: number; tagName: string; selfClosing: boolean; location?: {startOffset: number} };
type CallbackParser = { currentToken: OpenTag | null; openElements: { current: AnyNode }; onEndTag: (token: OpenTag) => void };
export function parseSourceHtml(input: string): Document {
  return loadHtml(input, {
    treeAdapter: sourceHtmlAdapter,
    sourceCodeLocationInfo: true,
    scriptingEnabled: false,
    onParseError(this: CallbackParser, error) {
      if (error.code !== 'non-void-html-element-start-tag-with-trailing-solidus') return;
      const token = this.currentToken, current = this.openElements.current;
      if (token?.selfClosing && !sourceHtmlKnownTag(token.tagName) && current &&
          sourceHtmlAdapter.getNodeSourceCodeLocation(current)?.startTag?.startOffset === token.location?.startOffset)
        this.onEndTag({...token, type: 4}); // parse5 7.3.0 END_TAG
    },
  }).root().get(0) as Document;
}

/** Parse the response head using Cheerio's existing body-context parser. */
export function parseSourceHtmlFragment(input: string): Document {
  const root = loadHtml('', {treeAdapter: sourceHtmlAdapter, scriptingEnabled: false}).root();
  return root._parse(input, root.options, false,
    sourceHtmlAdapter.createElement('body', 'http://www.w3.org/1999/xhtml' as html.NS, []));
}

export function parseSourceXml(input: string): Document {
  return load(input, {
    xml: {
      xmlMode: true,
      recognizeCDATA: true,
      recognizeSelfClosing: true,
      withStartIndices: true,
      withEndIndices: true,
    },
  }).root().get(0) as Document;
}

export function sourceTextContent(node: AnyNode): string {
  return sourceCheerio(node).text();
}

export function removeSourceElement(node: AnyNode): void {
  sourceCheerio(node).remove();
}
