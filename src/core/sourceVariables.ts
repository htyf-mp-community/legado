import { SourceRuleError } from './errors';

const MAX_VARIABLE_TEXT = 1_000_000;
const MAX_VARIABLE_KEYS = 1024;

function decodeVariables(value?: string): Map<string, string> | undefined {
  if (!value) return new Map();
  if (value.length > MAX_VARIABLE_TEXT) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return new Map(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch { return undefined; }
}
export const parseSourceVariables = (value?: string) => decodeVariables(value) ?? new Map<string, string>();

export const serializeSourceVariables = (variables: Map<string, string>) =>
  variables.size ? JSON.stringify(Object.fromEntries(variables)) : undefined;

/** Apply snapshot deltas in chapter order without overwriting newer conflicting keys. */
export function mergeSourceVariables(base: string | undefined, current: string | undefined, updates: Array<string | undefined>) {
  const original = decodeVariables(base), live = decodeVariables(current);
  if (!original || !live || (base !== undefined && current === undefined)) return current;
  const merged = new Map(live);
  let changed = false;
  for (const update of updates) {
    if (update === undefined) continue;
    for (const [key, value] of parseSourceVariables(update)) {
      if (value === original.get(key) || live.get(key) !== original.get(key)) continue;
      if (merged.get(key) !== value) { merged.set(key, value); changed = true; }
    }
  }
  if (!changed) return current;
  const result = serializeSourceVariables(merged);
  if (merged.size > MAX_VARIABLE_KEYS || (result?.length ?? 0) > MAX_VARIABLE_TEXT)
    throw new SourceRuleError('JavaScript 变量大小或数量超过限制');
  return result;
}
