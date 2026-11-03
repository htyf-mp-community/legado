jest.mock('../src/data/storage',()=>({appStorage:{getString:jest.fn(),set:jest.fn(),remove:jest.fn()}}));
jest.mock('../src/core/sourceRequest',()=>({buildSourcePageRequest:jest.fn((_source,url)=>({url})),executeSourceRequest:jest.fn()}));
jest.mock('../src/data/generalPreferences',()=>({loadGeneralPreferences:()=>({threadCount:2,tocCountWords:false})}));
import {executeSourceRequest} from '../src/core/sourceRequest';
import {loadChapters} from '../src/core/webBook';
import {runSourceJavaScript,type SourceJavaScriptBridge} from '../src/core/sourceJavaScript';
import type {SourceRuleScriptTask} from '../src/core/sourceRule';
import type {BookSource,SearchBook} from '../src/types';

const request=executeSourceRequest as jest.MockedFunction<typeof executeSourceRequest>;
const source:BookSource={bookSourceUrl:'https://source.test',bookSourceName:'目录',bookSourceType:0,customOrder:0,enabled:true,enabledExplore:false,ruleToc:{
 chapterList:'@js:java.put("phase",java.get("phase")+"L"); result.items',
 nextTocUrl:'@js:java.put("phase",java.get("phase")+"N"); result.next',
 chapterName:'@js:java.put("chapter",result.name); result.name+java.get("phase")',
 chapterUrl:'@js:"/"+java.get("chapter")',updateTime:'@js:java.get("phase")',isVolume:'@js:java.get("volume")',
}};
const book:SearchBook={origin:source.bookSourceUrl,originName:source.bookSourceName,name:'书',author:'',bookUrl:'https://source.test/book',tocUrl:'https://source.test/toc'};
beforeEach(()=>request.mockReset());

test('asynchronous directory rules preserve multi-page ordering and variable scopes',async()=>{
 request.mockImplementation(async input=>({url:input.url,data:input.url===book.tocUrl?{items:[{name:'甲'}],next:'/p2'}:{items:[{name:'乙'}],next:''}}));
 const signal=new AbortController().signal;
 const run=jest.fn(async(task:SourceRuleScriptTask,current?:AbortSignal)=>{expect(current).toBe(signal);await Promise.resolve();return runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);});
 const selected={...book};const chapters=await loadChapters(source,selected,signal,{runRuleJavaScript:run});
 expect(chapters.map(x=>[x.title,x.url,x.tag])).toEqual([['甲LN','https://source.test/甲','LN'],['乙LNLN','https://source.test/乙','LNLN']]);
 expect(chapters.map(x=>JSON.parse(x.variable!).chapter)).toEqual(['甲','乙']);expect(JSON.parse(selected.variable!).phase).toBe('LNLN');
 expect(run).toHaveBeenCalled();
});

test('directory parsing stops when a rule stage is cancelled',async()=>{
 request.mockResolvedValue({url:book.tocUrl!,data:{items:[{name:'甲'}],next:'/p2'}});
 const controller=new AbortController(),run=jest.fn(async()=>{controller.abort();return [];});
 await expect(loadChapters(source,{...book},controller.signal,{runRuleJavaScript:run})).rejects.toMatchObject({name:'AbortError'});
 expect(request).toHaveBeenCalledTimes(1);expect(run).toHaveBeenCalledTimes(1);
});

test('concurrent page parsing does not mix variables between asynchronous rule stages',async()=>{
 const paged={...source,ruleToc:{chapterList:'@js:java.put("current",result.id); result.items',nextTocUrl:'$.next[*]',chapterName:'@js:result.name+":"+java.get("current")',chapterUrl:'$.url'}};
 request.mockImplementation(async input=>({url:input.url,data:input.url===book.tocUrl
  ? {id:'first',items:[{name:'一',url:'/1'}],next:['/p2','/p3']}
  : {id:input.url.endsWith('/p2')?'second':'third',items:[{name:input.url.endsWith('/p2')?'二':'三',url:input.url}]}}));
 const run=async(task:SourceRuleScriptTask)=>{await Promise.resolve();return runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);};
 const chapters=await loadChapters(paged,{...book},undefined,{runRuleJavaScript:run});
 expect(chapters.map(x=>x.title)).toEqual(['一:first','二:second','三:third']);
});

test('concurrent login checks cannot overwrite variables while another page is being parsed',async()=>{
 const paged={...source,loginCheckJs:'result',ruleToc:{chapterList:'$.items[*]',nextTocUrl:'$.next[*]',chapterName:'@js:result.name+":"+java.get("current")',chapterUrl:'$.url'}};
 request.mockImplementation(async input=>({url:input.url,data:input.url===book.tocUrl
  ? {items:[{name:'一',url:'/1'}],next:['/p2','/p3']}
  : {items:[{name:input.url.endsWith('/p2')?'二':'三',url:input.url}]}}));
 const runLogin=async(_script:string,bridge:SourceJavaScriptBridge)=>{await Promise.resolve();bridge.variables!.set('current',bridge.response!.url.split('/').pop()!);return bridge.response;};
 const runRule=async(task:SourceRuleScriptTask)=>{await Promise.resolve();return runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);};
 const chapters=await loadChapters(paged,{...book},undefined,{runJavaScript:runLogin,runRuleJavaScript:runRule});
 expect(chapters.map(x=>x.title)).toEqual(['一:toc','二:p2','三:p3']);
});

test('a queued login check can recover a failed directory request',async()=>{
 const scripted={...source,loginCheckJs:'result',ruleToc:{chapterList:'$.items[*]',chapterName:'$.name',chapterUrl:'$.url'}};
 request.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({url:book.tocUrl!,data:{items:[{name:'恢复',url:'/1'}]},body:'recovered',code:200});
 const runLogin=async(_script:string,bridge:SourceJavaScriptBridge)=>bridge.response!.code===500 ? bridge.connect!(bridge.response!.url) : bridge.response;
 const runRule=async(task:SourceRuleScriptTask)=>runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);
 expect((await loadChapters(scripted,{...book},undefined,{runJavaScript:runLogin,runRuleJavaScript:runRule})).map(x=>x.title)).toEqual(['恢复']);
 expect(request).toHaveBeenCalledTimes(2);
});

test('cancellation rejects while a page is queued and prevents its script from starting',async()=>{
 const paged={...source,ruleToc:{chapterList:'@js:result.items',nextTocUrl:'$.next[*]',chapterName:'$.name',chapterUrl:'$.url'}};
 request.mockImplementation(async input=>({url:input.url,data:input.url===book.tocUrl
  ? {id:'first',items:[{name:'一',url:'/1'}],next:['/p2','/p3']}
  : {id:input.url.endsWith('/p2')?'second':'third',items:[{name:'章节',url:input.url}]}}));
 let release!:()=>void,started!:()=>void;
 const blocked=new Promise<void>(resolve=>{release=resolve;}),running=new Promise<void>(resolve=>{started=resolve;});
 const visited:string[]=[];
 const run=async(task:SourceRuleScriptTask)=>{
  const id=(task.input as {id:string}).id;visited.push(id);
  if(id==='second'){started();await blocked;}
  return runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);
 };
 const controller=new AbortController(),result=loadChapters(paged,{...book},controller.signal,{runRuleJavaScript:run});
 await running;controller.abort();
 await expect(result).rejects.toMatchObject({name:'AbortError'});
 release();await blocked;await Promise.resolve();await Promise.resolve();
 expect(visited).toEqual(['first','second']);expect(request).toHaveBeenCalledTimes(3);
});

test('a failing page does not run the next queued page',async()=>{
 const paged={...source,ruleToc:{chapterList:'@js:result.items',nextTocUrl:'$.next[*]',chapterName:'$.name',chapterUrl:'$.url'}};
 request.mockImplementation(async input=>({url:input.url,data:input.url===book.tocUrl
  ? {id:'first',items:[{name:'一',url:'/1'}],next:['/p2','/p3']}
  : {id:input.url.endsWith('/p2')?'second':'third',items:[{name:'章节',url:input.url}]}}));
 const visited:string[]=[];
 const run=async(task:SourceRuleScriptTask)=>{const id=(task.input as {id:string}).id;visited.push(id);if(id==='second')throw new Error('script failed');return runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);};
 await expect(loadChapters(paged,{...book},undefined,{runRuleJavaScript:run})).rejects.toThrow('script failed');
 await Promise.resolve();expect(visited).toEqual(['first','second']);
});
