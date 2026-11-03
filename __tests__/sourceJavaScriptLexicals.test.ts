jest.mock('react-native-quick-base64',()=>({
  fromByteArray:(bytes:Uint8Array)=>Buffer.from(bytes).toString('base64'),
  toByteArray:(input:string)=>new Uint8Array(Buffer.from(input,'base64')),
}));
import {runSourceJavaScript} from '../src/core/sourceJavaScript';
import {sourceRuleText, sourceRuleValues} from '../src/core/sourceRule';
import sourceFixture from './fixtures/source-1321-qunxiaoshuo.json';

test('executes top-level let and const without changing ES5 strings or regexps',()=>{
  expect(runSourceJavaScript('let x=1; const y=2; x+=y; x','')).toBe(3);
  expect(runSourceJavaScript('var s="let value"; /const name/.test("const name") && s','')).toBe('let value');
  expect(runSourceJavaScript('const item={value:1};item.value=2;item.value','')).toBe(2);
  expect(runSourceJavaScript('let x=1; `value:${x}`','')).toBe('value:1');
});

test('executes the original 1321 collection search-detail script using lexical declarations and templates',()=>{
  const rule='@js:\nlet novelId=baseUrl.match(/novelId=(\\d+)/)[1];\nlet url = `novelId=${novelId}`;\nresult = `data:chapterList;base64,${java.base64Encode(url)},{"type":"jjwx"}`;';
  expect(sourceRuleText('',rule,false,{baseUrl:'https://example.org/?novelId=123'})).toBe('data:chapterList;base64,bm92ZWxJZD0xMjM=,{"type":"jjwx"}');
});

test.each([
  'x;let x=1;',
  'let x=x;',
  'let x=1;{let x=2;}x',
  'let x=1;function f(x){return x;}f(2)',
  'const x=1;x=2;',
  'const x=1;x++;',
  'const x=1;for(x in {}){}',
  'let result=1;result',
  'let x=1;this.x',
  'for(let i=0;i<2;i++){};i',
  'let x=1;"const text";',
])('rejects potentially different lexical behavior: %s',script=>{
  expect(()=>runSourceJavaScript(script,'')).toThrow();
});

test('executes a nonescaping loop binding from the original 1321 source pagination rule',()=>{
  const html='<div class="bookname">第一章 (1/3)</div>';
  expect(sourceRuleValues(html,sourceFixture.nextContentUrl,{baseUrl:'https://example.org/book/1.html'})).toEqual([
    'https://example.org/book/1_2.html','https://example.org/book/1_3.html',
  ]);
  expect(runSourceJavaScript('var s=0;for(let i=0;i<4;i++){s+=i;}s','')).toBe(6);
});

test.each([
  'for(let i=0;i<2;i++){};typeof i',
  'var out=[];for(let i=0;i<2;i++){out.push(function(){return i;});}out[0]()',
  'for(let i=i;i<2;i++){}',
  'for(let i;i<2;i++){}',
  'for(let i=0;i<2;i++){};var i=3;',
  'for(const i=0;i<2;i++){}',
  'for(let i in {a:1}){}',
])('rejects loop bindings requiring distinct lexical semantics: %s',script=>{
  expect(()=>runSourceJavaScript(script,'')).toThrow();
});

test('does not expose the template helper for scripts with lexical declarations alone',()=>{
  expect(runSourceJavaScript('let x=1;typeof __legado_template_string_intrinsic__','')).toBe('undefined');
});
