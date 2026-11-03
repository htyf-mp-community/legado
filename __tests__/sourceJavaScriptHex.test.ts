import {runSourceJavaScript} from '../src/core/sourceJavaScript';
import {sourceRuleText} from '../src/core/sourceRule';

test('executes the original 1321 source hex decoding expression', () => {
  const script='@js:var tt = /^[0-9a-fA-F]+$/.test(String(result).trim()) ? java.hexDecodeToString(result) : String(result);tt';
  expect(sourceRuleText('e8a5bfe6b8b8e8aeb0',script)).toBe('西游记');
  expect(sourceRuleText('普通正文',script)).toBe('普通正文');
});

test('hex string methods match native Hutool byte and UTF-8 behavior', () => {
  const cases: Array<[string,string]> = [
    ['', ''], [' ',''], ['f','\u000f'], ['41 42','AB'], ['ｅ４ｂ８ａｄ','中'],
    ['١٢','\u0012'], ['61\n62','ab'], ['efbbbf','\ufeff'], ['ed a0 80','\ufffd'],
    ['eda041','\ufffdA'], ['f08080','\ufffd\ufffd\ufffd'], ['ff','\ufffd'],
  ];
  for (const [hex, expected] of cases) expect(runSourceJavaScript('java.hexDecodeToString(result)',hex)).toBe(expected);
  expect(runSourceJavaScript('java.hexEncodeToString(result)','西游记𠮷')).toBe('e8a5bfe6b8b8e8aeb0f0a0aeb7');
  expect(runSourceJavaScript('java.hexEncodeToString(result)','\ud800')).toBe('3f');
  expect(runSourceJavaScript('try{java.hexDecodeToString("0x41")}catch(e){"caught"}','')).toBe('caught');
  expect(runSourceJavaScript('try{java.hexDecodeToString("1\\u200b2")}catch(e){"caught"}','')).toBe('caught');
  expect(()=>runSourceJavaScript('java.hexEncodeToString(result)','a'.repeat(500_001))).toThrow(/限制/);
});
