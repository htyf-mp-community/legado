import {
  normalizeReaderProgressTarget,
  readerProgressState,
} from '../src/core/readerProgress';

describe('reader progress bar', () => {
  test('tracks pages within the current chapter', () => {
    expect(readerProgressState('page', 2, 5, 8, 20)).toEqual({
      max: 4,
      value: 2,
      current: 3,
      total: 5,
    });
  });
  test('tracks chapters across the whole book', () => {
    expect(readerProgressState('chapter', 2, 5, 8, 20)).toEqual({
      max: 19,
      value: 8,
      current: 9,
      total: 20,
    });
  });
  test('keeps empty and stale values inside valid slider bounds', () => {
    expect(readerProgressState('page', 99, 0, 0, 0)).toEqual({
      max: 0,
      value: 0,
      current: 1,
      total: 1,
    });
    expect(normalizeReaderProgressTarget(3.7, 5)).toBe(4);
    expect(normalizeReaderProgressTarget(99, 5)).toBe(5);
    expect(normalizeReaderProgressTarget(Number.NaN, 5)).toBe(0);
  });
});
