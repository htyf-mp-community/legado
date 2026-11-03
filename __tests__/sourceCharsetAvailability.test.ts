jest.mock('../src/data/storage', () => ({ appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() } }));
jest.mock('react-native-quick-crypto', () => require('node:crypto'));

import iconv from 'iconv-lite';
import { canEncodeSourceCharset } from '../src/core/sourceCharsetAvailability';
import { buildSourceRequest } from '../src/core/sourceRequest';
import { runSourceJavaScript } from '../src/core/sourceJavaScript';

test('matches available iconv charset names, canonicalization and unknown names', () => {
  iconv.encodingExists('utf8');
  const definitions = Object.keys((iconv as unknown as {encodings: Record<string, unknown>}).encodings);
  const names = [...definitions.flatMap(name => [name, name.toUpperCase(), `${name}:1987`, `${name}-_`]),
    'not-a-charset', 'utf8:20000', 'constructor', '__proto__', '', 'gbk:19a7'];
  expect(names.filter(name => canEncodeSourceCharset(name) !== iconv.encodingExists(name))).toEqual([]);
});

test('validates script and source request encodings without calling iconv', () => {
  const exists = jest.spyOn(iconv, 'encodingExists').mockImplementation(() => { throw new Error('unexpected iconv'); });
  try {
    expect(runSourceJavaScript('java.encodeURI("西游记", "GBK")', '')).toBe('%CE%F7%D3%CE%BC%C7');
    expect(runSourceJavaScript('java.encodeURI("x", "bad-charset")', '')).toBe('');
    const source = {bookSourceUrl:'https://example.org', bookSourceName:'test'} as any;
    expect(buildSourceRequest(source, '/search,{"charset":"GBK"}').url).toBe('https://example.org/search');
    expect(() => buildSourceRequest(source, '/search,{"charset":"bad-charset"}')).toThrow(/字符集/);
  } finally { exists.mockRestore(); }
});
