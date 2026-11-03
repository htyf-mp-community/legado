jest.mock('react-native-quick-base64', () => ({
  fromByteArray: (bytes: Uint8Array) => Buffer.from(bytes).toString('base64'),
  toByteArray: (input: string) => new Uint8Array(Buffer.from(input, 'base64')),
}));

import { runSourceJavaScript, runSourceJavaScriptAsync } from '../src/core/sourceJavaScript';
import { sourceRuleText } from '../src/core/sourceRule';

test('decodes the original 神文小说 chapter rule from the 1321 collection', () => {
  const rule = "@js:var s=''+result;var re=/qsbs\\.bb\\('([^']+)'\\)/g;var m;var o='';while((m=re.exec(s))!==null){try{o+=java.base64Decode(m[1])}catch(e){}}o";
  expect(sourceRuleText("qsbs.bb('6KW/5ri46K6w');qsbs.bb('5q2j5paH');", rule)).toBe('西游记正文');
});

test('supports UTF-8 Base64 and Java flags in scripts', async () => {
  expect(runSourceJavaScript('java.base64Encode(result)', '西游记')).toBe('6KW/5ri46K6w');
  expect(runSourceJavaScript('java.base64Decode("6KW_5ri46K6w", 8)', '')).toBe('西游记');
  expect(runSourceJavaScript('java.base64Encode("?", 11)', '')).toBe('Pw');
  expect(runSourceJavaScript('java.base64Encode("x", 0)', '')).toBe('eA==\n');
  expect(runSourceJavaScript('java.base64Encode("x", 4)', '')).toBe('eA==\r\n');
  expect(runSourceJavaScript('java.base64Decode(java.base64Encode(result))', '𠮷')).toBe('𠮷');
  expect(runSourceJavaScript('try { java.base64Decode("A"); } catch (e) { "caught"; }', '')).toBe('caught');
  expect(runSourceJavaScript('java.base64Decode(" zvc= ", "GBK")', '')).toBe('西');
  expect(await runSourceJavaScriptAsync('java.base64Encode(key)', {baseUrl:'https://example.org',key:'西游记',page:1,ajax:async()=>'',removeCookie:()=>{}})).toBe('6KW/5ri46K6w');
});

test('bounds repeated Base64 operations and oversized values', () => {
  expect(() => runSourceJavaScript('var s="x";for(var i=0;i<14;i++)s+=s;for(var j=0;j<100;j++)java.base64Encode(s);', '')).toThrow(/限制/);
});
