import { parseSourceDocument, sourceSelfClosing } from '../src/core/htmlDom';
import { removeSourceElement, sourceTextContent } from '../src/core/sourceDomOperations';
import type { Element } from 'domhandler';

test('preserves XML names, CDATA, offsets and explicitly closed elements', () => {
  const input = '<?xml version="1.0"?><Root><Item/>A<![CDATA[B&C]]><Last>书</Last></Root>';
  const document = parseSourceDocument(input);
  const root = document.children.find(node => node.type === 'tag') as Element;
  const first = root.children[0] as Element;
  expect(root.name).toBe('Root');
  expect(first.name).toBe('Item');
  expect(first.startIndex).toBe(input.indexOf('<Item/>'));
  expect(sourceSelfClosing(first)).toBe(true);
  expect(sourceTextContent(root)).toBe('AB&C书');
});

test('removes a node while preserving the remaining sibling links', () => {
  const document = parseSourceDocument('<?xml version="1.0"?><root><a/>text<b/></root>');
  const root = document.children.find(node => node.type === 'tag') as Element;
  const [first, text, last] = root.children;
  removeSourceElement(text);
  expect(root.children).toEqual([first, last]);
  expect(first.next).toBe(last);
  expect(last.prev).toBe(first);
  expect(text.parent).toBeNull();
});
