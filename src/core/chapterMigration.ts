// BookHelp.getDurChapter / StringUtils in the read-only source are the reference.
const fullToHalf = (value: string) =>
  value
    .replace(/\u3000/g, ' ')
    .replace(/[\uff01-\uff5e]/g, character =>
      String.fromCharCode(character.charCodeAt(0) - 65248),
    );
const space = /[\t\n\v\f\r ]/g;
// Keep the source's exact regex spelling, including its extended-CJK escapes.
const prefix = new RegExp(
  String.raw`^.*?第(?:[\d零〇一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+)[章节篇回集话](?!$)|^(?:[\d零〇一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+[,:、])*(?:[\d零〇一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+)(?:[,:、](?!$)|\.(?=[^\d]))`,
  'g',
);
const extras = new RegExp(
  String.raw`(?!^)(?:[〖【《〔\[{(][^〖【《〔\[{()〕》】〗\]}]+)?[)〕》】〗\]}]$|^[〖【《〔\[{(](?:[^〖【《〔\[{()〕》】〗\]}]+[〕》】〗\]})])?(?!$)`,
  'g',
);
const other = new RegExp(
  String.raw`[^\w\u4E00-\u9FEF〇\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2EBEF]`,
  'gu',
);
export const pureMigrationChapterTitle = (value?: string) =>
  fullToHalf(value ?? '')
    .replace(space, '')
    .replace(prefix, '')
    .replace(extras, '')
    .replace(other, '');
const digits = new Map<string, number>();
for (const characters of ['零一二三四五六七八九十', '〇壹贰叁肆伍陆柒捌玖拾'])
  [...characters].forEach((character, index) => digits.set(character, index));
for (const [character, number] of [
  ['两', 2],
  ['百', 100],
  ['佰', 100],
  ['千', 1000],
  ['仟', 1000],
  ['万', 10000],
  ['亿', 100000000],
] as const)
  digits.set(character, number);
function nativeNumber(value: string) {
  if (/^[+-]?\d+$/.test(value)) {
    const parsed = Number(value);
    if (
      Number.isInteger(parsed) &&
      parsed >= -2147483648 &&
      parsed <= 2147483647
    )
      return parsed;
  }
  let result = 0,
    temporary = 0,
    billion = 0;
  for (let index = 0; index < value.length; index++) {
    const number = digits.get(value[index]);
    if (number === undefined) return -1;
    if (number === 100000000) {
      result = Math.imul((result + temporary) | 0, number);
      billion = (Math.imul(billion, number) + result) | 0;
      result = temporary = 0;
    } else if (number === 10000) {
      result = Math.imul((result + temporary) | 0, number);
      temporary = 0;
    } else if (number >= 10) {
      result = (result + Math.imul(number, temporary || 1)) | 0;
      temporary = 0;
    } else {
      const previous = digits.get(value[index - 1]) ?? 0;
      temporary =
        index >= 2 && index === value.length - 1 && previous > 10
          ? Math.trunc((number * previous) / 10)
          : (Math.imul(temporary, 10) + number) | 0;
    }
  }
  return (result + temporary + billion) | 0;
}
export function migrationChapterNumber(value?: string) {
  const normalized = fullToHalf(value ?? '').replace(space, ''),
    match =
      normalized.match(
        /.*?第([\d零〇一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+)[章节篇回集话]/,
      ) ??
      normalized.match(
        /^(?:[\d零〇一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+[,:、])*([\d零〇一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+)(?:[,:、]|\.[^\d])/,
      );
  return match ? nativeNumber(match[1]) : -1;
}
function similarity(left: string, right: string) {
  // Commons Text 1.13.1 compares UTF-16 Character sets, not code-point sequences.
  const a = new Set(left.split('')),
    b = new Set(right.split(''));
  if (!a.size && !b.size) return 1;
  const union = new Set([...a, ...b]);
  return (a.size + b.size - union.size) / union.size;
}
export function migrationChapterIndex(
  oldIndex: number,
  oldTitle: string | undefined,
  chapters: ReadonlyArray<{ title: string }>,
  oldCount = 0,
  searchAllNumbers = false,
) {
  if (oldIndex <= 0) return 0;
  if (!chapters.length) return oldIndex;
  const number = migrationChapterNumber(oldTitle),
    expected =
      oldCount === 0
        ? oldIndex
        : Number(
            BigInt.asIntN(
              32,
              (BigInt(oldIndex) * BigInt(chapters.length)) / BigInt(oldCount),
            ),
          ),
    start = Math.max(0, (Math.min(oldIndex, expected) - 10) | 0),
    end = Math.min(
      chapters.length - 1,
      (Math.max(oldIndex, expected) + 10) | 0,
    ),
    title = pureMigrationChapterTitle(oldTitle);
  let best = 0,
    score = 0;
  if (title) {
    for (let index = start; index <= end; index++) {
      const value = similarity(
        title,
        pureMigrationChapterTitle(chapters[index].title),
      );
      if (
        value > score ||
        (value === score &&
          distance(index, expected) < distance(best, expected))
      ) {
        score = value;
        best = index;
      }
    }
    if (score > 0.96) return best;
  }
  if (number > 0) {
    if (searchAllNumbers) {
      let match: number | undefined;
      chapters.forEach((chapter, index) => {
        if (
          migrationChapterNumber(chapter.title) === number &&
          (match === undefined ||
            distance(index, expected) < distance(match, expected))
        )
          match = index;
      });
      if (match !== undefined) return match;
    }
    for (let index = start; index <= end; index++)
      if (migrationChapterNumber(chapters[index].title) === number)
        return index;
  }
  return Math.min(chapters.length - 1, oldIndex);
}
const distance = (index: number, expected: number) =>
  Math.abs((index - expected) | 0) | 0;
