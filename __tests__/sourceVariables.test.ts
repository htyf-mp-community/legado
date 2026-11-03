import { mergeSourceVariables } from '../src/core/sourceVariables';

test('rejects a merge that would exceed the script variable count limit', () => {
  const left = Object.fromEntries(Array.from({length: 600}, (_, index) => [`a${index}`, 'x']));
  const right = Object.fromEntries(Array.from({length: 600}, (_, index) => [`b${index}`, 'x']));
  expect(() => mergeSourceVariables(undefined, undefined, [JSON.stringify(left), JSON.stringify(right)])).toThrow('超过限制');
});

test('does not recreate a newer explicitly cleared variable object', () => {
  expect(mergeSourceVariables('{"a":"1"}', undefined, ['{"a":"1","b":"2"}'])).toBeUndefined();
});
