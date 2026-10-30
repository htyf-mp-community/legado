// Port of the source-bundled ICU recognizers: Unicode/IBM copyright and
// permission notice are retained in docs/licenses/icu-Unicode.txt.
import tables from '../data/sourceCharsetData.json';

export type SourceCharsetMatch = { name: string; confidence: number; lang: string | null };

function unicodeConfidence(bytes: Uint8Array, little: boolean, width: 2 | 4) {
  if (width === 2) {
    let confidence = 10;
    const length = Math.min(bytes.length, 30);
    for (let i = 0; i < length - 1; i += 2) {
      const unit = little ? (bytes[i + 1] << 8) | bytes[i] : (bytes[i] << 8) | bytes[i + 1];
      if (!i && unit === 0xfeff) { confidence = 100; break; }
      if (!unit) confidence -= 10;
      else if ((unit >= 0x20 && unit <= 0xff) || unit === 10) confidence += 10;
      confidence = Math.max(0, Math.min(100, confidence));
      if (confidence === 0 || confidence === 100) break;
    }
    return length < 4 && confidence < 100 ? 0 : confidence;
  }
  const length = Math.trunc(bytes.length / 4) * 4;
  let valid = 0, invalid = 0, bom = false;
  for (let i = 0; i < length; i += 4) {
    const unit = little ? (bytes[i + 3] << 24) | (bytes[i + 2] << 16) | (bytes[i + 1] << 8) | bytes[i]
      : (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
    if (!i && unit === 0xfeff) bom = true;
    if (unit < 0 || unit >= 0x10ffff || (unit >= 0xd800 && unit <= 0xdfff)) invalid++;
    else valid++;
  }
  return !length ? 0 : bom && !invalid ? 100 : bom && valid > invalid * 10 ? 80
    : valid > 3 && !invalid ? 100 : valid && !invalid ? 80 : valid > invalid * 10 ? 25 : 0;
}

function utf8Confidence(bytes: Uint8Array) {
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  let valid = 0, invalid = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (!(byte & 0x80)) continue;
    let trail = (byte & 0xe0) === 0xc0 ? 1 : (byte & 0xf0) === 0xe0 ? 2 : (byte & 0xf8) === 0xf0 ? 3 : 0;
    if (!trail) { invalid++; continue; }
    while (++i < bytes.length) {
      if ((bytes[i] & 0xc0) !== 0x80) { invalid++; break; }
      if (!--trail) { valid++; break; }
    }
  }
  return bom && !invalid ? 100 : bom && valid > invalid * 10 ? 80 : valid > 3 && !invalid ? 100
    : valid && !invalid ? 80 : !valid && !invalid ? 15 : valid > invalid * 10 ? 25 : 0;
}

function iso2022Confidence(input: Uint8Array, sequences: number[][]) {
  let hits = 0, misses = 0, shifts = 0;
  scan: for (let i = 0; i < input.length; i++) {
    if (input[i] === 0x1b) {
      for (const sequence of sequences) {
        if (input.length - i >= sequence.length && sequence.every((b, j) => !j || b === input[i + j])) {
          hits++; i += sequence.length - 1; continue scan;
        }
      }
      misses++;
    }
    if (input[i] === 14 || input[i] === 15) shifts++;
  }
  return !hits ? 0 : Math.max(0, Math.trunc((100 * hits - 100 * misses) / (hits + misses)) - Math.max(0, 5 - hits - shifts) * 10);
}

type MbcsKind = keyof typeof tables.mbcs;
const commonChars = Object.fromEntries(Object.entries(tables.mbcs).map(([key, values]) => [key, new Set(values)])) as Record<MbcsKind, Set<number>>;

function mbcsConfidence(input: Uint8Array, kind: MbcsKind) {
  let next = 0, done = false, double = 0, common = 0, bad = 0, total = 0;
  const byte = () => { if (next >= input.length) { done = true; return -1; } return input[next++]; };
  while (!done) {
    const first = byte();
    if (first < 0) break;
    let value = first, error = false;
    if (kind === 'sjis' || kind === 'big5') {
      if (!(first <= 0x7f || (kind === 'sjis' ? first > 0xa0 && first <= 0xdf : first === 0xff))) {
        const second = byte(); if (second < 0) break;
        value = (first << 8) | second;
        error = kind === 'sjis' ? !((second >= 0x40 && second <= 0x7f) || (second >= 0x80 && second <= 0xff))
          : second < 0x40 || second === 0x7f || second === 0xff;
      }
    } else if (kind === 'gb_18030') {
      if (first > 0x80) {
        const second = byte(); value = (first << 8) | second;
        if (first >= 0x81 && first <= 0xfe && !((second >= 0x40 && second <= 0x7e) || (second >= 80 && second <= 0xfe))) {
          let four = false;
          if (second >= 0x30 && second <= 0x39) {
            const third = byte();
            if (third >= 0x81 && third <= 0xfe) {
              const fourth = byte();
              if (fourth >= 0x30 && fourth <= 0x39) { value = (value << 16) | (third << 8) | fourth; four = true; }
            }
          }
          error = !four;
        }
      }
    } else if (first > 0x8d) {
      const second = byte(); value = (first << 8) | second;
      if ((first >= 0xa1 && first <= 0xfe) || first === 0x8e) error = second < 0xa1;
      else if (first === 0x8f) { const third = byte(); value = (value << 8) | third; error = third < 0xa1; }
    }
    if (done) break;
    total++;
    if (error) bad++;
    else if ((value >>> 0) > 255) { double++; if (commonChars[kind].has(value)) common++; }
    if (bad >= 2 && bad * 5 >= double) return 0;
  }
  if (double <= 10 && !bad) return !double && total < 10 ? 0 : 10;
  if (double < 20 * bad) return 0;
  return Math.min(100, Math.trunc(Math.log(common + 1) * (90 / Math.log(Math.fround(Math.fround(double) / 4))) + 10));
}

function ngramConfidence(input: Uint8Array, map: number[], grams: number[]) {
  let gram = 0, count = 0, hits = 0, ignoreSpace = false;
  const append = (b: number) => {
    gram = ((gram << 8) + b) & 0xffffff; count++;
    let lo = 0, hi = grams.length - 1;
    while (lo <= hi) { const mid = (lo + hi) >>> 1; if (grams[mid] === gram) { hits++; break; } if (grams[mid] < gram) lo = mid + 1; else hi = mid - 1; }
  };
  for (const byte of input) {
    const mapped = map[byte];
    if (mapped) { if (mapped !== 32 || !ignoreSpace) append(mapped); ignoreSpace = mapped === 32; }
  }
  append(32);
  return hits / count > 0.33 ? 98 : Math.trunc(hits / count * 300);
}

/** Exact default byte-array recognizer set/order; native does not enable tag stripping. */
export function sourceCharsetMatches(bytes: Uint8Array): SourceCharsetMatch[] {
  const input = bytes.subarray(0, 8000), matches: Array<SourceCharsetMatch & { order: number }> = [];
  let order = 0;
  const add = (name: string, confidence: number, lang: string | null = null) => {
    if (confidence > 0) matches.push({ name, confidence, lang, order }); order++;
  };
  add('UTF-8', utf8Confidence(bytes));
  add('UTF-16BE', unicodeConfidence(bytes, false, 2)); add('UTF-16LE', unicodeConfidence(bytes, true, 2));
  add('UTF-32BE', unicodeConfidence(bytes, false, 4)); add('UTF-32LE', unicodeConfidence(bytes, true, 4));
  add('Shift_JIS', mbcsConfidence(bytes, 'sjis'), 'ja');
  for (const key of ['JP', 'CN', 'KR'] as const) add(`ISO-2022-${key}`, iso2022Confidence(input, tables.iso2022[key]));
  add('GB18030', mbcsConfidence(bytes, 'gb_18030'), 'zh');
  add('EUC-JP', mbcsConfidence(bytes, 'euc_jp'), 'ja'); add('EUC-KR', mbcsConfidence(bytes, 'euc_kr'), 'ko');
  add('Big5', mbcsConfidence(bytes, 'big5'), 'zh');
  const c1 = input.some(b => b >= 0x80 && b <= 0x9f);
  for (const table of tables.sbcs) {
    let best = -1, lang: string | null = null;
    for (const candidate of table.grams) {
      const confidence = ngramConfidence(input, table.byteMap, candidate.values);
      if (confidence > best) { best = confidence; lang = candidate.lang; }
    }
    add(c1 && table.c1 ? table.c1 : table.name, best, lang);
  }
  return matches.sort((a, b) => b.confidence - a.confidence || b.order - a.order).map(({ order: _, ...match }) => match);
}

export const detectSourceCharset = (bytes: Uint8Array) => sourceCharsetMatches(bytes)[0]?.name ?? 'UTF-8';
