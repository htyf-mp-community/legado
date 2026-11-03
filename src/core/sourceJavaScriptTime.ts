import {SourceRuleError} from './errors';

const pad = (value: number, length: number) => String(value).padStart(length, '0');
function dateFor(time: number) {
  const value = new Date(time);
  if (!Number.isFinite(value.getTime())) throw new SourceRuleError('JavaScript 时间超出支持范围');
  return value;
}

/** AppConst.dateFormat uses the device's local timezone. */
export function formatSourceLocalTime(time: number) {
  const date = dateFor(time);
  return `${pad(date.getFullYear(),4)}/${pad(date.getMonth()+1,2)}/${pad(date.getDate(),2)} ${pad(date.getHours(),2)}:${pad(date.getMinutes(),2)}`;
}

/** Supported SimpleDateFormat fields used by book-source timestamps. Offset is milliseconds. */
export function formatSourceUtcTime(time: number, pattern: string, offset: number) {
  const date = dateFor(time + offset), year = date.getUTCFullYear();
  let result = '', quoted = false;
  for (let index = 0; index < pattern.length;) {
    const char = pattern[index];
    if (char === "'") {
      if (pattern[index+1] === "'") { result += "'"; index += 2; }
      else { quoted = !quoted; index++; }
      continue;
    }
    if (quoted || !/[A-Za-z]/.test(char)) { result += char; index++; continue; }
    let end = index + 1;
    while (pattern[end] === char) end++;
    const width = end-index;
    let field: number;
    if (char === 'Z' || char === 'X') {
      if (char === 'X' && width > 3) throw new SourceRuleError('JavaScript 时间格式无效');
      const totalMinutes = Math.floor(Math.abs(offset) / 60_000);
      const hours = pad(Math.floor(totalMinutes / 60), 2), minutes = pad(totalMinutes % 60, 2);
      const sign = offset < 0 ? '-' : '+';
      result += char === 'X' && offset === 0 ? 'Z'
        : sign + hours + (char === 'Z' || width === 2 ? minutes : width === 3 ? `:${minutes}` : '');
      if (result.length > 64_000) throw new SourceRuleError('JavaScript 时间格式超过限制');
      index = end;
      continue;
    }
    switch (char) {
      case 'y': field = year > 0 ? year : 1-year; if (width === 2) field %= 100; break;
      case 'M': if (width > 2) throw new SourceRuleError('JavaScript 时间格式暂不支持月份名称'); field = date.getUTCMonth()+1; break;
      case 'd': field = date.getUTCDate(); break;
      case 'D': {
        const month = date.getUTCMonth();
        const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        field = [0,31,59,90,120,151,181,212,243,273,304,334][month] + date.getUTCDate() + (leap && month > 1 ? 1 : 0);
        break;
      }
      case 'F': field = Math.floor((date.getUTCDate() - 1) / 7) + 1; break;
      case 'H': field = date.getUTCHours(); break;
      case 'k': field = date.getUTCHours() || 24; break;
      case 'K': field = date.getUTCHours()%12; break;
      case 'h': field = date.getUTCHours()%12 || 12; break;
      case 'm': field = date.getUTCMinutes(); break;
      case 's': field = date.getUTCSeconds(); break;
      case 'S': field = date.getUTCMilliseconds(); break;
      case 'u': field = date.getUTCDay() || 7; break;
      default: throw new SourceRuleError(`JavaScript 时间格式暂不支持 ${char}`);
    }
    result += pad(field, width === 2 && char === 'y' ? 2 : width);
    if (result.length > 64_000) throw new SourceRuleError('JavaScript 时间格式超过限制');
    index = end;
  }
  if (quoted) throw new SourceRuleError('JavaScript 时间格式引号未闭合');
  return result;
}
