import { volumePageDirection } from '../src/core/volumePaging';

test('maps volume changes to page directions', () => {
  expect(volumePageDirection(0.5, 0.6)).toBe(1);
  expect(volumePageDirection(0.5, 0.4)).toBe(-1);
  expect(volumePageDirection(0.5, 0.5)).toBe(0);
  expect(volumePageDirection(Number.NaN, 0.5)).toBe(0);
});
