import { SourceRuleError } from './errors';

const MAX_ITEMS = 8_000;
const MAX_DEPTH = 20;
const MAX_TEXT = 1_000_000;

/** Parse first, then validate before copying the result into the interpreter. */
export function parseBoundedJson(runtime: any, value: unknown, reviver: any): unknown {
  if (reviver?.class === 'Function')
    throw new SourceRuleError('JavaScript JSON reviver 暂不支持');
  let input = value;
  if (input && typeof input === 'object') {
    if (runtime.isa(input, runtime.STRING) || runtime.isa(input, runtime.NUMBER) || runtime.isa(input, runtime.BOOLEAN))
      input = (input as {data: unknown}).data;
    else throw new SourceRuleError('JavaScript JSON 对象转换暂不支持');
  }
  const text = String(input);
  if (text.length > MAX_TEXT) throw new SourceRuleError('JavaScript JSON 输入超过限制');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return runtime.throwException(runtime.SYNTAX_ERROR, error instanceof Error ? error.message : 'JSON 格式无效');
  }
  const pending = [{ value: parsed, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++count > MAX_ITEMS || item.depth > MAX_DEPTH)
      throw new SourceRuleError('JavaScript JSON 结构超过限制');
    if (item.value && typeof item.value === 'object') {
      const children = Object.values(item.value);
      if (children.length > MAX_ITEMS || count + pending.length + children.length > MAX_ITEMS)
        throw new SourceRuleError('JavaScript JSON 结构超过限制');
      children.forEach(child => pending.push({ value: child, depth: item.depth + 1 }));
    }
  }
  return runtime.nativeToPseudo(parsed);
}

/** Convert an interpreter value into an acyclic, size-limited JSON value. */
export function stringifyBoundedJson(runtime: any, input: any, replacer: any, space: unknown, defaultDateToJSON: unknown): string | undefined {
  if (replacer?.class === 'Function')
    throw new SourceRuleError('JavaScript JSON 函数替换暂不支持');
  let keys: string[] | undefined;
  if (replacer?.class === 'Array') {
    const length = Number(runtime.getProperty(replacer, 'length'));
    if (length > MAX_ITEMS) throw new SourceRuleError('JavaScript JSON 替换列表超过限制');
    const unique = new Set<string>();
    for (let index = 0; index < length; index += 1) {
      const item = readDataProperty(replacer, String(index));
      const primitive = item && typeof item === 'object' && (runtime.isa(item, runtime.STRING) || runtime.isa(item, runtime.NUMBER)) ? item.data : item;
      if (typeof primitive === 'string' || typeof primitive === 'number') unique.add(String(primitive));
    }
    keys = [...unique];
  }
  const indentation = typeof space === 'number'
    ? ' '.repeat(Math.min(10, Math.max(0, Math.floor(space) || 0)))
    : typeof space === 'string' ? space.slice(0, 10) : '';
  const ancestors = new Set<object>();
  let count = 0, size = 0;
  const charge = (amount: number) => {
    size += amount;
    if (size > MAX_TEXT) throw new SourceRuleError('JavaScript JSON 输出超过限制');
  };
  const chargeString = (text: string) => {
    charge(2);
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code === 34 || code === 92 || code === 8 || code === 9 || code === 10 || code === 12 || code === 13) charge(2);
      else if (code < 32) charge(6);
      else if (code >= 0xd800 && code <= 0xdbff) {
        const next = text.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) { charge(2); index += 1; }
        else charge(6);
      } else if (code >= 0xdc00 && code <= 0xdfff) charge(6);
      else charge(1);
    }
  };
  const clone = (value: any, depth: number): unknown => {
    if (++count > MAX_ITEMS || depth > MAX_DEPTH) throw new SourceRuleError('JavaScript JSON 结构超过限制');
    charge(4 + indentation.length * (depth + 1));
    if (value === undefined || (value && typeof value === 'object' && value.class === 'Function')) return undefined;
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { charge(25); return Number.isFinite(value) ? value : null; }
    if (typeof value === 'string') { chargeString(value); return value; }
    if (!value || typeof value !== 'object' || !value.properties)
      throw new SourceRuleError('JavaScript JSON 对象不可序列化');
    const isDate = runtime.isa(value, runtime.DATE);
    const toJSON = readDataProperty(value, 'toJSON');
    const defaultDate = isDate && toJSON === defaultDateToJSON;
    if (toJSON?.class === 'Function' && !defaultDate)
      throw new SourceRuleError('JavaScript JSON toJSON 暂不支持');
    if (runtime.isa(value, runtime.STRING) || runtime.isa(value, runtime.NUMBER) || runtime.isa(value, runtime.BOOLEAN))
      return clone(value.data, depth + 1);
    if (defaultDate) {
      const date = value.data as Date;
      const result = Number.isFinite(date.valueOf()) ? date.toISOString() : null;
      if (result) chargeString(result);
      return result;
    }
    if (ancestors.has(value)) return runtime.throwException(runtime.TYPE_ERROR, 'Converting circular structure to JSON');
    ancestors.add(value);
    try {
      if (value.class === 'Array') {
        const length = Number(runtime.getProperty(value, 'length'));
        if (length > MAX_ITEMS) throw new SourceRuleError('JavaScript JSON 数组超过限制');
        return Array.from({ length }, (_, index) => clone(readDataProperty(value, String(index)), depth + 1) ?? null);
      }
      const result: Record<string, unknown> = Object.create(null);
      for (const key of keys ?? Object.keys(value.properties)) {
        const item = readDataProperty(value, key);
        if (item === undefined || item?.class === 'Function') continue;
        chargeString(key);
        const converted = clone(item, depth + 1);
        if (converted !== undefined) result[key] = converted;
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  };
  const result = JSON.stringify(clone(input, 0), keys, indentation || undefined);
  if (result !== undefined && result.length > MAX_TEXT)
    throw new SourceRuleError('JavaScript JSON 输出超过限制');
  return result;
}

/** Read interpreter data without executing user-defined getters in native code. */
function readDataProperty(value: any, name: string): any {
  const seen = new Set<object>();
  for (let current = value; current; current = current.proto) {
    if (seen.has(current) || seen.size > MAX_DEPTH)
      throw new SourceRuleError('JavaScript JSON 原型链超过限制');
    seen.add(current);
    if (Object.prototype.hasOwnProperty.call(current.getter ?? {}, name) && current.getter[name])
      throw new SourceRuleError('JavaScript JSON 访问器暂不支持');
    if (Object.prototype.hasOwnProperty.call(current.properties ?? {}, name))
      return current.properties[name];
  }
  return undefined;
}
