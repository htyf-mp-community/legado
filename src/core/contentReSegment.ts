/** Direct UTF-16 port of ContentHelp.kt. Randomness is injectable only for replay. */
const END = '？。！?!~';
const END_P = '.？。！?!~';
const MID = '.，、,—…';
const SAY = '问说喊唱叫骂道着答';
const BEFORE = '，：,:';
const QUOTE = '"“”';
const RIGHT = '"”';
const ASCII_SPACE = '[\\t\\n\\x0B\\f\\r ]';
const rx = (pattern: string) => {
  let translated = '', inClass = false;
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) {
      const next = pattern[++i];
      translated += next === 's' ? (inClass ? '\\t\\n\\x0B\\f\\r ' : ASCII_SPACE) : '\\' + next;
      continue;
    }
    if (c === '[') inClass = true;
    if (c === ']') inClass = false;
    translated += c;
  }
  return new RegExp(translated, 'g');
};
const trimControl = (value: string) => value.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '');
const has = (key: string, value: string) => key.includes(value);
const char = (value: string, index: number): string => {
  if (index < 0 || index >= value.length) throw new RangeError('ContentHelp character index');
  return value[index];
};
const sub = (value: string, from: number, to = value.length): string => {
  if (from < 0 || from > to || to > value.length) throw new RangeError('ContentHelp substring index');
  return value.slice(from, to);
};
const setChar = (value: string, index: number, next: string) => {
  char(value, index);
  return value.slice(0, index) + next + value.slice(index + 1);
};

function seekIndexes(value: string, key: string, from: number, to: number, forward: boolean): number[] {
  const result: number[] = [];
  if (value.length - from < 1) return result;
  let i = from > 0 ? from : 0;
  const end = to > 0 ? Math.min(value.length, to) : value.length;
  for (; i < end; i += 1) {
    if (has(key, char(value, forward ? i : value.length - i - 1))) {
      if (result.length && i - result[result.length - 1] === 1) result[result.length - 1] = i;
      else result.push(i);
    }
  }
  return result;
}

function seekLast(value: string, key: string, from: number, to: number): number {
  if (value.length - from < 1) return -1;
  let i = value.length - 1;
  if (from < i && i > 0) i = from;
  const end = to > 0 ? to : 0;
  for (; i > end; i -= 1) if (has(key, char(value, i))) return i;
  return -1;
}

function seekIndex(value: string, key: string, from: number, to: number, forward: boolean): number {
  if (value.length - from < 1) return -1;
  const end = to > 0 ? Math.min(value.length, to) : value.length;
  for (let i = from > 0 ? from : 0; i < end; i += 1) {
    if (has(key, char(value, forward ? i : value.length - i - 1))) return i;
  }
  return -1;
}

function splitQuote(value: string): string {
  const length = value.length;
  if (length < 3) return value;
  if (has(QUOTE, char(value, 0))) {
    const i = seekIndex(value, QUOTE, 1, length - 2, true) + 1;
    if (i > 1 && !has(BEFORE, char(value, i - 1))) return sub(value, 0, i) + '\n' + sub(value, i);
  } else if (has(QUOTE, char(value, length - 1))) {
    const i = length - 1 - seekIndex(value, QUOTE, 1, length - 2, false);
    if (i > 1 && !has(BEFORE, char(value, i - 1))) return sub(value, 0, i) + '\n' + sub(value, i);
  }
  return value;
}

function reduceLength(value: string): string {
  const paragraphs = value.split('\n');
  const dialogueRows = paragraphs.map(p => /^["”“][^"”“]+["”“]$/.test(p));
  let dialogue = 0;
  for (let i = 0; i < paragraphs.length; i += 1) {
    if (dialogueRows[i]) {
      if (dialogue < 0) dialogue = 1;
      else if (dialogue < 2) dialogue += 1;
    } else if (dialogue > 1) {
      paragraphs[i] = splitQuote(paragraphs[i]);
      dialogue -= 1;
    } else if (dialogue > 0 && i < paragraphs.length - 2 && dialogueRows[i + 1]) {
      paragraphs[i] = splitQuote(paragraphs[i]);
    }
  }
  return paragraphs.map(p => '\n' + p).join('');
}

function makeDict(value: string): Set<string> {
  const pattern = /(?<=["'”“])([^\n\p{P}]{1,16})(?=["'”“])/gu;
  const seen = new Set<string>(), repeated = new Set<string>();
  for (const match of value.matchAll(pattern)) {
    if (seen.has(match[0])) repeated.add(match[0]);
    else seen.add(match[0]);
  }
  return repeated;
}

function forceSplit(value: string, offset: number, min: number, gain: number, trigger: number, random: () => number): number[] {
  const result: number[] = [];
  const ends = seekIndexes(value, END_P, 0, value.length - 2, true);
  const mids = seekIndexes(value, MID, 0, value.length - 2, true);
  if (ends.length < trigger && mids.length < trigger * 3) return result;
  let j = 0;
  for (let i = min; i < ends.length; i += 1) {
    let k = 0;
    while (j < mids.length) {
      if (mids[j] < ends[i]) k += 1;
      j += 1;
    }
    if (random() * gain < 0.8 + k / 2.5) {
      result.push(ends[i] + offset);
      i = Math.max(i + min, i);
    }
  }
  return result;
}

function findNewLines(value: string, dict: Set<string>, random: () => number): string {
  let string = value;
  const quotes: number[] = [];
  let breaks: number[] = [];
  const modes = Array<number>(value.length).fill(0);
  let waitClose = false;
  for (let i = 0; i < value.length; i += 1) {
    if (!has(QUOTE, char(value, i))) continue;
    const size = quotes.length;
    if (size > 0 && i - quotes[size - 1] === 2) {
      const remove = has(waitClose ? ',，、/' : ',，、/和与或', char(value, i - 1));
      if (remove) {
        string = setChar(setChar(string, i, '“'), i - 2, '”');
        quotes.pop();
        modes[size - 1] = 1;
        modes[size] = -1;
        continue;
      }
    }
    quotes.push(i);
    if (i > 1) {
      const previous = char(value, i - 1);
      let previousSpeaker = '\0';
      if (has(BEFORE, previous)) {
        if (quotes.length > 1) {
          const lastQuote = quotes[quotes.length - 2];
          let p = 0;
          if ((previous === ',' || previous === '，') && quotes.length > 2) {
            p = quotes[quotes.length - 3];
            if (p > 0) previousSpeaker = char(value, p - 1);
          }
          if (has(END_P, previousSpeaker)) breaks.push(p - 1);
          else if (!has('的', previousSpeaker)) {
            const lastEnd = seekLast(value, END, i, lastQuote);
            breaks.push(lastEnd > 0 ? lastEnd : lastQuote);
          }
        }
        waitClose = true;
        modes[size] = 1;
        if (size > 0) {
          modes[size - 1] = -1;
          if (size > 1) modes[size - 2] = 1;
        }
      } else if (waitClose) {
        waitClose = false;
        breaks.push(i);
      }
    }
  }
  const size = quotes.length;
  let opened = false;
  if (size > 0) {
    for (let i = 0; i < size; i += 1) {
      if (modes[i] > 0) opened = true;
      else if (modes[i] < 0) {
        if (!opened && i > 0) modes[i] = 3;
        opened = false;
      } else {
        opened = !opened;
        modes[i] = opened ? 2 : -2;
      }
    }
    if (opened) {
      if (quotes[size - 1] - string.length > -3) {
        if (size > 1) modes[size - 2] = 4;
        modes[size - 1] = -4;
      } else if (!has(SAY, char(string, string.length - 2))) string += '”';
    }
    let previousMode = -1;
    let i = 0;
    if (quotes[0] - 1 < 0) { i = 1; previousMode = 0; }
    for (; i < size; i += 1) {
      const j = quotes[i] - 1;
      const mode = modes[i];
      if (previousMode < 0 && mode > 0 && has(END, char(string, j))) breaks.push(j);
      previousMode = mode;
    }
  }
  breaks = breaks.filter(i => {
    if (has('"\'”“', char(string, i))) {
      const start = seekLast(value, '"\'”“', i - 1, i - 16);
      if (start > 0) {
        if (dict.has(sub(value, start + 1, i))) return false;
        if (has('的地得', char(value, start))) return false;
      }
    }
    return true;
  });
  breaks = [...new Set(breaks)].sort((a, b) => a - b);
  // Preserve the native iteration order, including appended forced breaks.
  let j = 0, progress = 0, nextLine = breaks.length ? breaks[j] : -1;
  let gain = 3, min = 0, trigger = 2;
  for (const quote of quotes) {
    [gain, min, trigger] = quote > 0 ? [4, 2, 4] : [3, 0, 2];
    while (j < breaks.length) {
      if (nextLine >= quote) break;
      nextLine = breaks[j];
      if (progress < nextLine) {
        breaks.push(...forceSplit(sub(string, progress, nextLine), progress, min, gain, trigger, random));
        progress = nextLine + 1;
      }
      j += 1;
    }
    if (progress < quote) {
      breaks.push(...forceSplit(sub(string, progress, quote + 1), progress, min, gain, trigger, random));
      progress = quote + 1;
    }
  }
  while (j < breaks.length) {
    nextLine = breaks[j];
    if (progress < nextLine) {
      breaks.push(...forceSplit(sub(string, progress, nextLine), progress, min, gain, trigger, random));
      progress = nextLine + 1;
    }
    j += 1;
  }
  if (progress < string.length) breaks.push(...forceSplit(sub(string, progress), progress, min, gain, trigger, random));
  const insertQuote = Array<boolean>(size).fill(false);
  opened = false;
  for (let i = 0; i < size; i += 1) {
    const p = quotes[i];
    if (modes[i] > 0) {
      string = setChar(string, p, '“');
      if (opened) insertQuote[i] = true;
      opened = true;
    } else if (modes[i] < 0) {
      string = setChar(string, p, '”');
      opened = false;
    } else {
      opened = !opened;
      string = setChar(string, p, opened ? '“' : '”');
    }
  }
  breaks = [...new Set(breaks)].sort((a, b) => a - b);
  let buffer = '';
  j = 0; progress = 0; nextLine = breaks.length ? breaks[j] : -1;
  for (let i = 0; i < size; i += 1) {
    const quote = quotes[i];
    while (j < breaks.length) {
      if (nextLine >= quote) break;
      nextLine = breaks[j];
      buffer += sub(string, progress, nextLine + 1) + '\n';
      progress = nextLine + 1;
      j += 1;
    }
    if (progress < quote) {
      buffer += sub(string, progress, quote + 1);
      progress = quote + 1;
    }
    if (insertQuote[i] && buffer.length > 2) {
      if (buffer.endsWith('\n')) buffer += '“';
      else buffer = buffer.slice(0, -1) + '”\n' + buffer.slice(-1);
    }
  }
  while (j < breaks.length) {
    nextLine = breaks[j];
    if (progress <= nextLine) { buffer += sub(string, progress, nextLine + 1) + '\n'; progress = nextLine + 1; }
    j += 1;
  }
  if (progress < string.length) buffer += sub(string, progress);
  return buffer;
}

export function reSegmentContent(content: string, chapterTitle: string, random: () => number = Math.random): string {
  const dict = makeDict(content);
  let paragraphs = content.replace(/&quot;/g, '“')
    .replace(/[:：]['"‘”“]+/g, '：“')
    .replace(rx('["”“]+\\s*["”“][\\s"”“]*'), '”\n“')
    .split(rx('\n\\s*'));
  let buffer = '  ';
  if (trimControl(chapterTitle) !== trimControl(paragraphs[0])) buffer += paragraphs[0].replace(rx('[\u3000\\s]+'), '');
  for (let i = 1; i < paragraphs.length; i += 1) {
    if (has(END, char(buffer, buffer.length - 1)) || (has(RIGHT, char(buffer, buffer.length - 1)) && has(END, char(buffer, buffer.length - 2)))) buffer += '\n';
    buffer += paragraphs[i].replace(rx('[\u3000\\s]'), '');
  }
  paragraphs = buffer.replace(rx('["”“]+\\s*["”“]+'), '”\n“')
    .replace(/["”“]+(？。！?!~)["”“]+/g, '”$1\n“')
    .replace(/["”“]+(？。！?!~)([^"”“])/g, '”$1\n$2')
    .replace(/([问说喊唱叫骂道着答])[\.。]/g, '$1。\n').split('\n');
  buffer = reduceLength(paragraphs.map(p => '\n' + findNewLines(p, dict, random)).join(''));
  return buffer.replace(new RegExp('^' + ASCII_SPACE + '+'), '')
    .replace(rx('\\s*["”“]+\\s*["”“][\\s"”“]*'), '”\n“')
    .replace(rx('[:：][”“"\\s]+'), '：“')
    .replace(/\n["“”]([^\n"“”]+)([,:，：]["”“])([^\n"“”]+)/g, '\n$1：“$3')
    .replace(rx('\n\\s*'), '\n');
}
