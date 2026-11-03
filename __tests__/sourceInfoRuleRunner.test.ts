jest.mock('../src/data/storage',()=>({appStorage:{getString:jest.fn(),set:jest.fn(),remove:jest.fn()}}));
jest.mock('../src/core/sourceRequest',()=>({buildSourcePageRequest:jest.fn((_source,url)=>({url})),executeSourceRequest:jest.fn()}));
import {executeSourceRequest} from '../src/core/sourceRequest';
import {loadBookInfo,loadChapters} from '../src/core/webBook';
import {runSourceJavaScript} from '../src/core/sourceJavaScript';
import type {SourceRuleScriptTask} from '../src/core/sourceRule';
import type {BookSource,SearchBook} from '../src/types';
const request=executeSourceRequest as jest.MockedFunction<typeof executeSourceRequest>;
const source:BookSource={bookSourceUrl:'https://example.org',bookSourceName:'测试',bookSourceType:0,customOrder:0,enabled:true,enabledExplore:false,ruleBookInfo:{init:'@js:java.put("step","初始化");result.book',intro:'@js:java.put("step",java.get("step")+"简介");result.intro',name:'@js:result.name+java.get("step")',author:'@js:result.author',kind:'@js:result.kind',wordCount:'@js:result.words',tocUrl:'@js:baseUrl',lastChapter:'@js:result.latest'},ruleToc:{chapterList:'$.book.chapters[*]',chapterName:'$.name',chapterUrl:'$.url'}};
const book:SearchBook={bookUrl:'https://example.org/book',origin:source.bookSourceUrl,originName:source.bookSourceName,name:'',author:''};
const data={book:{name:'书',author:'作者',intro:'介绍',kind:'玄幻',words:'1200',latest:'终章',chapters:[{name:'第一章',url:'/1'}]}};
beforeEach(()=>request.mockReset());
test('detail rules use the async runner in order and retain the cached page for the catalogue',async()=>{
 request.mockResolvedValue({url:book.bookUrl,data});const signal=new AbortController().signal;
 const run=jest.fn(async(task:SourceRuleScriptTask,current?:AbortSignal)=>{expect(current).toBe(signal);await Promise.resolve();return runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);});
 const result=await loadBookInfo(source,{...book},signal,{runRuleJavaScript:run});
 expect(result).toMatchObject({name:'书初始化简介',author:'作者',intro:'介绍',kind:'玄幻',tocUrl:book.bookUrl,latestChapterTitle:'终章'});
 expect(JSON.parse(result.variable!).step).toBe('初始化简介');expect(run.mock.calls.length).toBeGreaterThan(4);
 expect((await loadChapters(source,result)).map(x=>x.title)).toEqual(['第一章']);expect(request).toHaveBeenCalledTimes(1);
});
test('cancellation inside an optional metadata script propagates and stops further extraction',async()=>{
 request.mockResolvedValue({url:book.bookUrl,data});const controller=new AbortController();
 const run=jest.fn(async(task:SourceRuleScriptTask)=>{if(task.script==='result.kind')controller.abort();return runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);});
 await expect(loadBookInfo(source,{...book},controller.signal,{runRuleJavaScript:run})).rejects.toMatchObject({name:'AbortError'});
 expect(run.mock.calls.some(([task])=>task.script==='result.words')).toBe(false);
});
test('optional metadata failures and web-file downloads match synchronous detail parsing',async()=>{
 const fileSource={...source,bookSourceType:3,ruleBookInfo:{...source.ruleBookInfo,kind:'@js:throw "invalid category"',wordCount:'@js:throw "invalid count"',downloadUrls:'$.files[*]'}};
 request.mockResolvedValue({url:book.bookUrl,data:{book:{...data.book,files:['/one.zip','/one.zip','/two.zip']}}});
 const run=async(task:SourceRuleScriptTask)=>runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);
 const sync=await loadBookInfo(fileSource,{...book}),asyncResult=await loadBookInfo(fileSource,{...book},undefined,{runRuleJavaScript:run});
 expect(asyncResult).toEqual(sync);expect(asyncResult.downloadUrls).toEqual(['https://example.org/one.zip','https://example.org/two.zip']);
});
