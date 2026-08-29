import { UnsupportedRuleError } from './errors';

const select = (values: unknown[], raw: string): unknown[] => {
  const match = raw.match(/^([^\[]+)?(?:\[(\*|\d+)\])?$/);
  if (!match) throw new UnsupportedRuleError(`JSONPath ${raw}`);
  const [, key, index] = match;
  return values.flatMap(item => {
    let target = item;
    if (key) {
      if (!target || typeof target !== 'object') return [];
      target = (target as Record<string, unknown>)[key];
    }
    if (index === '*') return Array.isArray(target) ? target : [];
    if (index !== undefined)
      return Array.isArray(target) && target[Number(index)] !== undefined
        ? [target[Number(index)]]
        : [];
    return target === undefined || target === null ? [] : [target];
  });
};

const descendants = (value: unknown): unknown[] => {
  if (!value || typeof value !== 'object') return [];
  const children = Array.isArray(value)
    ? value
    : Object.values(value as Record<string, unknown>);
  return [...children, ...children.flatMap(descendants)];
};

export function jsonPath(value: unknown, rule: string): unknown[] {
  const compact = rule.trim();
  if (compact.includes('@js:') || compact.includes('<js>'))
    throw new UnsupportedRuleError('JavaScript');
  if (!compact.startsWith('$'))
    throw new UnsupportedRuleError('CSS/XPath/正则');
  const recursive = compact.startsWith('$..'),
    text = compact.replace(recursive ? /^\$\.\./ : /^\$\.?/, '');
  if (!text) return [value];
  const segments = text.split('.');
  let current = recursive ? [value, ...descendants(value)] : [value];
  for (const segment of segments) current = select(current, segment);
  return current;
}

export const jsonText = (value: unknown, rule: unknown) => {
  if (typeof rule !== 'string' || !rule.trim()) return '';
  const hit = jsonPath(value, rule)[0];
  return hit === undefined || hit === null
    ? ''
    : typeof hit === 'string'
      ? hit
      : String(hit);
};
