const mockValues = new Map<string, number>();
jest.mock('../src/data/storage', () => ({
  appStorage: {
    getNumber: (key: string) => mockValues.get(key),
    getString: () => undefined,
    set: (key: string, value: number) => mockValues.set(key, value),
  },
}));
import {
  BATCH_SOURCE_DELAY_KEY,
  loadBatchSourceDelay,
  saveBatchSourceDelay,
} from '../src/data/batchSourcePreferences';
import { backupCategoryForKey } from '../src/data/backupPreferences';
beforeEach(() => mockValues.clear());
test('the native interval defaults to zero and persists independently as a settings value', () => {
  expect(loadBatchSourceDelay()).toBe(0);
  expect(saveBatchSourceDelay(12)).toBe(12);
  expect(loadBatchSourceDelay()).toBe(12);
  expect(backupCategoryForKey(BATCH_SOURCE_DELAY_KEY)).toBe('settings');
});
test('stored values remain in the native NumberPicker range', () => {
  expect(saveBatchSourceDelay(99999)).toBe(9999);
  expect(saveBatchSourceDelay(-2)).toBe(0);
  expect(saveBatchSourceDelay(2.9)).toBe(2);
  expect(saveBatchSourceDelay(NaN)).toBe(0);
});
