import {SourceRuleError} from './errors';

// Private primitive-to-string helper; script changes to String do not affect it.
export const TEMPLATE_STRING = '__legado_template_string_intrinsic__';

/** Lower untagged templates to ES5 while preserving interpolation order. */
export function lowerSourceTemplates(source: string, parseEs5: (source: string) => unknown): string {
  if (!source.includes('`')) return source;
  // Existing valid ES5 programs may contain backticks in strings or regexps.
  // Preserve them untouched, even when their tokenization is ambiguous here.
  try {parseEs5(source); return source;} catch (_) { /* May contain a template. */ }
  if (source.includes(TEMPLATE_STRING)) throw new SourceRuleError('JavaScript 模板字符串包含保留名称');
  let position = 0;
  let nesting = 0;
  const fail = (): never => {throw new SourceRuleError('JavaScript 模板字符串语法无效或不支持');};
  const quoted = (s: string) => JSON.stringify(s).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const hex = (n: number) => {
    const digits = source.slice(position, position + n);
    if (digits.length !== n || !/^[\da-f]+$/i.test(digits)) return fail();
    position += n;
    return String.fromCharCode(parseInt(digits, 16));
  };
  const template = (): string => {
    if (++nesting > 64) return fail();
    position++; // opening backtick
    const pieces: string[] = [];
    let text = '';
    while (position < source.length) {
      const ch = source[position++];
      if (ch === '`') {
        pieces.push(quoted(text));
        nesting--;
        return `(${pieces.join('+')})`;
      }
      if (ch === '$' && source[position] === '{') {
        position++;
        pieces.push(quoted(text));
        text = '';
        const expression = code(true);
        if (!expression.trim()) return fail();
        pieces.push(`${TEMPLATE_STRING}((${expression}))`);
      } else if (ch === '\\') {
        if (position >= source.length) return fail();
        const escaped = source[position++];
        const simple: Record<string, string> = {n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v'};
        if (escaped in simple) text += simple[escaped];
        else if (escaped === 'x') text += hex(2);
        else if (escaped === 'u') {
          if (source[position] === '{') {
            position++;
            const end = source.indexOf('}', position);
            const digits = end < 0 ? '' : source.slice(position, end);
            if (!/^[\da-f]{1,6}$/i.test(digits) || parseInt(digits, 16) > 0x10ffff) return fail();
            text += String.fromCodePoint(parseInt(digits, 16));
            position = end + 1;
          } else text += hex(4);
        } else if (escaped === '0') {
          if (/\d/.test(source[position] ?? '')) return fail();
          text += '\0';
        } else if (/[1-9]/.test(escaped)) return fail();
        else if (escaped === '\r') {if (source[position] === '\n') position++;}
        else if (escaped !== '\n' && escaped !== '\u2028' && escaped !== '\u2029') text += escaped;
      } else if (ch === '\r') {
        if (source[position] === '\n') position++;
        text += '\n';
      } else text += ch;
    }
    return fail();
  };
  const code = (stopAtBrace: boolean): string => {
    let output = '';
    let braces = 0;
    let canEnd = false;
    let controlKeyword = false;
    let lastBrace = false;
    const parens: boolean[] = [];
    while (position < source.length) {
      const ch = source[position];
      if (ch === '}' && stopAtBrace && braces === 0) {position++; return output;}
      if (/\s/.test(ch)) {output += ch; position++; continue;}
      if (ch === '/' && (source[position + 1] === '/' || source[position + 1] === '*')) {
        const line = source[position + 1] === '/';
        const start = position;
        position += 2;
        if (line) while (position < source.length && !/[\r\n\u2028\u2029]/.test(source[position])) position++;
        else {
          const end = source.indexOf('*/', position);
          if (end < 0) return fail();
          position = end + 2;
        }
        output += source.slice(start, position);
        continue;
      }
      // A slash after `}` may start a statement regexp or divide an object.
      // Without a full ES parser it is unsafe to guess which one it is.
      if (ch === '/' && lastBrace) return fail();
      lastBrace = false;
      if (ch === "'" || ch === '"') {
        const start = position++;
        let closed = false;
        while (position < source.length) {
          const c = source[position++];
          if (c === '\\') {
            if (position < source.length && source[position++] === '\r' && source[position] === '\n') position++;
          }
          else if (c === ch) {closed = true; break;}
          else if (/[\r\n\u2028\u2029]/.test(c)) return fail();
        }
        if (!closed) return fail();
        output += source.slice(start, position); canEnd = true; controlKeyword = false; continue;
      }
      if (ch === '`') {
        if (canEnd) return fail(); // Tagged templates require the raw strings array.
        output += template(); canEnd = true; controlKeyword = false; continue;
      }
      if (ch === '/' && !canEnd) {
        const start = position++;
        let inClass = false, closed = false;
        while (position < source.length) {
          const c = source[position++];
          if (c === '\\') {if (position < source.length) position++;}
          else if (/[\r\n\u2028\u2029]/.test(c)) return fail();
          else if (c === '[') inClass = true;
          else if (c === ']') inClass = false;
          else if (c === '/' && !inClass) {closed = true; break;}
        }
        if (!closed) return fail();
        while (/[a-z]/i.test(source[position] ?? '')) position++;
        output += source.slice(start, position); canEnd = true; controlKeyword = false; continue;
      }
      if (/[a-z_$]/i.test(ch)) {
        const start = position++;
        while (/[\w$]/.test(source[position] ?? '')) position++;
        const word = source.slice(start, position);
        output += word;
        controlKeyword = /^(if|while|for|with|switch|catch)$/.test(word);
        canEnd = !/^(return|throw|case|delete|void|typeof|new|in|instanceof|else|do|var|function|if|while|for|with|switch|catch)$/.test(word);
        continue;
      }
      if (/\d/.test(ch)) {
        const start = position++;
        while (/[\w.]/.test(source[position] ?? '')) position++;
        output += source.slice(start, position); canEnd = true; controlKeyword = false; continue;
      }
      // Unicode identifiers would require full identifier classification to
      // distinguish an untagged template from a tagged one.
      if (ch.charCodeAt(0) > 127) return fail();
      if (ch === '(') {parens.push(controlKeyword); canEnd = false;}
      else if (ch === ')') canEnd = !(parens.pop() ?? false);
      else if (ch === '{') {braces++; canEnd = false;}
      else if (ch === '}') {braces--; canEnd = true; lastBrace = true;}
      else if (ch === ']') canEnd = true;
      else if ((ch === '+' || ch === '-') && source[position + 1] === ch) {
        output += ch; position++; // Prefix retains false, postfix retains true.
      } else canEnd = false;
      output += ch; position++; controlKeyword = false;
    }
    if (stopAtBrace) return fail();
    return output;
  };
  const result = code(false);
  if (result.length > 131_072) throw new SourceRuleError('JavaScript 模板字符串过长');
  return result;
}
