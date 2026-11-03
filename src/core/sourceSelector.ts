import type { AnyNode, Element } from 'domhandler';
import { sourceCheerio } from './sourceDomOperations';

// Cheerio normally searches descendants, while source rules also search the
// context itself when passed an array. Preserve that distinction and the
// selector's original :scope using the host's pinned Cheerio implementation.
export function selectSourceElements(selector: string, context: AnyNode | AnyNode[]): Element[] {
  const selection = sourceCheerio(Array.isArray(context) ? context : [context]);
  const scoped = Object.create(selection);
  scoped.toArray = () => context;
  scoped.children = () => ({
    toArray: () => Array.isArray(context) ? context : 'children' in context ? context.children : [],
  });
  return scoped.find(selector).toArray() as Element[];
}
