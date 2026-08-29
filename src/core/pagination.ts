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
  if (honorSpecialPageBreaks && specialPageBreak.test(text)) {
    specialPageBreak.lastIndex = 0;
    const pages = text
      .split(specialPageBreak)
      .flatMap(section =>
        section.trim() ? paginatePlainText(section, capacity) : [],
      );
    return pages.length ? pages : [''];
  }
  specialPageBreak.lastIndex = 0;
  return paginatePlainText(text, capacity);
}

function paginatePlainText(text: string, capacity: number): string[] {
  const size = Math.max(1, Math.floor(capacity));
  if (!text) return [''];
  const pages: string[] = [];
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
    pages.push(text.slice(start, end).trim());
    start = end;
  }
  return pages.length ? pages : [''];
}
import { readerMarkerRangeAt } from './readerImages';
