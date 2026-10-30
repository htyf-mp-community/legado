/** The replacement-string grammar of Matcher.appendReplacement (not JS replace). */
export function expandJavaReplacement(
  replacement: string,
  match: RegExpMatchArray,
): string {
  let result = '';
  for (let cursor = 0; cursor < replacement.length; cursor++) {
    const char = replacement[cursor];
    if (char === '\\') {
      if (++cursor === replacement.length) throw new Error('character to be escaped is missing');
      result += replacement[cursor];
    } else if (char === '$') {
      const next = replacement[++cursor];
      if (next === '{') {
        const end = replacement.indexOf('}', cursor + 1);
        const name = end < 0 ? '' : replacement.slice(cursor + 1, end);
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name) || !Object.prototype.hasOwnProperty.call(match.groups ?? {}, name))
          throw new Error('named capturing group is missing or invalid');
        result += match.groups?.[name] ?? '';
        cursor = end;
      } else {
        if (!next || next < '0' || next > '9') throw new Error('Illegal group reference');
        let group = Number(next);
        if (group >= match.length) throw new Error(`No group ${group}`);
        while (cursor + 1 < replacement.length && /[0-9]/.test(replacement[cursor + 1])) {
          const candidate = group * 10 + Number(replacement[cursor + 1]);
          if (candidate >= match.length) break;
          group = candidate;
          cursor++;
        }
        result += match[group] ?? '';
      }
    } else result += char;
  }
  return result;
}

export function replaceJavaGroups(input: string, expression: RegExp, replacement: string) {
  let result = '', previousEnd = 0;
  for (const match of input.matchAll(expression)) {
    result += input.slice(previousEnd, match.index) + expandJavaReplacement(replacement, match);
    previousEnd = match.index + match[0].length;
  }
  return result + input.slice(previousEnd);
}
