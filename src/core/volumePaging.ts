export function volumePageDirection(previous: number, current: number) {
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return 0;
  return current > previous ? 1 : current < previous ? -1 : 0;
}
