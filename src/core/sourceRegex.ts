/**
 * Compile the source rule's leading i/m/s flags and Java Pattern dollar anchor.
 * Java's non-multiline $ also matches before the final line terminator; JS's
 * non-multiline $ only matches the absolute end. Other syntax is still subject
 * to the JavaScript regex limitations recorded in the migration gaps.
 * additionalFlags enables explicit JS features such as Unicode property classes.
 */
export function compileSourceRegex(pattern: string, additionalFlags = ''): RegExp {
  let flags = 'g' + additionalFlags;
  const body = pattern.replace(/^\(\?([ims]+)\)/, (_, value: string) => {
    flags += value;
    return '';
  });
  let translated = '', inClass = false;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === '\\' && i + 1 < body.length) {
      const escaped = body[++i];
      // Java's default whitespace class is ASCII, unlike JavaScript's Unicode \s.
      if (escaped === 's') translated += inClass ? '\\t\\n\\x0B\\f\\r ' : '[\\t\\n\\x0B\\f\\r ]';
      else if (escaped === 'S') translated += inClass
        ? '\\x00-\\x08\\x0E-\\x1F\\x21-\\uFFFF' + (flags.includes('u') ? '\\u{10000}-\\u{10FFFF}' : '')
        : '[^\\t\\n\\x0B\\f\\r ]';
      else translated += char + escaped;
      continue;
    }
    if (char === '[') inClass = true;
    if (char === ']') inClass = false;
    translated += char === '$' && !inClass
      ? flags.includes('m')
        ? '(?=$|\\u0085)'
        : '(?=$|(?:\\r\\n|[\\n\\r\\u0085\\u2028\\u2029])$)'
      : char;
  }
  return new RegExp(translated, [...new Set(flags)].join(''));
}
