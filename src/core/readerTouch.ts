import type { ReaderMode } from '../data/readerPreferences';

export type ReaderTouchAction = 'previous' | 'next' | 'controls' | 'none';
export type PullBookmarkState = 'none' | 'pulling' | 'ready';

export function pullBookmarkGesture({
  deltaX,
  deltaY,
  touchSlop = 8,
  triggerDistance,
}: {
  deltaX: number;
  deltaY: number;
  touchSlop?: number;
  triggerDistance: number;
}): PullBookmarkState {
  if (![deltaX, deltaY, touchSlop, triggerDistance].every(Number.isFinite))
    return 'none';
  if (deltaY <= Math.max(0, touchSlop) || deltaY <= Math.abs(deltaX))
    return 'none';
  return deltaY >= Math.max(touchSlop, triggerDistance) ? 'ready' : 'pulling';
}

export function pullBookmarkOffset(deltaY: number, height: number) {
  if (!Number.isFinite(deltaY) || !Number.isFinite(height) || height <= 0)
    return 0;
  return Math.min(Math.max(0, deltaY * 0.5), height * 0.35);
}

export function readerTouchAction({
  startX,
  endX,
  width,
  mode,
  swipeThreshold,
  edgeInset,
}: {
  startX: number;
  endX: number;
  width: number;
  mode: ReaderMode;
  swipeThreshold: number;
  edgeInset: number;
}): ReaderTouchAction {
  if (![startX, endX, width].every(Number.isFinite) || width <= 0)
    return 'none';
  const distance = endX - startX;
  if (mode === 'page' && Math.abs(distance) >= Math.max(12, swipeThreshold))
    return distance > 0 ? 'previous' : 'next';
  if (Math.abs(distance) >= 12) return 'none';
  const safeInset = Math.min(width / 3, Math.max(0, edgeInset));
  if (endX < safeInset || endX > width - safeInset) return 'none';
  if (mode === 'page' && endX < width * 0.3) return 'previous';
  if (mode === 'page' && endX > width * 0.7) return 'next';
  return 'controls';
}
