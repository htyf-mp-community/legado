jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), getNumber: jest.fn(), set: jest.fn(), remove: jest.fn() }) }));
import { defaultKeyboardAssists, insertKeyboardAssist, normalizeKeyboardAssists, parseKeyboardAssists } from '../src/data/keyboardAssists';

test('matches the Android default secondary-button set and ordering', () => {
  expect(defaultKeyboardAssists).toHaveLength(32);
  expect(defaultKeyboardAssists.slice(0, 4).map(item => [item.key, item.value])).toEqual([['@css:', '@css:'], ['<js>', '<js></js>'], ['{{}}', '{{}}'], ['##', '##']]);
  expect(defaultKeyboardAssists.at(-1)).toMatchObject({ key: 'useWebView', value: ',{"webView": true}' });
});

test('inserts at or replaces the current controlled selection and returns the cursor', () => {
  expect(insertKeyboardAssist('abcdef', { start: 2, end: 4 }, '{{}}')).toEqual({ text: 'ab{{}}ef', selection: { start: 6, end: 6 } });
  expect(insertKeyboardAssist('abc', { start: 99, end: 99 }, '#')).toEqual({ text: 'abc#', selection: { start: 4, end: 4 } });
});

test('imports legacy keyboardAssists.json, removes duplicate keys and normalizes order', () => {
  expect(parseKeyboardAssists('[{"type":0,"key":"B","value":"2","serialNo":9},{"type":0,"key":"A","value":"1","serialNo":2},{"type":0,"key":"A","value":"x"}]')).toEqual([
    { type: 0, key: 'A', value: '1', serialNo: 0 },
    { type: 0, key: 'B', value: '2', serialNo: 1 },
  ]);
  expect(normalizeKeyboardAssists(null)).toEqual(defaultKeyboardAssists);
});
