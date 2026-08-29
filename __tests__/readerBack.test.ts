import { shouldBlockReaderHardwareBack } from '../src/core/readerBack';

describe('reader hardware Back policy', () => {
  test('blocks only when the preference is enabled and the menu is hidden', () => {
    expect(shouldBlockReaderHardwareBack(false, false)).toBe(false);
    expect(shouldBlockReaderHardwareBack(true, true)).toBe(false);
    expect(shouldBlockReaderHardwareBack(true, false)).toBe(true);
  });
});
