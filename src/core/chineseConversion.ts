/** quick-transfer-core 0.2.17 / Apache-2.0. See docs/licenses/quick-transfer-NOTICE.txt. */
export type ChineseConverterType = 0 | 1 | 2;
type Table = { chars: string[][]; phrases: string[][]; maxLen: number };
type Data = { s2t: Table; t2s: Table; t2sExclusions: string[] };
type Dictionary = {
  chars: Map<string, string>;
  phrases: Map<string, string>;
  maxLen: number;
};
const dictionaries: Partial<Record<1 | 2, Dictionary>> = {};

function dictionary(mode: 1 | 2): Dictionary {
  const cached = dictionaries[mode];
  if (cached) return cached;
  // Keep the pinned 1.5 MB table module dormant while conversion is off.
  const data = require('../data/chineseConversionData.json') as Data;
  const table = mode === 1 ? data.t2s : data.s2t;
  const chars = new Map(table.chars.map(pair => [pair[0], pair[1]]));
  const phrases = new Map(table.phrases.map(pair => [pair[0], pair[1]]));
  if (mode === 1) {
    for (const word of data.t2sExclusions) {
      // BasicDictionary.remove does not increase the original maxLen.
      if (word.length === 1) chars.delete(word);
      else phrases.set(word, word);
    }
  }
  const result = { chars, phrases, maxLen: table.maxLen };
  dictionaries[mode] = result;
  return result;
}

/** Same bounded longest UTF-16 prefix match, then single-char fallback, as BasicDictionary. */
export function convertChinese(
  input: string,
  mode: ChineseConverterType,
): string {
  if (mode !== 1 && mode !== 2) return input;
  const table = dictionary(mode),
    output: string[] = [];
  for (let start = 0; start < input.length; ) {
    let matched = false;
    for (
      let end = Math.min(input.length, start + table.maxLen);
      end > start;
      end -= 1
    ) {
      const replacement = table.phrases.get(input.slice(start, end));
      if (replacement !== undefined) {
        output.push(replacement);
        start = end;
        matched = true;
        break;
      }
    }
    if (!matched) {
      output.push(table.chars.get(input[start]) ?? input[start]);
      start += 1;
    }
  }
  return output.join('');
}

/** BookChapter strips CR/LF, converts, then applies its title rules. */
export function displayChapterTitle(
  input: string,
  mode: ChineseConverterType,
  replace: (value: string) => string = value => value,
): string {
  return replace(convertChinese(input.replace(/[\r\n]/g, ''), mode));
}
