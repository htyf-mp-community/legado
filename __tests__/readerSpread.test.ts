import {
  readerPageColumns,
  reflowPageIndex,
  spreadStart,
} from '../src/core/readerSpread';

describe('reader spread layout', () => {
  test('matches Android four-mode column policy', () => {
    expect(readerPageColumns('single', 1200, 800)).toBe(1);
    expect(readerPageColumns('double', 400, 800)).toBe(2);
    expect(readerPageColumns('landscape', 1200, 800)).toBe(2);
    expect(readerPageColumns('landscape', 800, 1200)).toBe(1);
    expect(readerPageColumns('tabletLandscape', 700, 1000)).toBe(2);
    expect(readerPageColumns('tabletLandscape', 390, 844)).toBe(1);
  });
  test('aligns jumps and reflow to the first page of a spread', () => {
    expect(spreadStart(5, 2)).toBe(4);
    expect(spreadStart(5, 1)).toBe(5);
    expect(reflowPageIndex(4, 1000, 500, 2)).toBe(8);
    expect(reflowPageIndex(4, 500, 1000, 2)).toBe(2);
  });
  test('rejects invalid viewport geometry', () => {
    expect(readerPageColumns('double', 0, 800)).toBe(1);
    expect(readerPageColumns('landscape', Number.NaN, 800)).toBe(1);
  });
});
