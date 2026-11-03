import {runInNewContext} from 'node:vm';
import {prepareSourceWorkerScript, invokeSourceWorkerBridge, createSourceWorkerBridge} from '../src/core/sourceWorkerBridge';
import {SourceRuleError} from '../src/core/errors';
import {createSourceRuleLookup,sourceRuleText} from '../src/core/sourceRule';
import fixture from './fixtures/source-post-1321-weishuxiang.json';
import defaults from '../src/assets/defaultBookSources.json';
import signing from './fixtures/source-1321-quanmian-signing.json';

jest.mock('react-native-quick-base64',()=>({
  fromByteArray:(bytes:Uint8Array)=>Buffer.from(bytes).toString('base64'),
  toByteArray:(input:string)=>new Uint8Array(Buffer.from(input,'base64')),
}));
jest.mock('react-native-quick-crypto',()=>require('crypto'));

test('runs the original 1321 signed search rule through the worker facade',()=>{
  const calls:unknown[]=[];
  const context={baseUrl:signing.bookSourceUrl,sourceUrl:signing.bookSourceUrl,key:'西游记',page:2,result:''};
  const call=(action:string,args:unknown[])=>{calls.push([action,Array.from(args)]);if(action==='java.md5Encode')return require('crypto').createHash('md5').update(String(args[0])).digest('hex');};
  const value=runInNewContext(prepareSourceWorkerScript('Date.now=()=>1700000000000;\n'+signing.searchUrl.replace(/^@js:\s*/,'')),{__legado:{context,call}});
  const url=new URL(value);
  expect(url.searchParams.get('keywords')).toBe('西游记');expect(url.searchParams.get('page')).toBe('1');
  expect(url.searchParams.get('sign')).toBe(require('crypto').createHash('md5').update(String((calls[0] as [string,string[]])[1][0])).digest('hex').toUpperCase());
});

test('worker MD5 methods match Java UTF-8 and enforce per-task limits',async()=>{
  const bridge={baseUrl:'',key:null,page:null,ajax:async()=>'',removeCookie:()=>{}};
  const adapter=createSourceWorkerBridge(bridge),signal=new AbortController().signal;
  await expect(adapter.invoke('java.md5Encode',['西游记'],signal)).resolves.toBe('9db64a7a1f63a775102be1d7713f57f1');
  await expect(adapter.invoke('java.md5Encode16',['abc'],signal)).resolves.toBe('3cd24fb0d6963f7d');
  await expect(adapter.invoke('java.md5Encode',['\ud800'],signal)).resolves.toBe(require('crypto').createHash('md5').update('?').digest('hex'));
  expect(()=>adapter.invoke('java.md5Encode',['x'.repeat(64001)],signal)).toThrow(/限制/);
  const limited=createSourceWorkerBridge(bridge);for(let i=0;i<15;i++)await limited.invoke('java.md5Encode',['x'.repeat(64000)],signal);
  expect(()=>limited.invoke('java.md5Encode',['x'.repeat(64000)],signal)).toThrow(/限制/);
});

test('exposes Base64 methods to original 1321 chapter scripts',()=>{
  const calls:unknown[]=[];
  const context={baseUrl:'',key:null,page:1,result:"qsbs.bb('6KW/5ri46K6w');qsbs.bb('5q2j5paH');"};
  const call=(action:string,args:unknown[])=>{
    calls.push([action,Array.from(args)]);
    if(action==='java.base64Decode')return Buffer.from(String(args[0]),'base64').toString('utf8');
  };
  const script="var s=''+result;var re=/qsbs\\.bb\\('([^']+)'\\)/g;var m;var o='';while((m=re.exec(s))!==null){try{o+=java.base64Decode(m[1])}catch(e){}}o";
  expect(runInNewContext(prepareSourceWorkerScript(script),{__legado:{context,call}})).toBe('西游记正文');
  expect(calls).toEqual([['java.base64Decode',['6KW/5ri46K6w']],['java.base64Decode',['5q2j5paH']]]);
});

test('worker Base64 bridge matches interpreter flags, charsets, invalid input and work limits',async()=>{
  const bridge={baseUrl:'',key:null,page:null,ajax:async()=>'',removeCookie:()=>{}};
  const adapter=createSourceWorkerBridge(bridge),signal=new AbortController().signal;
  await expect(adapter.invoke('java.base64Encode',['西游记'],signal)).resolves.toBe('6KW/5ri46K6w');
  await expect(adapter.invoke('java.base64Encode',['?',11],signal)).resolves.toBe('Pw');
  await expect(adapter.invoke('java.base64Encode',['x',0],signal)).resolves.toBe('eA==\n');
  await expect(adapter.invoke('java.base64Encode',['x',4],signal)).resolves.toBe('eA==\r\n');
  await expect(adapter.invoke('java.base64Decode',['6KW_5ri46K6w',8],signal)).resolves.toBe('西游记');
  await expect(adapter.invoke('java.base64Decode',[' zvc= ','GBK'],signal)).resolves.toBe('西');
  await expect(adapter.invoke('java.base64Decode',['A'],signal)).rejects.toThrow(/Base64/);
  await expect(adapter.invoke('java.base64Decode',['eA==','bad-charset'],signal)).rejects.toThrow(/字符集/);
  expect(()=>adapter.invoke('java.base64Encode',['x'.repeat(64001)],signal)).toThrow(/限制/);
  const limited=createSourceWorkerBridge(bridge);
  for(let i=0;i<15;i++) await limited.invoke('java.base64Encode',['x'.repeat(64000)],signal);
  expect(()=>limited.invoke('java.base64Encode',['x'.repeat(64000)],signal)).toThrow(/限制/);
});

test('enforces rule-mode capabilities even when scripts call the raw worker bridge',async()=>{
  const ajax=jest.fn(async()=> 'response'),removeCookie=jest.fn(),toast=jest.fn();
  const bridge={baseUrl:'https://example.org',key:null,page:null,ajax,removeCookie,toast,ruleMode:true};
  const adapter=createSourceWorkerBridge(bridge),signal=new AbortController().signal;
  for(const action of ['java.ajax','java.post','java.connect','java.startBrowserAwait','java.toast','cookie.getCookie','cookie.removeCookie']) {
    await expect(Promise.resolve().then(()=>adapter.invoke(action,['https://example.org'],signal))).rejects.toThrow(/不支持/);
  }
  expect(ajax).not.toHaveBeenCalled();expect(removeCookie).not.toHaveBeenCalled();expect(toast).not.toHaveBeenCalled();
  await expect(adapter.invoke('java.base64Encode',['x'],signal)).resolves.toBe('eA==');
});

test('requires an exposed source object before accessing persisted source variables',async()=>{
  const get=jest.fn(()=> 'secret');
  const sourceVariables={get,put:(_key:string,value:string)=>value,getVariable:()=>'',setVariable:()=>{}};
  const adapter=createSourceWorkerBridge({baseUrl:'https://example.org',key:null,page:null,ajax:async()=>'',removeCookie:()=>{},sourceVariables,ruleMode:true});
  await expect(Promise.resolve().then(()=>adapter.invoke('source.get',['x'],new AbortController().signal))).rejects.toThrow(/不支持/);
  expect(get).not.toHaveBeenCalled();
});

test('runs the original 7663 search expressions through the worker bridge', () => {
  const context = {baseUrl:defaults[0].bookSourceUrl,sourceUrl:defaults[0].bookSourceUrl,key:'西游记',page:1,result:''};
  const parts = [...defaults[0].searchUrl.matchAll(/\{\{([\s\S]*?)\}\}/g)].map(match=>match[1]);
  const calls: unknown[] = [];
  const call = (action:string,args:unknown[]) => {
    calls.push([action,args]);
    if (action === 'java.ajax') return '<form id="search" action="/search21.html">';
    if (action === 'java.encodeURI') return '%E8%A5%BF%E6%B8%B8%E8%AE%B0';
  };
  const run = (script:string) => runInNewContext(prepareSourceWorkerScript(script),{__legado:{context,call}});
  run(parts[0]);
  expect(run(parts[1])).toBe('http://www.kkbiquge.net/search21.html?searchkey=%E8%A5%BF%E6%B8%B8%E8%AE%B0');
  expect(calls).toEqual([['cookie.removeCookie',[context.sourceUrl]],['java.ajax',[context.sourceUrl+'/']],['java.encodeURI',['西游记']]]);
});

test('exposes response header lookup for the original 1321 post search rule', () => {
  const context={baseUrl:fixture.bookSourceUrl,sourceUrl:fixture.bookSourceUrl,key:'书',page:1,result:''};
  const call=(action:string) => action==='java.post' ? {header:(name:string)=>name.toLowerCase()==='location'?'/e/search/result/index.php?searchid=42':null} : null;
  expect(runInNewContext(prepareSourceWorkerScript(fixture.searchUrl.replace(/^@js:\s*/,'')),{__legado:{context,call}})).toBe('/e/search//e/search/result/index.php?page={{page-1}}&searchid=42');
});

test('maps initial and retried login responses to their original objects', async () => {
  const initial={data:'challenge',body:'challenge',url:'https://example.org',code:403};
  const retried={data:'ok',body:'ok',url:'https://example.org',code:200};
  const bridge={baseUrl:'https://example.org',key:null,page:1,response:initial,removeCookie:()=>{},ajax:async()=>'',connect:async()=>retried};
  const adapter=createSourceWorkerBridge(bridge);
  expect(adapter.resolveResponse(adapter.initialResponse!.handle)).toBe(initial);
  const next=await adapter.invoke('java.connect',['https://example.org'],new AbortController().signal) as {handle:string};
  expect(adapter.resolveResponse(next.handle)).toBe(retried);
  expect(adapter.resolveResponse('forged')).toBeUndefined();
});

test('uses Java form encoding and delegates requests to the existing source bridge', async () => {
  const ajax=jest.fn(async()=>'<html>'),removeCookie=jest.fn();
  const bridge={baseUrl:'https://example.org',key:'书',page:1,ajax,removeCookie};
  const signal=new AbortController().signal;
  await expect(invokeSourceWorkerBridge(bridge,'java.encodeURI',['a b~书','UTF-8'],signal)).resolves.toBe('a+b%7E%E4%B9%A6');
  await expect(invokeSourceWorkerBridge(bridge,'java.ajax',['https://example.org/'],signal)).resolves.toBe('<html>');
  await invokeSourceWorkerBridge(bridge,'cookie.removeCookie',['https://example.org'],signal);
  expect(ajax).toHaveBeenCalledWith('https://example.org/');
  expect(removeCookie).toHaveBeenCalledWith('https://example.org');
  await expect(invokeSourceWorkerBridge(bridge,'other',[],signal)).rejects.toBeInstanceOf(SourceRuleError);
});

test('preserves source error policy and ignores a response after cancellation', async () => {
  const controller = new AbortController();
  let finish!: (value:string)=>void;
  const bridge={baseUrl:'https://example.org',key:null,page:null,removeCookie:()=>{},ajax:()=>new Promise<string>(resolve=>{finish=resolve;})};
  const pending=invokeSourceWorkerBridge(bridge,'java.ajax',['https://example.org'],controller.signal);
  controller.abort();
  finish('late');
  await expect(pending).rejects.toMatchObject({name:'AbortError'});
  const signal=new AbortController().signal;
  await expect(invokeSourceWorkerBridge({...bridge,ajax:async()=>{throw new Error('offline');}},'java.ajax',['x'],signal)).resolves.toBe('Error: offline');
  await expect(invokeSourceWorkerBridge({...bridge,ajax:async()=>{throw new SourceRuleError('blocked');}},'java.ajax',['x'],signal)).rejects.toThrow('blocked');
});

test('validates post headers and timeout before invoking the source', async () => {
  const post=jest.fn(async()=>({data:'',body:'',url:'https://example.org',code:200}));
  const bridge={baseUrl:'https://example.org',key:null,page:null,removeCookie:()=>{},ajax:async()=>'',post};
  const signal=new AbortController().signal;
  await expect(invokeSourceWorkerBridge(bridge,'java.post',['url','body','{bad'],signal)).rejects.toThrow(/请求头/);
  await expect(invokeSourceWorkerBridge(bridge,'java.post',['url','body',{},30001],signal)).rejects.toThrow(/超时/);
  expect(post).not.toHaveBeenCalled();
});

test('source.getKey remains the original source address if its visible key changes', () => {
  const context={sourceUrl:'https://example.org',baseUrl:'https://example.org',key:null,page:1,result:''};
  expect(runInNewContext(prepareSourceWorkerScript('source.key="changed";source.getKey()'),{__legado:{context,call:()=>{}}})).toBe('https://example.org');
});

test('limits source requests and preserves a synthetic connect response on network failure', async () => {
  const bridge={baseUrl:'https://example.org',key:null,page:1,removeCookie:()=>{},ajax:async()=>'',connect:async()=>{throw new Error('offline');}};
  const adapter=createSourceWorkerBridge(bridge),signal=new AbortController().signal;
  const response=await adapter.invoke('java.connect',['/offline'],signal) as {handle:string;body:string;url:string;code:number};
  expect(response).toMatchObject({body:'Error: offline',url:'https://example.org/offline',code:200});
  expect(adapter.resolveResponse(response.handle)).toMatchObject({body:'Error: offline'});
  for(let i=0;i<7;i++) await adapter.invoke('java.ajax',['/'],signal);
  expect(()=>adapter.invoke('java.ajax',['/'],signal)).toThrow(/次数/);
});

test('shares book and source variables across separate script tasks', async () => {
  const values=new Map<string,string>(),stored=new Map<string,string>();let whole:string|null=null;
  const sourceVariables={get:(key:string)=>stored.get(key)??'',put:(key:string,value:string)=>{stored.set(key,value);return value;},getVariable:()=>whole??'',setVariable:(value:string|null)=>{whole=value;}};
  const bridge={baseUrl:'https://example.org',key:'西游记',page:1,ajax:async()=>'',removeCookie:()=>{},variables:values,fallbackVariables:new Map([['fallback','旧值']]),bookName:'书名',chapterTitle:'章节',sourceVariables};
  const signal=new AbortController().signal,first=createSourceWorkerBridge(bridge),second=createSourceWorkerBridge(bridge);
  expect(await first.invoke('java.put',['key','西游记'],signal)).toBe('西游记');
  expect(await first.invoke('source.put',['id','42'],signal)).toBe('42');
  await first.invoke('source.setVariable',['route'],signal);
  expect(await second.invoke('java.get',['key'],signal)).toBe('西游记');
  expect(await second.invoke('java.get',['fallback'],signal)).toBe('旧值');
  expect(await second.invoke('java.get',['bookName'],signal)).toBe('书名');
  expect(await second.invoke('java.get',['title'],signal)).toBe('章节');
  expect(await second.invoke('source.get',['id'],signal)).toBe('42');
  expect(await second.invoke('source.getVariable',[],signal)).toBe('route');
  await second.invoke('source.setVariable',[null],signal);expect(whole).toBeNull();
});

test('does not swallow source variable storage errors or exceed book variable limits', async () => {
  const sourceVariables={get:()=>'',put:()=>{throw Error('damaged cache');},getVariable:()=>'',setVariable:()=>{}};
  const bridge={baseUrl:'https://example.org',key:null,page:1,ajax:async()=>'',removeCookie:()=>{},variables:new Map<string,string>(),sourceVariables};
  const adapter=createSourceWorkerBridge(bridge),signal=new AbortController().signal;
  await expect(adapter.invoke('source.put',['x','y'],signal)).rejects.toBeInstanceOf(SourceRuleError);
  for(let i=0;i<1024;i++) bridge.variables.set(String(i),'x');
  await expect(adapter.invoke('java.put',['new','x'],signal)).rejects.toThrow(/数量/);
  expect(bridge.variables.has('new')).toBe(false);
});

test('preserves JavaScript primitive coercion when sending variable arguments', () => {
  const calls:unknown[]=[];
  const context={sourceUrl:'https://example.org',baseUrl:'https://example.org',key:null,page:1,result:'',hasSourceVariables:true};
  runInNewContext(prepareSourceWorkerScript('java.put(undefined,NaN);source.put(true,Infinity);source.setVariable(undefined);'),{__legado:{context,call:(action:string,args:unknown[])=>calls.push([action,Array.from(args)])}});
  expect(calls).toEqual([['java.put',['undefined','NaN']],['source.put',['true','Infinity']],['source.setVariable',[null]]]);
});

test('queries the original rule content and supports setContent and URL resolution', async () => {
  const html='<a href="../read?a=1&amp;amp;b=2">正文</a><p>甲&amp;amp;乙</p>';
  const lookup=createSourceRuleLookup(html,{baseUrl:'https://request.example/book',redirectUrl:'https://cdn.example/dir/page'});
  const bridge={baseUrl:'https://request.example/book',key:null,page:1,ajax:async()=>'',removeCookie:()=>{},lookup};
  const adapter=createSourceWorkerBridge(bridge),signal=new AbortController().signal;
  await expect(adapter.invoke('java.getString',['tag.a@href',null,true],signal)).resolves.toBe('https://cdn.example/read?a=1&b=2');
  await expect(adapter.invoke('java.getString',['p@text',false],signal)).resolves.toBe('甲&amp;乙');
  await expect(adapter.invoke('java.getString',['p@text',true],signal)).resolves.toBe('甲&乙');
  await adapter.invoke('java.setContent',['<p>新内容</p>'],signal);
  await expect(adapter.invoke('java.getString',['p@text'],signal)).resolves.toBe('新内容');
  await expect(adapter.invoke('java.getString',['@js:1'],signal)).rejects.toThrow(/嵌套/);
});

test('limits rule lookups and refuses invalid overloads', async () => {
  const lookup=createSourceRuleLookup('<p>正文</p>');
  const bridge={baseUrl:'https://example.org',key:null,page:1,ajax:async()=>'',removeCookie:()=>{},lookup};
  const adapter=createSourceWorkerBridge(bridge),signal=new AbortController().signal;
  await expect(adapter.invoke('java.getStringList',['p@text','<p>自定义</p>',false],signal)).resolves.toEqual(['自定义']);
  await expect(adapter.invoke('java.getStringList',['p@text',true],signal)).rejects.toThrow(/解码/);
  for(let i=0;i<14;i++) await adapter.invoke('java.getString',['p@text'],signal);
  expect(()=>adapter.invoke('java.getString',['p@text'],signal)).toThrow(/次数/);
});

test('exposes task-local DOM queries and resolves returned nodes', async () => {
  const lookup=createSourceRuleLookup('<div><a href="/a">甲</a><a href="/b">乙</a></div>');
  const adapter=createSourceWorkerBridge({baseUrl:'https://example.org',key:null,page:1,ajax:async()=>'',removeCookie:()=>{},lookup});
  const signal=new AbortController().signal;
  const result=await adapter.invoke('java.getElements',['tag.a'],signal) as {kind:string;handles:string[]};
  expect(result.kind).toBe('elements');
  await expect(adapter.invoke('dom.text',[result.handles],signal)).resolves.toBe('甲 乙');
  await expect(adapter.invoke('dom.attr',[result.handles,'href'],signal)).resolves.toBe('/a');
  expect(sourceRuleText(adapter.resolveNode(result.handles[1]),'text')).toBe('乙');
  await expect(adapter.invoke('dom.text',[['unknown']],signal)).rejects.toThrow(/元素/);
});

test('accepts a selected element as custom lookup content', async () => {
  const lookup=createSourceRuleLookup('<div><b>选中</b></div><p>原始</p>');
  const adapter=createSourceWorkerBridge({baseUrl:'https://example.org',key:null,page:1,ajax:async()=>'',removeCookie:()=>{},lookup});
  const signal=new AbortController().signal;
  const elements=await adapter.invoke('java.getElements',['tag.div'],signal) as {handles:string[]};
  await expect(adapter.invoke('java.getStringNode',['tag.b@text',elements.handles[0]],signal)).resolves.toBe('选中');
  await adapter.invoke('java.setContentNode',[elements.handles[0]],signal);
  await expect(adapter.invoke('java.getString',['tag.b@text'],signal)).resolves.toBe('选中');
  await expect(adapter.invoke('java.getStringNode',['tag.b@text','unknown'],signal)).rejects.toThrow(/元素/);
});

test('java.log returns the original value while logging a safe object description', () => {
  const calls:unknown[]=[];
  const context={sourceUrl:'https://example.org',baseUrl:'https://example.org',key:null,page:1,result:''};
  const result=runInNewContext(prepareSourceWorkerScript('var x={name:"甲"};java.log(x)===x'),{__legado:{context,call:(action:string,args:unknown[])=>calls.push([action,Array.from(args)])}});
  expect(result).toBe(true);
  expect(calls).toEqual([['java.log',['[object Object]']]]);
});

test('rule scripts expose source-variable fallback without search-only network APIs', async () => {
  const sourceVariables={get:(key:string)=>key==='saved'?'持久值':'',put:(_key:string,value:string)=>value,getVariable:()=>'',setVariable:()=>{}};
  const bridge={baseUrl:'',key:null,page:null,ajax:async()=>'',removeCookie:()=>{},sourceVariables,ruleMode:true};
  const adapter=createSourceWorkerBridge(bridge);
  await expect(adapter.invoke('java.get',['saved'],new AbortController().signal)).resolves.toBe('持久值');
  const context={baseUrl:undefined,sourceUrl:undefined,key:null,page:null,result:'',ruleMode:true,hasSource:false,hasSourceVariables:false};
  const result=runInNewContext(prepareSourceWorkerScript('typeof java.ajax+":"+typeof cookie+":"+typeof source'),{__legado:{context,call:()=>{}}});
  expect(result).toBe('undefined:undefined:undefined');
});
