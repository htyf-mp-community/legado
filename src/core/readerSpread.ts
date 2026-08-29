import type { ReaderDoublePageMode } from '../data/readerPreferences';

export function readerPageColumns(
  mode: ReaderDoublePageMode,
  width: number,
  height: number,
) {
  if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0)
    return 1;
  if (mode === 'double') return 2;
  if (mode === 'landscape') return width > height ? 2 : 1;
  if (mode === 'tabletLandscape')
    return width > height || Math.min(width, height) >= 600 ? 2 : 1;
  return 1;
}

export function spreadStart(pageIndex: number, columns: number) {
  const safeColumns = columns === 2 ? 2 : 1;
  return (
    Math.floor(Math.max(0, Math.trunc(pageIndex)) / safeColumns) * safeColumns
  );
}

export function reflowPageIndex(
  pageIndex: number,
  previousCapacity: number,
  nextCapacity: number,
  columns: number,
) {
  if (previousCapacity <= 0 || nextCapacity <= 0)
    return spreadStart(pageIndex, columns);
  return spreadStart(
    Math.round((Math.max(0, pageIndex) * previousCapacity) / nextCapacity),
    columns,
  );
}
