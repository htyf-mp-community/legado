jest.mock('react-native-quick-crypto',()=>require('node:crypto'));
jest.mock('react-native-quick-base64',()=>({fromByteArray:(bytes:Uint8Array)=>Buffer.from(bytes).toString('base64'),toByteArray:(text:string)=>new Uint8Array(Buffer.from(text,'base64'))}));
import {runInNewContext} from 'node:vm';
import {createSourceWorkerBridge,prepareSourceWorkerScript} from '../src/core/sourceWorkerBridge';

const create=()=>createSourceWorkerBridge({baseUrl:'https://example.org',key:null,page:null,ajax:async()=>'',removeCookie:()=>{}});
const signal=new AbortController().signal;

test('exposes methods used by original Chinese source rules',()=>{
  const calls:unknown[]=[];const call=(action:string,args:unknown[])=>{calls.push([action,Array.from(args)]);if(action==='java.t2s')return '繁体书籍';if(action==='java.toNumChapter')return '第12章';return '西游记';};
  const run=(script:string,result:unknown)=>runInNewContext(prepareSourceWorkerScript(script),{__legado:{context:{result},call}});
  expect(run('java.t2s(result)','繁體書籍')).toBe('繁体书籍');
  expect(run('result.replace(/第([零一二两三四五六七八九十百千]+)章/g,java.toNumChapter(result))','第十二章')).toBe('第12章');
  expect(run('var tt=/^[0-9a-fA-F]+$/.test(String(result).trim())?java.hexDecodeToString(result):String(result);tt','e8a5bfe6b8b8e8aeb0')).toBe('西游记');
  expect(calls.map(item=>(item as unknown[])[0])).toEqual(['java.t2s','java.toNumChapter','java.hexDecodeToString']);
});

test('converts text, chapter numbers and native-compatible hexadecimal',async()=>{
  const a=create();
  await expect(a.invoke('java.t2s',['繁體書籍與網頁'],signal)).resolves.toBe('繁体书籍与网页');
  await expect(a.invoke('java.s2t',['汉语书籍'],signal)).resolves.toBe('漢語書籍');
  await expect(a.invoke('java.toNumChapter',['第十二章 余下标题'],signal)).resolves.toBe('第12章');
  await expect(a.invoke('java.toNumChapter',[null],signal)).resolves.toBeNull();
  await expect(a.invoke('java.hexDecodeToString',['ｅ４ｂ８ａｄ'],signal)).resolves.toBe('中');
  await expect(a.invoke('java.hexEncodeToString',['西游记𠮷'],signal)).resolves.toBe('e8a5bfe6b8b8e8aeb0f0a0aeb7');
  await expect(a.invoke('java.hexDecodeToString',['0x41'],signal)).rejects.toThrow();
  await expect(a.invoke('java.t2s',[{}],signal)).rejects.toThrow(/基本类型/);
});

test('shares conversion budget with crypto input for each task',async()=>{
  const a=create(),text='x'.repeat(50_000);
  for(let i=0;i<98;i++)await a.invoke('java.t2s',[text],signal);
  await a.invoke('java.strToBytes',[text.slice(0,8000)],signal);
  await expect(a.invoke('java.t2s',['x'.repeat(100_000)],signal)).rejects.toThrow(/限制/);
  await expect(create().invoke('java.t2s',['繁體'],signal)).resolves.toBe('繁体');
});
