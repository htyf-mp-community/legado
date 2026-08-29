import { selectAll } from 'css-select';
import type { AnyNode, Element } from 'domhandler';
import { DomUtils, parseDocument } from 'htmlparser2';
import { UnsupportedRuleError } from './errors';
import { jsonPath } from './jsonPath';

const isNode = (value: unknown): value is AnyNode =>
  !!value && typeof value === 'object' && 'type' in value;
const trimText = (value: string) =>
  value
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

function splitOutside(value: string, separator: string) {
  const result: string[] = [];
  let start = 0,
    quote = '',
    square = 0,
    round = 0;
  for (let i = 0; i <= value.length - separator.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (char === quote && value[i - 1] !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '[') square += 1;
    else if (char === ']') square -= 1;
    else if (char === '(') round += 1;
    else if (char === ')') round -= 1;
    else if (!square && !round && value.startsWith(separator, i)) {
      result.push(value.slice(start, i));
      start = i + separator.length;
      i += separator.length - 1;
    }
  }
  result.push(value.slice(start));
  return result;
}

type XPathContext = { node: AnyNode; position: number; size: number };
type XPathValue = string | number | boolean | AnyNode[];

const xpathString = (value: XPathValue): string =>
  Array.isArray(value)
    ? value[0]
      ? trimText(DomUtils.textContent(value[0]))
      : ''
    : typeof value === 'boolean'
      ? value
        ? 'true'
        : 'false'
      : String(value);
const xpathNumber = (value: XPathValue): number => {
  const number = Number(xpathString(value).trim());
  return Number.isNaN(number) ? Number.NaN : number;
};
const xpathBoolean = (value: XPathValue): boolean =>
  Array.isArray(value)
    ? value.length > 0
    : typeof value === 'boolean'
      ? value
      : typeof value === 'number'
        ? value !== 0 && !Number.isNaN(value)
        : value.length > 0;

function xpathArguments(value: string) {
  if (!value.trim()) return [];
  return splitOutside(value, ',').map(item => item.trim());
}

function xpathNodes(context: XPathContext, expression: string): AnyNode[] {
  const value = expression.trim();
  const children: AnyNode[] =
    'children' in context.node ? context.node.children : [];
  if (value === '.') return [context.node];
  if (value === 'text()')
    return children.filter(child => child.type === 'text');
  if (value.startsWith('@')) return [];
  const child = value.replace(/^child::/, '');
  if (/^[\w*:-]+$/.test(child))
    return children.filter(
      node =>
        node.type === 'tag' && (child === '*' || elementName(node) === child),
    );
  try {
    return selectAll(
      normalizeSelector(
        value.replace(/^\.\//, '').replace(/^descendant::/, ''),
      ),
      context.node,
    );
  } catch {
    return [];
  }
}

function xpathFunction(
  name: string,
  args: string[],
  context: XPathContext,
): XPathValue {
  const values = () => args.map(arg => evaluateXPath(arg, context));
  const targetNode = () => {
    const value = args.length
      ? evaluateXPath(args[0], context)
      : [context.node];
    return Array.isArray(value) ? value[0] : undefined;
  };
  switch (name) {
    case 'position':
      return context.position;
    case 'last':
      return context.size;
    case 'true':
      return true;
    case 'false':
      return false;
    case 'text':
      return trimText(DomUtils.textContent(context.node));
    case 'local-name':
      return targetNode()
        ? (elementName(targetNode()!).split(':').pop() ?? '')
        : '';
    case 'name':
      return targetNode() ? elementName(targetNode()!) : '';
    case 'namespace-uri': {
      const target = targetNode();
      if (!target) return '';
      const prefix = elementName(target).includes(':')
        ? elementName(target).split(':')[0]
        : '';
      const attribute = prefix ? `xmlns:${prefix}` : 'xmlns';
      for (let node: AnyNode | null = target; node; node = node.parent)
        if (node.type === 'tag' && (node as Element).attribs[attribute])
          return (node as Element).attribs[attribute];
      return '';
    }
    case 'lang': {
      const expected = xpathString(
        evaluateXPath(args[0] ?? "''", context),
      ).toLowerCase();
      for (let node: AnyNode | null = context.node; node; node = node.parent) {
        if (node.type !== 'tag') continue;
        const language = (
          (node as Element).attribs['xml:lang'] ??
          (node as Element).attribs.lang ??
          ''
        ).toLowerCase();
        if (language)
          return language === expected || language.startsWith(`${expected}-`);
      }
      return false;
    }
    case 'id': {
      const ids = new Set(
        xpathString(evaluateXPath(args[0] ?? "''", context))
          .split(/\s+/)
          .filter(Boolean),
      );
      let root = context.node;
      while (root.parent) root = root.parent;
      return selectAll('*', root).filter(node =>
        ids.has((node as Element).attribs.id ?? ''),
      );
    }
    case 'string':
      return xpathString(
        args.length ? evaluateXPath(args[0], context) : [context.node],
      );
    case 'number':
      return xpathNumber(
        args.length ? evaluateXPath(args[0], context) : [context.node],
      );
    case 'boolean':
      return xpathBoolean(evaluateXPath(args[0] ?? '.', context));
    case 'not':
      return !xpathBoolean(evaluateXPath(args[0] ?? '.', context));
    case 'normalize-space':
      return trimText(
        xpathString(
          args.length ? evaluateXPath(args[0], context) : [context.node],
        ),
      );
    case 'string-length':
      return [
        ...xpathString(
          args.length ? evaluateXPath(args[0], context) : [context.node],
        ),
      ].length;
    case 'concat':
      return values().map(xpathString).join('');
    case 'contains': {
      const [a, b] = values();
      return xpathString(a).includes(xpathString(b));
    }
    case 'starts-with': {
      const [a, b] = values();
      return xpathString(a).startsWith(xpathString(b));
    }
    case 'ends-with': {
      const [a, b] = values();
      return xpathString(a).endsWith(xpathString(b));
    }
    case 'substring-before': {
      const [a, b] = values().map(xpathString),
        index = a.indexOf(b);
      return index < 0 ? '' : a.slice(0, index);
    }
    case 'substring-after': {
      const [a, b] = values().map(xpathString),
        index = a.indexOf(b);
      return index < 0 ? '' : a.slice(index + b.length);
    }
    case 'substring': {
      const [text, start, length] = values(),
        from = Math.max(0, Math.round(xpathNumber(start)) - 1);
      return length === undefined
        ? xpathString(text).slice(from)
        : xpathString(text).slice(
            from,
            from + Math.max(0, Math.round(xpathNumber(length))),
          );
    }
    case 'translate': {
      const [text, from, to] = values().map(xpathString),
        target = [...to];
      return [...text]
        .map(character => {
          const index = [...from].indexOf(character);
          return index < 0 ? character : (target[index] ?? '');
        })
        .join('');
    }
    case 'count':
      return xpathNodes(context, args[0] ?? '*').length;
    case 'sum':
      return xpathNodes(context, args[0] ?? '*').reduce(
        (total, node) => total + (xpathNumber([node]) || 0),
        0,
      );
    case 'floor':
      return Math.floor(xpathNumber(evaluateXPath(args[0], context)));
    case 'ceiling':
      return Math.ceil(xpathNumber(evaluateXPath(args[0], context)));
    case 'round':
      return Math.round(xpathNumber(evaluateXPath(args[0], context)));
    default:
      throw new UnsupportedRuleError(`XPath function ${name}`);
  }
}

function outsideOperator(
  value: string,
  operators: string[],
): [string, string, string] | undefined {
  for (const operator of operators) {
    const parts = splitOutside(value, operator);
    if (parts.length === 2) return [parts[0], operator.trim(), parts[1]];
  }
  return undefined;
}

function wrappedExpression(value: string) {
  if (!value.startsWith('(') || !value.endsWith(')')) return false;
  let quote = '',
    depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && value[index - 1] !== '\\') quote = '';
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === '(') depth += 1;
    else if (character === ')' && --depth === 0 && index !== value.length - 1)
      return false;
  }
  return depth === 0;
}

function evaluateXPath(expression: string, context: XPathContext): XPathValue {
  let value = expression.trim();
  if (wrappedExpression(value)) value = value.slice(1, -1).trim();
  const orParts = splitOutside(value, ' or ');
  if (orParts.length > 1)
    return orParts.some(part => xpathBoolean(evaluateXPath(part, context)));
  const andParts = splitOutside(value, ' and ');
  if (andParts.length > 1)
    return andParts.every(part => xpathBoolean(evaluateXPath(part, context)));
  const comparison = outsideOperator(value, ['!=', '>=', '<=', '=', '>', '<']);
  if (comparison) {
    const left = evaluateXPath(comparison[0], context),
      right = evaluateXPath(comparison[2], context),
      numeric = typeof left === 'number' || typeof right === 'number';
    const operands = (item: XPathValue) =>
      Array.isArray(item)
        ? item.map(node =>
            numeric ? xpathNumber([node]) : xpathString([node]),
          )
        : [numeric ? xpathNumber(item) : xpathString(item)];
    const leftValues = operands(left),
      rightValues = operands(right);
    return leftValues.some(a =>
      rightValues.some(b => {
        if (comparison[1] === '=') return a === b;
        if (comparison[1] === '!=') return a !== b;
        if (comparison[1] === '>') return a > b;
        if (comparison[1] === '<') return a < b;
        if (comparison[1] === '>=') return a >= b;
        return a <= b;
      }),
    );
  }
  const arithmetic = outsideOperator(value, [
    ' div ',
    ' mod ',
    ' + ',
    ' - ',
    ' * ',
  ]);
  if (arithmetic) {
    const a = xpathNumber(evaluateXPath(arithmetic[0], context)),
      b = xpathNumber(evaluateXPath(arithmetic[2], context));
    if (arithmetic[1] === 'div') return a / b;
    if (arithmetic[1] === 'mod') return a % b;
    if (arithmetic[1] === '+') return a + b;
    if (arithmetic[1] === '-') return a - b;
    return a * b;
  }
  const quoted = value.match(/^(['"])([\s\S]*)\1$/);
  if (quoted) return quoted[2];
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value === '.') return [context.node];
  if (value.startsWith('@'))
    return context.node.type === 'tag'
      ? ((context.node as Element).attribs[value.slice(1)] ?? '')
      : '';
  const call = value.match(/^([\w-]+)\(([\s\S]*)\)$/);
  if (call) return xpathFunction(call[1], xpathArguments(call[2]), context);
  return xpathNodes(context, value);
}

function regex(pattern: string) {
  let flags = 'g';
  const cleaned = pattern.replace(/^\(\?([ims]+)\)/, (_, value: string) => {
    flags += value;
    return '';
  });
  return new RegExp(cleaned, [...new Set(flags)].join(''));
}

function applyReplacement(value: string, suffix: string[]) {
  if (!suffix.length || !suffix[0]) return value;
  try {
    return value.replace(regex(suffix[0]), suffix[1] ?? '');
  } catch {
    return value;
  }
}

function normalizeSelector(value: string) {
  return value
    .trim()
    .replace(/^@CSS:/i, '')
    .split(/\s+/)
    .map(part =>
      part
        .replace(/^class\.([\w-]+)/, '.$1')
        .replace(/^id\.([\w-]+)/, '#$1')
        .replace(/^tag\.([\w-]+)/, '$1'),
    )
    .join(' ');
}

function xpathToCss(rule: string) {
  const slash = '\uE000';
  const sibling = '\uE001';
  const protect = (value: string) => value.replace(/\//g, slash);
  let extraction = '';
  let value = rule.replace(/^@XPath:/i, '').trim();
  let exactText: string | undefined;
  const nodeChecks: Array<
    (node: AnyNode, position: number, nodes: AnyNode[]) => boolean
  > = [];
  const advancedFunction =
    /\b(?:string-length|substring(?:-before|-after)?|concat|translate|number|sum|floor|ceiling|round|boolean|string|count|true|false|name|namespace-uri|lang|id|not)\s*\(/;
  value = value.replace(/\[([^\[\]]+)\]/g, (whole, predicate: string) => {
    if (
      !advancedFunction.test(predicate) &&
      !/\s(?:and|or)\s/.test(predicate) &&
      !/^[\w*:-]+\s*(?:!?=|[<>]=?)/.test(predicate.trim())
    )
      return whole;
    nodeChecks.push((node, index, nodes) =>
      xpathBoolean(
        evaluateXPath(predicate, {
          node,
          position: index + 1,
          size: nodes.length,
        }),
      ),
    );
    return '';
  });
  value = value.replace(
    /\[(?:normalize-space\(text\(\)\)|text\(\))\s*=\s*(['"])(.*?)\1\]/g,
    (_, _quote: string, expected: string) => {
      exactText = expected.trim();
      return '';
    },
  );
  value = value.replace(
    /\[(contains|starts-with|ends-with)\((normalize-space\(text\(\)\)|text\(\)),\s*(['"])(.*?)\3\)\]/g,
    (
      _,
      operation: string,
      expression: string,
      _quote: string,
      expected: string,
    ) => {
      nodeChecks.push(node => {
        const text = expression.startsWith('normalize-space')
          ? trimText(DomUtils.textContent(node))
          : DomUtils.textContent(node);
        if (operation === 'starts-with') return text.startsWith(expected);
        if (operation === 'ends-with') return text.endsWith(expected);
        return text.includes(expected);
      });
      return '';
    },
  );
  value = value.replace(
    /\[local-name\(\)\s*=\s*(['"])(.*?)\1\]/g,
    (_, _quote: string, expected: string) => {
      nodeChecks.push(
        node =>
          node.type === 'tag' &&
          (node as Element).name.split(':').pop() === expected,
      );
      return '';
    },
  );
  const attribute = value.match(/\/@([\w:-]+)$/);
  if (attribute) {
    extraction = attribute[1];
    value = value.slice(0, -attribute[0].length);
  } else if (/\/text\(\)$/.test(value)) {
    extraction = 'text';
    value = value.replace(/\/text\(\)$/, '');
  }
  value = value
    .replace(/^\.\/\//, '')
    .replace(/^\.\//, '')
    .replace(/^\/\//, '')
    .replace(/\/following-sibling::/g, sibling)
    .replace(/\/descendant::/g, '//')
    .replace(/\/child::/g, '/')
    .replace(/\/self::/g, '')
    .replace(
      /\[contains\(@([\w:-]+),\s*['"]([^'"]+)['"]\)\]/g,
      (_, name: string, expected: string) =>
        `[${name}*="${protect(expected)}"]`,
    )
    .replace(
      /\[starts-with\(@([\w:-]+),\s*['"]([^'"]+)['"]\)\]/g,
      (_, name: string, expected: string) =>
        `[${name}^="${protect(expected)}"]`,
    )
    .replace(
      /\[ends-with\(@([\w:-]+),\s*['"]([^'"]+)['"]\)\]/g,
      (_, name: string, expected: string) =>
        `[${name}$="${protect(expected)}"]`,
    )
    .replace(
      /\[contains\(text\(\),\s*['"]([^'"]+)['"]\)\]/g,
      (_, expected: string) => `:contains("${protect(expected)}")`,
    )
    .replace(/\[@id=['"]([^'"]+)['"]\]/g, '#$1')
    .replace(/\[@class=['"]([^'"]+)['"]\]/g, '[class="$1"]')
    .replace(
      /\[@([\w:-]+)=['"]([^'"]+)['"]\]/g,
      (_, name: string, expected: string) => `[${name}="${protect(expected)}"]`,
    )
    .replace(
      /\[@([\w:-]+)\s*!=\s*['"]([^'"]+)['"]\]/g,
      (_, name: string, expected: string) =>
        `:not([${name}="${protect(expected)}"])`,
    )
    .replace(/\[@([\w:-]+)\]/g, '[$1]')
    .replace(/\[not\(@([\w:-]+)\)\]/g, ':not([$1])')
    .replace(
      /\[position\(\)\s+mod\s+(\d+)\s*=\s*(\d+)\]/g,
      ':nth-of-type($1n+$2)',
    )
    .replace(/\[position\(\)\s*<=\s*(\d+)\]/g, ':nth-of-type(-n+$1)')
    .replace(
      /\[position\(\)\s*<\s*(\d+)\]/g,
      (_, count: string) =>
        `:nth-of-type(-n+${Math.max(0, Number(count) - 1)})`,
    )
    .replace(/\[position\(\)\s*>=\s*(\d+)\]/g, ':nth-of-type(n+$1)')
    .replace(
      /\[position\(\)\s*>\s*(\d+)\]/g,
      (_, count: string) => `:nth-of-type(n+${Number(count) + 1})`,
    )
    .replace(
      /\[last\(\)\s*-\s*(\d+)\]/g,
      (_, offset: string) => `:nth-last-of-type(${Number(offset) + 1})`,
    )
    .replace(/\[(?:position\(\)\s*=\s*)?(\d+)\]/g, ':nth-of-type($1)')
    .replace(/\[last\(\)\]/g, ':last-of-type')
    .replace(/\/\//g, ' ')
    .replace(/\//g, ' > ')
    .replaceAll(sibling, ' ~ ')
    .replaceAll(slash, '/')
    .replace(
      /(^|[ >~])([A-Za-z_][\w.-]*):(?!(?:nth|last|not|contains)(?:-|\())([A-Za-z_][\w.-]*)/g,
      '$1$2\\:$3',
    )
    .replace(
      /\[([A-Za-z_][\w.-]*):([A-Za-z_][\w.-]*)(?=[\]=~^$*|])/g,
      '[$1\\:$2',
    );
  if (value === '.') value = '';
  return { selector: value, extraction, exactText, nodeChecks };
}

const axisExpression =
  /\/(parent|ancestor-or-self|ancestor|preceding-sibling|following-sibling|preceding|following|self|child|descendant-or-self|descendant|attribute|namespace)::(processing-instruction\(\)|comment\(\)|node\(\)|text\(\)|[\w*:-]+)(?:\[(\d+)\])?/;
const elementName = (node: AnyNode) =>
  node.type === 'tag' ? (node as Element).name : '';
const axisMatches = (node: AnyNode, name: string) =>
  name === 'node()'
    ? true
    : name === 'text()'
      ? node.type === 'text'
      : name === 'comment()'
        ? node.type === 'comment'
        : name === 'processing-instruction()'
          ? node.type === 'directive'
          : node.type === 'tag' && (name === '*' || elementName(node) === name);
const nodeChildren = (node: AnyNode): AnyNode[] =>
  'children' in node ? node.children : [];
const descendants = (node: AnyNode) => {
  const output: AnyNode[] = [],
    visit = (parent: AnyNode) =>
      nodeChildren(parent).forEach(child => {
        output.push(child);
        visit(child);
      });
  visit(node);
  return output;
};
const rootOf = (node: AnyNode) => {
  let root = node;
  while (root.parent) root = root.parent;
  return root;
};
const isAncestorOf = (ancestor: AnyNode, node: AnyNode) => {
  for (let parent = node.parent; parent; parent = parent.parent)
    if (parent === ancestor) return true;
  return false;
};

function xpathAxisValues(
  value: string | AnyNode,
  rule: string,
): unknown[] | undefined {
  const cleanRule = rule.replace(/^@XPath:/i, '').trim(),
    match = axisExpression.exec(cleanRule);
  if (!match) return undefined;
  const before = cleanRule.slice(0, match.index),
    tail = cleanRule.slice(match.index + match[0].length),
    position = match[3] ? Number(match[3]) : 0;
  const base = htmlValues(value, `@XPath:${before}`),
    output: unknown[] = [],
    seen = new Set<unknown>();
  for (const item of base) {
    if (!isNode(item)) continue;
    if (match[1] === 'attribute') {
      if (item.type === 'tag') {
        const attributes = (item as Element).attribs;
        const names = match[2] === '*' ? Object.keys(attributes) : [match[2]];
        for (const name of names)
          if (attributes[name] !== undefined && !seen.has(attributes[name])) {
            seen.add(attributes[name]);
            output.push(attributes[name]);
          }
      }
      continue;
    }
    if (match[1] === 'namespace') {
      const namespaces: string[] = [];
      for (let node: AnyNode | null = item; node; node = node.parent)
        if (node.type === 'tag')
          for (const [name, uri] of Object.entries((node as Element).attribs))
            if (
              (name === 'xmlns' || name.startsWith('xmlns:')) &&
              (match[2] === '*' || name === `xmlns:${match[2]}`) &&
              !namespaces.includes(uri)
            )
              namespaces.push(uri);
      for (const uri of namespaces)
        if (!seen.has(uri)) {
          seen.add(uri);
          output.push(uri);
        }
      continue;
    }
    let candidates: AnyNode[] = [];
    if (match[1] === 'parent') {
      if (item.parent && axisMatches(item.parent, match[2]))
        candidates = [item.parent];
    } else if (match[1] === 'ancestor' || match[1] === 'ancestor-or-self') {
      if (match[1] === 'ancestor-or-self' && axisMatches(item, match[2]))
        candidates.push(item);
      for (let node = item.parent; node; node = node.parent)
        if (axisMatches(node, match[2])) candidates.push(node);
    } else if (match[1] === 'preceding-sibling') {
      for (let node = item.prev; node; node = node.prev)
        if (axisMatches(node, match[2])) candidates.push(node);
    } else if (match[1] === 'following-sibling') {
      for (let node = item.next; node; node = node.next)
        if (axisMatches(node, match[2])) candidates.push(node);
    } else if (match[1] === 'self') {
      if (axisMatches(item, match[2])) candidates = [item];
    } else if (match[1] === 'child') {
      candidates = nodeChildren(item).filter(node =>
        axisMatches(node, match[2]),
      );
    } else if (match[1] === 'descendant' || match[1] === 'descendant-or-self') {
      if (match[1] === 'descendant-or-self' && axisMatches(item, match[2]))
        candidates.push(item);
      candidates.push(
        ...descendants(item).filter(node => axisMatches(node, match[2])),
      );
    } else {
      const ordered = descendants(rootOf(item)),
        index = ordered.indexOf(item);
      if (match[1] === 'following')
        candidates = ordered
          .slice(index + 1)
          .filter(
            node => !isAncestorOf(item, node) && axisMatches(node, match[2]),
          );
      else
        candidates = ordered
          .slice(0, index)
          .reverse()
          .filter(
            node => !isAncestorOf(node, item) && axisMatches(node, match[2]),
          );
    }
    if (position)
      candidates = candidates[position - 1] ? [candidates[position - 1]] : [];
    for (const candidate of candidates) {
      const resolved = tail
        ? htmlValues(candidate, `@XPath:.${tail}`)
        : [candidate];
      for (const result of resolved)
        if (!seen.has(result)) {
          seen.add(result);
          output.push(result);
        }
    }
  }
  return output;
}

function selectorParts(rule: string) {
  if (/^(?:@XPath:|\/\/|\.\/\/)/i.test(rule))
    return { ...xpathToCss(rule), legacyIndex: '' };
  const parts = splitOutside(
    rule.replace(/^@@/, '').replace(/^@CSS:/i, ''),
    '@',
  );
  const rawSelector = parts.shift() ?? '',
    indexed = legacySelectorPart(rawSelector);
  return {
    selector: indexed.selector,
    extraction: parts.join('@'),
    exactText: undefined,
    nodeChecks: [] as Array<
      (node: AnyNode, position: number, nodes: AnyNode[]) => boolean
    >,
    legacyIndex: indexed.index,
  };
}

function extract(node: AnyNode, mode: string) {
  const key = mode.trim().toLowerCase();
  if (key === 'owntext' || key === 'textnodes')
    return trimText(
      'children' in node
        ? node.children
            .filter(child => child.type === 'text')
            .map(child => DomUtils.textContent(child))
            .join('')
        : '',
    );
  if (!key || key === 'text') return trimText(DomUtils.textContent(node));
  if (key === 'html') return DomUtils.getInnerHTML(node);
  if (key === 'all') return DomUtils.getOuterHTML(node);
  return node.type === 'tag'
    ? ((node as Element).attribs[mode.trim()] ?? '')
    : '';
}

const LEGACY_EXTRACTIONS = new Set([
  'text',
  'textnodes',
  'owntext',
  'html',
  'all',
  'href',
  'src',
  'content',
  'title',
  'value',
  'onclick',
  'data-src',
  'data-lazy',
  'data-original',
  'children',
]);

function extractedValues(
  node: AnyNode,
  extraction: string,
  replacement: string[],
): unknown[] {
  if (extraction.trim().toLowerCase() === 'children')
    return 'children' in node
      ? node.children.filter(child => child.type === 'tag')
      : [];
  return [applyReplacement(extract(node, extraction), replacement)];
}

function legacySelectorPart(value: string) {
  const match = value
    .trim()
    .match(/^(.*?)(?:\[(!?-?\d+(?::-?\d+)?)\]|(?:\.)?(!?-?\d+(?::-?\d+)?))$/);
  if (!match || !match[1]) return { selector: value.trim(), index: '' };
  return { selector: match[1], index: match[2] ?? match[3] };
}

function selectLegacyNodes(context: AnyNode, selector: string) {
  if (selector.startsWith('text.')) {
    const expected = selector.slice('text.'.length);
    return selectAll('*', context).filter(node => {
      if (!('children' in node)) return false;
      const ownText = trimText(
        node.children
          .filter(child => child.type === 'text')
          .map(child => DomUtils.textContent(child))
          .join(''),
      );
      return ownText.includes(expected);
    });
  }
  return selectAll(normalizeSelector(selector), context);
}

function selectLegacyIndex(nodes: AnyNode[], expression: string) {
  if (!expression) return nodes;
  const excluded = expression.startsWith('!'),
    range = expression.replace(/^!/, '').split(':');
  const resolve = (raw: string) => {
    const index = Number(raw);
    return index < 0 ? nodes.length + index : index;
  };
  if (range.length > 1) {
    const start = resolve(range[0]),
      end = resolve(range[1]);
    if (start > end) {
      const reversed: AnyNode[] = [];
      for (let index = start; index >= end; index -= 1)
        if (nodes[index]) reversed.push(nodes[index]);
      return reversed;
    }
    return nodes.filter((_node, index) => index >= start && index < end);
  }
  const index = resolve(range[0]);
  return excluded
    ? nodes.filter((_node, position) => position !== index)
    : nodes[index]
      ? [nodes[index]]
      : [];
}

function legacyChainedValues(
  value: string | AnyNode,
  rule: string,
  replacement: string[],
) {
  const segments = splitOutside(rule, '@').filter(Boolean);
  if (
    segments.length < 2 ||
    (segments.length === 2 &&
      !/^(?:class|tag|id)\.|(?:\.)?!?-?\d+(?::-?\d+)?$/.test(segments[1]))
  )
    return undefined;
  const last = segments[segments.length - 1].toLowerCase();
  const extraction = LEGACY_EXTRACTIONS.has(last) ? segments.pop()! : '';
  let contexts: AnyNode[] = [
    typeof value === 'string' ? parseDocument(value) : value,
  ];
  for (const segment of segments) {
    const { selector, index } = legacySelectorPart(segment),
      next: AnyNode[] = [];
    for (const context of contexts) {
      let selected: AnyNode[];
      try {
        selected = selectLegacyNodes(context, selector);
      } catch {
        selected = [];
      }
      next.push(...selectLegacyIndex(selected, index));
    }
    contexts = next;
    if (!contexts.length) break;
  }
  return contexts
    .flatMap(node =>
      extraction || replacement.length
        ? extractedValues(node, extraction, replacement)
        : [node],
    )
    .filter(item => item !== '');
}

function htmlValues(value: string | AnyNode, rule: string): unknown[] {
  if (rule.startsWith(':')) {
    const expression = regex(rule.slice(1)),
      source = typeof value === 'string' ? value : DomUtils.textContent(value);
    return [...source.matchAll(expression)].map(match =>
      match.length > 2
        ? { __legadoCaptures: Array.from(match) }
        : (match[1] ?? match[0]),
    );
  }
  const [main, ...replacement] = rule.split('##'),
    alternatives = splitOutside(main, '||');
  if (isNode(value) && LEGACY_EXTRACTIONS.has(main.toLowerCase()))
    return extractedValues(value, main, replacement);
  const chained = legacyChainedValues(value, main, replacement);
  if (chained) return chained;
  if (
    /^(?:@XPath:|\/\/|\.\/\/)/i.test(main) &&
    main.includes('|') &&
    !main.includes('||')
  ) {
    const output: unknown[] = [],
      seen = new Set<unknown>();
    for (const branch of splitOutside(main, '|'))
      for (const item of htmlValues(
        value,
        `${branch.trim()}${replacement.length ? `##${replacement.join('##')}` : ''}`,
      ))
        if (!seen.has(item)) {
          seen.add(item);
          output.push(item);
        }
    return output;
  }
  if (/^(?:@XPath:|\/\/|\.\/\/)/i.test(main)) {
    const axis = xpathAxisValues(value, main);
    if (axis)
      return axis.map(item =>
        typeof item === 'string' ? applyReplacement(item, replacement) : item,
      );
  }
  for (const alternative of alternatives) {
    const {
        selector,
        extraction,
        exactText,
        nodeChecks,
        legacyIndex = '',
      } = selectorParts(alternative.trim()),
      root = typeof value === 'string' ? parseDocument(value) : value,
      selected = selector
        ? selectLegacyNodes(root, selector)
        : isNode(root)
          ? [root]
          : [],
      nodes = selectLegacyIndex(selected, legacyIndex);
    const output = nodes
      .filter(
        (node, index, allNodes) =>
          (exactText === undefined ||
            trimText(DomUtils.textContent(node)) === exactText) &&
          nodeChecks.every(check => check(node, index, allNodes)),
      )
      .flatMap(node =>
        extraction || replacement.length
          ? extractedValues(node, extraction, replacement)
          : [node],
      )
      .filter(item => item !== '');
    if (output.length) return output;
  }
  return [];
}

export function sourceRuleValues(value: unknown, rawRule: unknown): unknown[] {
  if (typeof rawRule !== 'string' || !rawRule.trim()) return [];
  const rule = rawRule.trim();
  const captures =
    value && typeof value === 'object' && '__legadoCaptures' in value
      ? (value as { __legadoCaptures: unknown[] }).__legadoCaptures
      : undefined;
  const capture = rule.match(/^\$(\d+)$/);
  if (captures && capture)
    return captures[Number(capture[1])] === undefined
      ? []
      : [captures[Number(capture[1])]];
  const elementScript = rule.match(
    /^<js>[\s\S]*?path\s*=\s*(["'])([^"']+)\1;[\s\S]*?java\.getElement\(path\);?[\s\S]*?<\/js>$/,
  );
  if (elementScript) return sourceRuleValues(value, elementScript[2]);
  const scriptPrefix = rule.match(/^<js>([\s\S]*?)<\/js>([\s\S]*)$/);
  if (
    scriptPrefix &&
    /^if\s*\(result\.match\([\s\S]*?Just a moment[\s\S]*?\)\)\s*\{[\s\S]*?startBrowserAwait[\s\S]*?\}\s*;?\s*result\s*;?\s*$/.test(
      scriptPrefix[1].trim(),
    )
  ) {
    const selector = scriptPrefix[2].trim();
    return selector ? sourceRuleValues(value, selector) : [value];
  }
  const matchTransform = rule.match(
    /^([\s\S]+?)@js:\s*result\.match\(\/((?:\\.|[^/])*)\/([a-z]*)\)\[(\d+)\]\s*;?$/i,
  );
  if (matchTransform) {
    const flags = matchTransform[3].replace(/g/g, '');
    let expression: RegExp;
    try {
      expression = new RegExp(matchTransform[2], flags);
    } catch {
      return [];
    }
    return sourceRuleValues(value, matchTransform[1]).flatMap(item => {
      const match = String(item).match(expression),
        capture = match?.[Number(matchTransform[4])];
      return capture === undefined ? [] : [capture];
    });
  }
  const originConcat = rule.match(
    /^([\s\S]+?)@js:\s*result\s*=\s*book\.origin\s*\+\s*result\s*;\s*result\s*;?$/,
  );
  if (originConcat) return sourceRuleValues(value, originConcat[1]);
  const conditionalSuffix = rule.match(
    /^([\s\S]+?)@js:\s*if\(\/((?:\\.|[^/])*)\/([a-z]*)\.test\(result\[0\]\)\)\{result=result\[0\]\+(["'])([\s\S]*?)\4;\}else\{result=\[\];\};?$/i,
  );
  if (conditionalSuffix) {
    let expression: RegExp;
    try {
      expression = new RegExp(
        conditionalSuffix[2],
        conditionalSuffix[3].replace(/g/g, ''),
      );
    } catch {
      return [];
    }
    return sourceRuleValues(value, conditionalSuffix[1]).flatMap(item =>
      expression.test(String(item))
        ? [`${String(item)}${conditionalSuffix[5]}`]
        : [],
    );
  }
  const stringConcat = rule.match(
    /^([\s\S]+?)@js:\s*(?:result\s*=\s*)?(["'])([^"']*)\2\s*\+\s*result\s*\+\s*(["'])([^"']*)\4\s*;?\s*(?:result\s*;?)?$/,
  );
  if (stringConcat)
    return sourceRuleValues(value, stringConcat[1]).map(
      item => `${stringConcat[3]}${String(item)}${stringConcat[5]}`,
    );
  const replaceChain = rule.match(
    /^([\s\S]+?)@js:\s*(?:result\s*=\s*)?result([\s\S]*?);?\s*(?:result\s*;?)?$/i,
  );
  if (replaceChain) {
    const replacements: Array<{ expression: RegExp; replacement: string }> = [];
    const matcher =
      /\.replace\(\s*\/((?:\\.|[^/])*)\/([a-z]*)\s*,\s*(["'])((?:\\.|(?!\3)[\s\S])*?)\3\s*\)/gi;
    let consumed = '';
    for (
      let match = matcher.exec(replaceChain[2]);
      match;
      match = matcher.exec(replaceChain[2])
    ) {
      consumed += match[0];
      try {
        replacements.push({
          expression: new RegExp(match[1], match[2]),
          replacement: match[4]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\(["'\\])/g, '$1'),
        });
      } catch {
        return [];
      }
    }
    if (replacements.length && consumed === replaceChain[2].replace(/;$/, ''))
      return sourceRuleValues(value, replaceChain[1]).map(item =>
        replacements.reduce(
          (result, replacement) =>
            result.replace(replacement.expression, replacement.replacement),
          String(item),
        ),
      );
  }
  // TODO(htyf-native): Connect the version-pinned sandbox runtime before enabling arbitrary Legado JavaScript rules.
  if (rule.includes('@js:') || rule.includes('<js>'))
    throw new UnsupportedRuleError('JavaScript');
  const [main, ...replacement] = rule.split('##');
  if (main.includes('{{')) {
    const rendered = main.replace(
      /\{\{([\s\S]*?)\}\}/g,
      (_whole, expression: string) => {
        const nested = expression.trim();
        if (nested.startsWith('@@'))
          return sourceRuleText(value, nested.slice(2));
        if (nested.startsWith('$') || nested.startsWith('@Json:'))
          return sourceRuleText(value, nested);
        return [...expression.matchAll(/(['"])([\s\S]*?)\1/g)]
          .map(match =>
            match[2]
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t')
              .replace(/\\(['"\\])/g, '$1'),
          )
          .join('');
      },
    );
    return rendered ? [applyReplacement(rendered, replacement)] : [];
  }
  const combined = splitOutside(main, '&&');
  if (combined.length > 1) {
    if (
      value !== null &&
      typeof value === 'object' &&
      combined.every(part => part.trim().startsWith('$'))
    )
      return combined.flatMap(part => sourceRuleValues(value, part));
    const text = combined
      .map(part => sourceRuleText(value, part))
      .filter(Boolean)
      .join('\n');
    return text ? [applyReplacement(text, replacement)] : [];
  }
  if (main.startsWith('@Json:'))
    return jsonPath(value, main.slice('@Json:'.length))
      .flatMap(item => (Array.isArray(item) ? item : [item]))
      .map(item =>
        typeof item === 'string' ? applyReplacement(item, replacement) : item,
      );
  if (main.startsWith('$'))
    return jsonPath(value, main)
      .flatMap(item => (Array.isArray(item) ? item : [item]))
      .map(item =>
        typeof item === 'string' ? applyReplacement(item, replacement) : item,
      );
  if (
    value !== null &&
    typeof value === 'object' &&
    !isNode(value) &&
    /^[A-Za-z_$][\w$]*(?:\[(?:\d+|\*)\]|\.[A-Za-z_$][\w$]*)*$/.test(main)
  )
    return jsonPath(value, `$.${main}`)
      .flatMap(item => (Array.isArray(item) ? item : [item]))
      .map(item =>
        typeof item === 'string' ? applyReplacement(item, replacement) : item,
      );
  if (typeof value === 'string' || isNode(value))
    return htmlValues(value, rule);
  return [];
}

export function sourceRuleText(value: unknown, rule: unknown) {
  const hit = sourceRuleValues(value, rule)[0];
  return hit === undefined || hit === null
    ? ''
    : isNode(hit)
      ? trimText(DomUtils.textContent(hit))
      : typeof hit === 'string'
        ? hit
        : String(hit);
}
