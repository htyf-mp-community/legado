// The BMP decimal digit ranges accepted by Java Character.digit in JDK 17.
const decimalStarts = [
  0x0030, 0x0660, 0x06f0, 0x07c0, 0x0966, 0x09e6, 0x0a66, 0x0ae6,
  0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0de6, 0x0e50, 0x0ed0,
  0x0f20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80,
  0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900,
  0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0xff10,
];

const chineseNumbers: Record<string, number> = {};
for (const digits of ['零一二三四五六七八九十', '〇壹贰叁肆伍陆柒捌玖拾']) {
  [...digits].forEach((digit, value) => { chineseNumbers[digit] = value; });
}
Object.assign(chineseNumbers, {'两':2, '百':100, '佰':100, '千':1000, '仟':1000, '万':10000, '亿':100000000});

function integerValue(input: string): number | undefined {
  let index = 0, negative = false, value = 0;
  if (input[0] === '-' || input[0] === '+') {
    negative = input[0] === '-';
    index++;
  }
  if (index === input.length) return undefined;
  const limit = negative ? 2147483648 : 2147483647;
  for (; index < input.length; index++) {
    const code = input.charCodeAt(index);
    const start = decimalStarts.find(number => code >= number && code < number + 10);
    if (start === undefined) return undefined;
    value = value * 10 + code - start;
    if (value > limit) return undefined;
  }
  return negative ? -value : value;
}

function chineseValue(input: string): number {
  let result = 0, temporary = 0, billion = 0;
  for (let i = 0; i < input.length; i++) {
    const number = chineseNumbers[input[i]];
    if (number === undefined) return -1;
    if (number === 100000000) {
      result = Math.imul((result + temporary) | 0, number);
      billion = (Math.imul(billion, 100000000) + result) | 0;
      result = 0;
      temporary = 0;
    } else if (number === 10000) {
      result = Math.imul((result + temporary) | 0, number);
      temporary = 0;
    } else if (number >= 10) {
      if (temporary === 0) temporary = 1;
      result = (result + Math.imul(number, temporary)) | 0;
      temporary = 0;
    } else {
      const previous = chineseNumbers[input[i - 1]];
      temporary = i >= 2 && i === input.length - 1 && previous > 10
        ? Math.trunc(Math.imul(number, previous) / 10)
        : (Math.imul(temporary, 10) + number) | 0;
    }
  }
  return (result + temporary + billion) | 0;
}

/** Mirrors JsExtensions.toNumChapter and StringUtils.stringToInt. */
export function sourceChapterNumber(input: string): string {
  // Java's reluctant (第)(.+?)(章) finds the earliest viable pair on one
  // line. Scanning avoids quadratic backtracking on long malformed titles.
  let start = -1, end = -1;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code === 10 || code === 13 || code === 0x85 || code === 0x2028 || code === 0x2029) start = -1;
    else if (input[i] === '第' && start < 0) start = i;
    else if (input[i] === '章' && start >= 0 && i > start + 1) { end = i; break; }
  }
  if (end < 0) return input;
  const normalized = input.slice(start + 1, end).replace(/[！-～]/g, character => String.fromCharCode(character.charCodeAt(0) - 65248))
    .replace(/\u3000/g, ' ').replace(/[ \t\n\v\f\r]+/g, '');
  return `第${integerValue(normalized) ?? chineseValue(normalized)}章`;
}
