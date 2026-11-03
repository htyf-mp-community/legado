import type { AnyNode, Element } from 'domhandler';

// Only nodes created by our document parser are exposed as DOM wrappers to
// untrusted rules; JSON objects may legitimately have a `type` property.
const sourceNodes = new WeakSet<object>();

export function markSourceNode(node: AnyNode): void {
  sourceNodes.add(node);
}

export function isSourceNode(value: unknown): value is AnyNode {
  return typeof value === 'object' && value !== null && sourceNodes.has(value);
}

export function isSourceElement(node: AnyNode): node is Element {
  return node.type === 'tag' || node.type === 'script' || node.type === 'style';
}
