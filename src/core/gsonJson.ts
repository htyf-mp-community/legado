/** Exact Gson tokens; ordered object entries also retain duplicate reflective field assignments. */
export type GsonJsonValue =
  | { kind: 'string'; value: string }
  | { kind: 'literal'; value: string }
  | { kind: 'array'; values: GsonJsonValue[] }
  | {
      kind: 'object';
      values: Map<string, GsonJsonValue>;
      entries: Array<[string, GsonJsonValue]>;
    };
/** Gson JsonWriter string escaping, including U+2028/U+2029. */
export const quoteGsonString = (value: string) =>
  JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
/** Compact JsonElement text; duplicate object keys retain their first position and last value. */
export const compactGsonJson = (value: GsonJsonValue): string =>
  value.kind === 'string'
    ? quoteGsonString(value.value)
    : value.kind === 'literal'
      ? value.value
      : value.kind === 'array'
        ? `[${value.values.map(compactGsonJson).join(',')}]`
        : `{${[...value.values].map(([key, item]) => `${quoteGsonString(key)}:${compactGsonJson(item)}`).join(',')}}`;

/**
 * Gson legacy-lenient JSON tree with exact number lexemes and ordered duplicate members.
 * `values` models JsonObject compact strings; `entries` models reflective stream field writes.
 * Throws for malformed input or trailing data. No storage or evaluation side effects.
 */
export function parseGsonLegacyJson(input: string): GsonJsonValue {
  let position = input.charCodeAt(0) === 0xfeff ? 1 : 0;
  const fail = (): never => {
    throw new Error('Invalid Gson JSON');
  };
  const skip = () => {
    for (;;) {
      while (/[\t\n\r ]/.test(input[position] ?? '') && position < input.length)
        position++;
      if (
        input[position] === '#' ||
        input.slice(position, position + 2) === '//'
      ) {
        while (position < input.length && !/[\n\r]/.test(input[position]))
          position++;
      } else if (input.slice(position, position + 2) === '/*') {
        const end = input.indexOf('*/', position + 2);
        if (end < 0) fail();
        position = end + 2;
      } else return;
    }
  };
  const string = () => {
    const delimiter = input[position++];
    let result = '';
    while (position < input.length) {
      const char = input[position++];
      if (char === delimiter) return result;
      if (char !== '\\') {
        result += char;
        continue;
      }
      const escape = input[position++];
      if (escape === 'u') {
        const code = input.slice(position, position + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(code)) fail();
        result += String.fromCharCode(parseInt(code, 16));
        position += 4;
      } else {
        const escapes: Record<string, string> = {
          b: '\b',
          f: '\f',
          n: '\n',
          r: '\r',
          t: '\t',
          '"': '"',
          "'": "'",
          '/': '/',
          '\\': '\\',
          '\n': '\n',
          '\r': '\r',
        };
        if (!Object.hasOwn(escapes, escape)) fail();
        result += escapes[escape];
      }
    }
    return fail();
  };
  const word = () => {
    const start = position;
    while (
      position < input.length &&
      !/[\t\n\f\r \[\]{}:,;#=\/\\]/.test(input[position])
    )
      position++;
    if (position === start) fail();
    return input.slice(start, position);
  };
  const value = (): GsonJsonValue => {
    skip();
    const char = input[position];
    if (char === '"' || char === "'")
      return { kind: 'string', value: string() };
    if (char === '[') {
      position++;
      const values: GsonJsonValue[] = [];
      skip();
      if (input[position] === ']') {
        position++;
        return { kind: 'array', values };
      }
      for (;;) {
        skip();
        if (
          input[position] === ',' ||
          input[position] === ';' ||
          input[position] === ']'
        )
          values.push({ kind: 'literal', value: 'null' });
        else values.push(value());
        skip();
        if (input[position] === ']') {
          position++;
          break;
        }
        if (input[position] !== ',' && input[position] !== ';') fail();
        position++;
      }
      return { kind: 'array', values };
    }
    if (char === '{') {
      position++;
      const values = new Map<string, GsonJsonValue>();
      const entries: Array<[string, GsonJsonValue]> = [];
      skip();
      if (input[position] === '}') {
        position++;
        return { kind: 'object', values, entries };
      }
      for (;;) {
        skip();
        const key =
          input[position] === '"' || input[position] === "'"
            ? string()
            : word();
        skip();
        if (input[position] !== ':' && input[position] !== '=') fail();
        const separator = input[position++];
        if (separator === '=' && input[position] === '>') position++;
        const item = value();
        values.set(key, item);
        entries.push([key, item]);
        skip();
        if (input[position] === '}') {
          position++;
          break;
        }
        if (input[position] !== ',' && input[position] !== ';') fail();
        position++;
      }
      return { kind: 'object', values, entries };
    }
    const token = word(),
      lower = token.toLowerCase();
    return /^(?:true|false|null)$/.test(lower)
      ? { kind: 'literal', value: lower }
      : /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(token)
        ? { kind: 'literal', value: token }
        : { kind: 'string', value: token };
  };
  skip();
  if (input.slice(position, position + 5) === ")]}'\n") position += 5;
  const result = value();
  skip();
  if (position !== input.length) fail();
  return result;
}
