import {runSourceJavaScript, runSourceJavaScriptAsync} from '../src/core/sourceJavaScript';
import {sourceRuleText} from '../src/core/sourceRule';
import {convertChinese} from '../src/core/chineseConversion';

test('executes the original 包子漫画 traditional-to-simplified rule', () => {
  const input='<div>繁體書籍與網頁，周杰倫，奇幻魔法Melody</div>';
  expect(sourceRuleText(input, '<js>java.t2s(result)</js>')).toBe(convertChinese(input,1));
  expect(sourceRuleText(input, '<js>java.t2s(result)</js>')).toContain('繁体书籍与网页');
});

test('converts both directions in synchronous and asynchronous rules', async () => {
  const input='繁體中文和簡體中文';
  expect(runSourceJavaScript('java.t2s(result)',input)).toBe(convertChinese(input,1));
  expect(runSourceJavaScript('java.s2t(result)','汉语书籍')).toBe(convertChinese('汉语书籍',2));
  const bridge={baseUrl:'https://example.org',key:'书籍',page:1,ajax:async()=>'',removeCookie:()=>{}};
  expect(await runSourceJavaScriptAsync('java.s2t(key)',bridge)).toBe(convertChinese('书籍',2));
});

test('charges repeated conversion work and rejects object arguments', () => {
  expect(()=>runSourceJavaScript('var s="x";for(var i=0;i<13;i++)s+=s;for(var j=0;j<700;j++)java.t2s(s);','')).toThrow(/限制/);
  expect(()=>runSourceJavaScript('java.t2s({text:"繁體"})','')).toThrow(/基本类型/);
});

test('converts book pages larger than the small argument limit', () => {
  const page='繁體'.repeat(35_000);
  expect(runSourceJavaScript('java.t2s(result)',page)).toBe('繁体'.repeat(35_000));
});
