jest.mock('react-native-quick-crypto', () => require('crypto'));
import { runSourceJavaScript, runSourceJavaScriptAsync } from '../src/core/sourceJavaScript';

test.each([
  ['MD5', '9db64a7a1f63a775102be1d7713f57f1', 'nbZKeh9jp3UQK+HXcT9X8Q=='],
  ['SHA-1', '56494d13cbc75979ebe9202444c98bfb9fb12696', 'VklNE8vHWXnr6SAkRMmL+5+xJpY='],
  ['SHA-256', '942c26cac8c24d7070c084e2a5a4c3166e612b604d46db2b19600586c53fd995', 'lCwmysjCTXBwwITipaTDFm5hK2BNRtsrGWAFhsU/2ZU='],
])('matches Java digest %s for UTF-8 data', (algorithm, hex, base64) => {
  expect(runSourceJavaScript(`java.digestHex(result,'${algorithm}')`, '西游记')).toBe(hex);
  expect(runSourceJavaScript(`java.digestBase64Str(result,'${algorithm}')`, '西游记')).toBe(base64);
});

test.each([
  ['HmacMD5', '4abec7da5130fbfc7009d79118628d79', 'Sr7H2lEw+/xwCdeRGGKNeQ=='],
  ['HmacSHA1', 'a4781450fd18ca1e3642d2c2060bd29b4fd56eb6', 'pHgUUP0Yyh42QtLCBgvSm0/VbrY='],
  ['HmacSHA256', '65e5ee42077532497b0d04a917437a5b9b39e21c8d4ec27e6514f0af9cedc95a', 'ZeXuQgd1Mkl7DQSpF0N6W5s54hyNTsJ+ZRTwr5ztyVo='],
])('matches Java %s with UTF-8 input and key', (algorithm, hex, base64) => {
  expect(runSourceJavaScript(`java.HMacHex(result,'${algorithm}','snY%169j')`, '西游记')).toBe(hex);
  expect(runSourceJavaScript(`java.HMacBase64(result,'${algorithm}','snY%169j')`, '西游记')).toBe(base64);
});

test('supports source algorithm aliases and Java malformed UTF-16 replacement', () => {
  expect(runSourceJavaScript("java.HMacHex(result,'HMAC-SHA1','snY%169j')", '西游记')).toBe('a4781450fd18ca1e3642d2c2060bd29b4fd56eb6');
  expect(runSourceJavaScript("java.digestHex(result,'sha-256')", '\ud800')).toBe(require('crypto').createHash('sha256').update('?').digest('hex'));
});

test('keeps the interpreter behavior when the HMAC key is omitted', () => {
  expect(runSourceJavaScript("java.HMacHex('x','SHA-1')", '')).toBe('11f6ad8ec52a2984abaafd7c3b516503785c2072');
  expect(runSourceJavaScript("try { java.HMacHex('x','HmacSHA1'); } catch (e) { 'caught'; }", '')).toBe('caught');
});

test('supports source signing in async URL scripts and bounds unsupported algorithms', async () => {
  const bridge = {baseUrl:'https://example.org', key:'西游记', page:1, ajax:async () => '', removeCookie:() => {}};
  expect(await runSourceJavaScriptAsync("java.HMacHex(key,'HmacMD5','snY%169j')", bridge)).toBe('4abec7da5130fbfc7009d79118628d79');
  expect(runSourceJavaScript("try { java.digestHex('x','NO-SUCH-ALGORITHM'); } catch (e) { 'caught'; }", '')).toBe('caught');
});

test('returns distinct RFC 4122 version 4 identifiers usable as strings', () => {
  const value = runSourceJavaScript('java.randomUUID().toString() + "," + java.randomUUID().toString()', '') as string;
  const [first, second] = value.split(',');
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(second).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(first).not.toBe(second);
});
