export type ReaderProgressBehavior = 'page' | 'chapter';

const bound = (value: number, max: number) =>
  Math.max(0, Math.min(Math.max(0, max), Math.round(value)));

export function readerProgressState(
  behavior: ReaderProgressBehavior,
  pageIndex: number,
  pageCount: number,
  chapterIndex: number,
  chapterCount: number,
) {
  const max = Math.max(0, (behavior === 'page' ? pageCount : chapterCount) - 1),
    value = bound(behavior === 'page' ? pageIndex : chapterIndex, max);
  return { max, value, current: value + 1, total: max + 1 };
}

export function normalizeReaderProgressTarget(value: number, max: number) {
  return bound(Number.isFinite(value) ? value : 0, max);
}
