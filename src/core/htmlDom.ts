import { Parser, Token } from 'parse5';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { parseDocument } from 'htmlparser2';
import { isTag, type AnyNode, type Element } from 'domhandler';
import { sourceHtmlKnownTag, markSourceXmlTag } from './htmlTagMetadata';

const syntax = new WeakMap<object, 'html' | 'xml'>();
const bareAttributes = new WeakMap<Element, Set<string>>();
const selfClosing = new WeakSet<Element>();
const dataText = new WeakMap<AnyNode, boolean>();

/** Data-node identity survives removal from its original HTML/XML document. */
export function sourceDataText(node: AnyNode) {
  const recorded = dataText.get(node);
  if (recorded !== undefined) return recorded;
  return !!(
    node.type === 'text' &&
    node.parent &&
    isTag(node.parent) &&
    ['script', 'style'].includes(node.parent.name.toLowerCase()) &&
    sourceDocumentSyntax(node) === 'html'
  );
}

// Jsoup honors '/>' on unknown HTML tags; HTML5 normally ignores that slash.
// Keep the pinned parser's tree repair, closing only a node this token opened.
class SourceHtmlParser extends Parser<Htmlparser2TreeAdapterMap> {
  override onStartTag(token: Token.TagToken) {
    const unknownClosed =
      token.selfClosing && !sourceHtmlKnownTag(token.tagName);
    super.onStartTag(token);
    const current = this.openElements.current;
    if (
      unknownClosed &&
      current &&
      adapter.getNodeSourceCodeLocation(current)?.startTag?.startOffset ===
        token.location?.startOffset
    )
      this.onEndTag({ ...token, type: Token.TokenType.END_TAG });
  }
}

/** Returns the owning parser's syntax; detached nodes use Jsoup's HTML default. */
export function sourceDocumentSyntax(node: AnyNode): 'html' | 'xml' {
  let root = node;
  while (root.parent) root = root.parent;
  return syntax.get(root) ?? 'html';
}

/** Whether an HTML attribute had no equals/value, distinct from an empty value. */
export const sourceBareAttribute = (node: Element, key: string) =>
  bareAttributes.get(node)?.has(key) ?? false;

/** Whether the original start tag explicitly ended with '/>'. */
export const sourceSelfClosing = (node: Element) => selfClosing.has(node);

/**
 * Parses source documents into the existing DOM shape with HTML5 tree repair.
 * The native '<?xml' prefix selects case-preserving XML instead. Template
 * fragments are flattened to match Jsoup's element children. Token locations
 * retain bare attributes/self-closing syntax needed by the native serializer.
 */
export function parseSourceDocument(input: string) {
  const xml = /^<\?xml/i.test(input);
  const document = xml
    ? parseDocument(input, {
        xmlMode: true,
        recognizeCDATA: true,
        recognizeSelfClosing: true,
        withStartIndices: true,
        withEndIndices: true,
      })
    : SourceHtmlParser.parse(input, {
        treeAdapter: adapter,
        sourceCodeLocationInfo: true,
        scriptingEnabled: false,
      });
  syntax.set(document, xml ? 'xml' : 'html');
  const stack: AnyNode[] = [document];
  while (stack.length) {
    const node = stack.pop()!;
    if (
      node.type === 'text' &&
      node.parent &&
      isTag(node.parent) &&
      ['script', 'style'].includes(node.parent.name.toLowerCase())
    )
      dataText.set(node, !xml);
    if (isTag(node)) {
      if (xml) markSourceXmlTag(node);
      if (node.name === 'template') {
        node.children = node.children.flatMap(child =>
          child.type === 'root' ? child.children : [child],
        );
        node.children.forEach((child, index) => {
          child.parent = node;
          child.prev = node.children[index - 1] ?? null;
          child.next = node.children[index + 1] ?? null;
        });
      }
      const location = adapter.getNodeSourceCodeLocation(node);
      const bare = new Set<string>();
      for (const key of Object.keys(node.attribs)) {
        const prefix = node['x-attribsPrefix']?.[key];
        const qualified = prefix ? `${prefix}:${key}` : key;
        if (qualified !== key) {
          node.attribs[qualified] = node.attribs[key];
          delete node.attribs[key];
        }
        const attr = location?.attrs?.[qualified.toLowerCase()];
        if (
          attr &&
          !input.slice(attr.startOffset, attr.endOffset).includes('=')
        )
          bare.add(qualified);
      }
      bareAttributes.set(node, bare);
      const start = location?.startTag?.startOffset ?? node.startIndex;
      if (start !== undefined && start !== null) {
        let quote = '',
          end = start;
        for (; end < input.length; end++) {
          const character = input[end];
          if (quote) {
            if (character === quote) quote = '';
          } else if (character === '"' || character === "'") quote = character;
          else if (character === '>') break;
        }
        if (/\/\s*>$/.test(input.slice(start, end + 1))) selfClosing.add(node);
      }
    }
    if ('children' in node)
      for (const child of node.children) stack.push(child);
  }
  return document;
}
