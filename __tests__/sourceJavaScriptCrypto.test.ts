jest.mock('react-native-quick-base64', () => ({
  fromByteArray: (bytes: Uint8Array) => Buffer.from(bytes).toString('base64'),
  toByteArray: (text: string) => new Uint8Array(Buffer.from(text, 'base64')),
}));
jest.mock('react-native-quick-crypto', () => require('crypto'));

import { runSourceJavaScript } from '../src/core/sourceJavaScript';

const key = '0123456789abcdef', iv = 'abcdef9876543210';
const base64 = 'rBxCEOLiCHJixsNEParqjoneatg7duqjgePjyWOSJQ0=';
const hex = 'ac1c4210e2e2087262c6c3443daaea8e89de6ad83b76eaa381e3e3c96392250d';

test.each([
  ['CBC', 16, 'rBxCEOLiCHJixsNEParqjoneatg7duqjgePjyWOSJQ0='],
  ['CBC', 24, 'n8HIth+heTRV0jY5WZuw/OzjUs7pbJbglOzfIbuYpC0='],
  ['CBC', 32, 'CkTvPdd2WtdBdfCPA3qWWhqRyefRLUgw+NucpIGpRV8='],
  ['ECB', 16, 'i6AAoL07DxrU/MM5FLHkhTdyIuBhqSTFkc2cJ+oWPtQ='],
  ['ECB', 24, 'gh4g8vX8tr7Qpx8GGamYdwxnU7WuDCUICrbQ4y4xjTI='],
  ['ECB', 32, 'W7By3G6XM/Xxj5Hs32fJLoqjYkH96N8FTcMlxsaVuJ4='],
])('matches Hutool AES-%s with a %s-byte key', (mode, length, expected) => {
  const material = '0123456789abcdef0123456789abcdef'.slice(0, length);
  const options = mode === 'CBC' ? `,'${iv}'` : '';
  const crypto = `java.createSymmetricCrypto('AES/${mode}/PKCS5Padding','${material}'${options})`;
  expect(runSourceJavaScript(`${crypto}.encryptBase64(result)`, '西游记 Hello!')).toBe(expected);
  expect(runSourceJavaScript(`${crypto}.decryptStr(result)`, expected)).toBe('西游记 Hello!');
});

test('encrypts and decrypts AES-CBC strings with the original Hutool vectors', () => {
  const crypto = `java.createSymmetricCrypto('AES/CBC/PKCS5Padding','${key}','${iv}')`;
  expect(runSourceJavaScript(`${crypto}.encryptBase64(result)`, '西游记 Hello!')).toBe(base64);
  expect(runSourceJavaScript(`${crypto}.encryptHex(result)`, '西游记 Hello!')).toBe(hex);
  expect(runSourceJavaScript(`${crypto}.decryptStr(result)`, base64)).toBe('西游记 Hello!');
  expect(runSourceJavaScript(`${crypto}.decryptStr(result)`, hex)).toBe('西游记 Hello!');
});

test('passes byte-array keys and values through the real source call shape', () => {
  const script = `var k=java.base64DecodeToByteArray('MDEyMzQ1Njc4OWFiY2RlZg==');
var v=java.base64DecodeToByteArray('YWJjZGVmOTg3NjU0MzIxMA==');
var crypto=java.createSymmetricCrypto('AES/CBC/PKCS5Padding',k,v);
java.bytesToStr(crypto.decrypt(crypto.encrypt(result)));`;
  expect(runSourceJavaScript(script, '西游记 Hello!')).toBe('西游记 Hello!');
  expect(runSourceJavaScript('java.base64DecodeToByteArray("/4A=").join(",")', '')).toBe('-1,-128');
  expect(runSourceJavaScript('java.base64DecodeToByteArray("")', '')).toBeNull();
  expect(runSourceJavaScript('java.bytesToStr(java.strToBytes("éÿ", "ISO-8859-1"), "ISO-8859-1")', '')).toBe('éÿ');
  expect(runSourceJavaScript('java.bytesToStr([-19,-96,-128])', '')).toBe('�');
});

test('executes the supplied 小小阅读 source legacy AES call', () => {
  const script = `java.aesBase64DecodeToString(result,"Pxga!h*e4@T8xfOm","AES/CBC/PKCS5Padding","E&z!EHGLd$fli*8R")`;
  expect(runSourceJavaScript(script, 'VVYptzB1ev/mjJFL7HWv3w==')).toBe('西游记正文');
});

test('supports PKCS7 alias, ECB and optional unpadded AES', () => {
  expect(runSourceJavaScript(`java.createSymmetricCrypto('AES/CBC/PKCS7Padding','${key}','${iv}').encryptBase64(result)`, '西游记 Hello!')).toBe(base64);
  expect(runSourceJavaScript(`java.createSymmetricCrypto('AES/ECB/PKCS5Padding','${key}').encryptBase64(result)`, '西游记 Hello!')).toBe('i6AAoL07DxrU/MM5FLHkhTdyIuBhqSTFkc2cJ+oWPtQ=');
  expect(runSourceJavaScript(`var c=java.createSymmetricCrypto('AES/CBC/NoPadding','${key}','${iv}');c.decryptStr(c.encrypt(result))`, '0123456789abcdef')).toBe('0123456789abcdef');
});

test.each([
  ['DES', 'CBC', 'KW8Dvm2N', '3yhJENxs1je7Da3+j3+DA4ZHbX4rtOBI'],
  ['DES', 'ECB', 'KW8Dvm2N', 'wHybahOw6Qb95Bmp3FQhNhmp06BDRlT/'],
  ['DESede', 'CBC', '0123456789abcdefghijklmn', '+MTUoOGAiz7E6VCx1SQdI1pWrzbiHT/k'],
  ['DESede', 'ECB', '0123456789abcdefghijklmn', 'OFb1ln2e2Bnie98UXRFBpcRsX+FVh2Tj'],
])('matches JCE %s/%s vectors', (algorithm, mode, material, expected) => {
  const options = mode === 'CBC' ? ",'1ae2c94b'" : '';
  const crypto = `java.createSymmetricCrypto('${algorithm}/${mode}/PKCS5Padding','${material}'${options})`;
  expect(runSourceJavaScript(`${crypto}.encryptBase64(result)`, '西游记 Hello!')).toBe(expected);
  expect(runSourceJavaScript(`${crypto}.decryptStr(result)`, expected)).toBe('西游记 Hello!');
});

test('executes the supplied 晋江 source DES call', () => {
  const script = 'java.createSymmetricCrypto("DES/CBC/PKCS5Padding", String("KW8Dvm2N"), String("1ae2c94b")).encryptBase64(result)';
  expect(runSourceJavaScript(script, '西游记 Hello!')).toBe('3yhJENxs1je7Da3+j3+DA4ZHbX4rtOBI');
});

test.each(['DES', 'DESede'])('%s supports no padding and PKCS7 aliases', algorithm => {
  const material = algorithm === 'DES' ? 'KW8Dvm2N' : '0123456789abcdefghijklmn';
  const noPadding = `java.createSymmetricCrypto('${algorithm}/CBC/NoPadding','${material}','1ae2c94b')`;
  expect(runSourceJavaScript(`var c=${noPadding};c.decryptStr(c.encrypt(result))`, '12345678')).toBe('12345678');
  const padding = `java.createSymmetricCrypto('${algorithm}/CBC/PKCS7Padding','${material}','1ae2c94b')`;
  expect(runSourceJavaScript(`var c=${padding};c.decryptStr(c.encryptBase64(result))`, '西游记')).toBe('西游记');
});

test('rejects unsupported algorithms, malformed keys, and excessive input', () => {
  expect(() => runSourceJavaScript("java.createSymmetricCrypto('Blowfish/CBC/PKCS5Padding','12345678','12345678')", '')).toThrow(/不支持/);
  expect(() => runSourceJavaScript("java.createSymmetricCrypto('AES/CBC/PKCS5Padding','short','1234567890123456')", '')).toThrow(/密钥/);
  expect(() => runSourceJavaScript("java.createSymmetricCrypto('DES/CBC/PKCS5Padding','toolong-key','12345678')", '')).toThrow(/密钥/);
  expect(() => runSourceJavaScript("java.createSymmetricCrypto('DESede/CBC/PKCS5Padding','1234567812345678','12345678')", '')).toThrow(/密钥/);
  expect(() => runSourceJavaScript('var s="x";for(var i=0;i<18;i++)s+=s;java.strToBytes(s)', '')).toThrow(/限制|过长/);
  expect(runSourceJavaScript(`try { java.createSymmetricCrypto('AES/CBC/PKCS5Padding','${key}','${iv}').decryptStr('broken'); } catch(e) { 'caught'; }`, '')).toBe('caught');
});
