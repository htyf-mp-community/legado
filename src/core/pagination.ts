export function estimatePageCapacity(
  width: number,
  height: number,
  fontSize: number,
  lineHeight: number,
) {
  const usableWidth = Math.max(80, width - 52);
  const usableHeight = Math.max(lineHeight, height - 150);
  const charactersPerLine = Math.max(
    6,
    Math.floor(usableWidth / (fontSize * 0.95)),
  );
  const lines = Math.max(1, Math.floor(usableHeight / lineHeight));
  return charactersPerLine * lines;
}

const specialPageBreak = /^\s*\[newpage\]\s*$/gim;

export function stripSpecialPageBreaks(text: string) {
  return text.replace(specialPageBreak, '\n\n').replace(/\n{3,}/g, '\n\n');
}

export function paginateText(
  text: string,
  capacity: number,
  honorSpecialPageBreaks = false,
): string[] {
  return paginateTextRanges(text, capacity, honorSpecialPageBreaks).map(
    page => page.text,
  );
}
export type TextPageRange = { text: string; start: number; end: number };
export function paginateTextRanges(
  text: string,
  capacity: number,
  honorSpecialPageBreaks = false,
): TextPageRange[] {
  if (honorSpecialPageBreaks && specialPageBreak.test(text)) {
    specialPageBreak.lastIndex = 0;
    const pages: TextPageRange[] = [];
    let start = 0;
    const append = (end: number) => {
      const section = text.slice(start, end);
      if (section.trim())
        pages.push(...paginatePlainText(section, capacity, start));
    };
    for (const match of text.matchAll(
      new RegExp(specialPageBreak.source, 'gim'),
    )) {
      append(match.index!);
      start = match.index! + match[0].length;
    }
    append(text.length);
    return pages.length ? pages : [{ text: '', start: 0, end: 0 }];
  }
  specialPageBreak.lastIndex = 0;
  return paginatePlainText(text, capacity);
}

function paginatePlainText(
  text: string,
  capacity: number,
  offset = 0,
): TextPageRange[] {
  const size = Math.max(1, Math.floor(capacity));
  if (!text) return [{ text: '', start: offset, end: offset }];
  const pages: TextPageRange[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + size);
    if (end < text.length) {
      const marker = readerMarkerRangeAt(text, end);
      if (marker && marker.start >= start)
        end = marker.start > start ? marker.start : marker.end;
      const newline = text.lastIndexOf('\n', end);
      if (newline > start + size * 0.55) end = newline + 1;
    }
    const raw = text.slice(start, end),
      value = raw.trim(),
      leading = raw.length - raw.trimStart().length;
    pages.push({
      text: value,
      start: offset + start + leading,
      end: offset + start + leading + value.length,
    });
    start = end;
  }
  return pages.length ? pages : [{ text: '', start: offset, end: offset }];
}
import { readerMarkerRangeAt } from './readerImages';
