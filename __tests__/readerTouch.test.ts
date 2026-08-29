import {
  pullBookmarkGesture,
  pullBookmarkOffset,
  readerTouchAction,
} from '../src/core/readerTouch';

const action = (patch: Partial<Parameters<typeof readerTouchAction>[0]> = {}) =>
  readerTouchAction({
    startX: 200,
    endX: 200,
    width: 400,
    mode: 'page',
    swipeThreshold: 40,
    edgeInset: 0,
    ...patch,
  });

describe('reader touch actions', () => {
  test('uses the configured swipe threshold in both directions', () => {
    expect(action({ endX: 160 })).toBe('next');
    expect(action({ endX: 240 })).toBe('previous');
    expect(action({ endX: 165, swipeThreshold: 40 })).toBe('none');
  });
  test('maps left, middle and right taps while paged', () => {
    expect(action({ startX: 80, endX: 80 })).toBe('previous');
    expect(action()).toBe('controls');
    expect(action({ startX: 320, endX: 320 })).toBe('next');
  });
  test('ignores taps inside the configured physical edge inset', () => {
    expect(action({ startX: 15, endX: 15, edgeInset: 24 })).toBe('none');
    expect(action({ startX: 385, endX: 385, edgeInset: 24 })).toBe('none');
  });
  test('keeps scroll-mode taps for controls without triggering page swipes', () => {
    expect(action({ mode: 'scroll' })).toBe('controls');
    expect(action({ mode: 'scroll', endX: 100 })).toBe('none');
  });
  test('rejects impossible geometry', () => {
    expect(action({ width: 0 })).toBe('none');
    expect(action({ endX: Number.NaN })).toBe('none');
  });
});

describe('pull bookmark gesture', () => {
  test('matches Android vertical dominance and threshold states', () => {
    expect(
      pullBookmarkGesture({ deltaX: 20, deltaY: 10, triggerDistance: 48 }),
    ).toBe('none');
    expect(
      pullBookmarkGesture({ deltaX: 2, deltaY: 20, triggerDistance: 48 }),
    ).toBe('pulling');
    expect(
      pullBookmarkGesture({ deltaX: 4, deltaY: 48, triggerDistance: 48 }),
    ).toBe('ready');
  });
  test('resists and bounds the page offset', () => {
    expect(pullBookmarkOffset(100, 500)).toBe(50);
    expect(pullBookmarkOffset(1000, 500)).toBe(175);
    expect(pullBookmarkOffset(-10, 500)).toBe(0);
  });
});
