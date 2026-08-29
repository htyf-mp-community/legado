jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }) }));
import { buildEditedBookSource, SourceEditorError } from '../src/core/sourceEditor';
import type { BookSource } from '../src/types';

const source: BookSource = { bookSourceName: ' Demo ', bookSourceUrl: ' https://example.test ', bookSourceType: 0, customOrder: 0, enabled: true, enabledExplore: true };

test('keeps protected editor fields while preserving advanced source rules', () => {
  expect(buildEditedBookSource(source, '{"bookSourceName":"Override","ruleSearch":{"bookList":"article"}}')).toMatchObject({ bookSourceName: 'Demo', bookSourceUrl: 'https://example.test', ruleSearch: { bookList: 'article' } });
});

test.each([
  [{ ...source, bookSourceName: ' ' }, '{}', 'sourceNameRequired'],
  [{ ...source, bookSourceUrl: ' ' }, '{}', 'sourceUrlRequired'],
  [source, '{', 'advancedJsonInvalid'],
  [source, '[]', 'advancedJsonObject'],
] as const)('returns a translatable validation code', (value, advanced, code) => {
  try {
    buildEditedBookSource(value, advanced);
    throw new Error('expected validation error');
  } catch (error) {
    expect(error).toBeInstanceOf(SourceEditorError);
    expect((error as SourceEditorError).code).toBe(code);
  }
});
