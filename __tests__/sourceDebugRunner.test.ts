jest.mock('../src/data/storage',()=>({appStorage:{getString:jest.fn(),set:jest.fn(),remove:jest.fn()}}));
import {runSourceDebug} from '../src/core/sourceDebug';
import {runSourceJavaScript} from '../src/core/sourceJavaScript';
import type {SourceRuleScriptTask} from '../src/core/sourceRule';
import type {BookSource} from '../src/types';
const source:BookSource={bookSourceUrl:'https://example.org',bookSourceName:'调试',bookSourceType:0,customOrder:0,enabled:true,enabledExplore:true,searchUrl:'/search',ruleSearch:{bookList:'@js:result.books',name:'@js:result.name',bookUrl:'$.url'},ruleBookInfo:{intro:'@js:result.intro',tocUrl:'$.toc'},ruleToc:{chapterList:'@js:result.chapters',chapterName:'@js:result.name',chapterUrl:'$.url'},ruleContent:{content:'@js:result.content'}};
const responses=[{books:[{name:'测试书',url:'/book'}]},{intro:'介绍',toc:'/toc'},{chapters:[{name:'第一章',url:'/chapter'}]},{content:'正文'}];
afterEach(()=>jest.restoreAllMocks());
test('a single runner reaches all four debugging stages',async()=>{
 let index=0;const fetcher=jest.spyOn(globalThis,'fetch').mockImplementation(async input=>({ok:true,status:200,url:String(input),headers:{get:()=>null,forEach:()=>{}},text:async()=>JSON.stringify(responses[index++])}) as unknown as Response);
 const controller=new AbortController(),run=jest.fn(async(task:SourceRuleScriptTask,signal?:AbortSignal)=>{expect(signal).toBe(controller.signal);await Promise.resolve();return runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);});
 const events:string[]=[];const result=await runSourceDebug(source,'书',event=>events.push(`${event.stage}:${event.status}`),undefined,{signal:controller.signal,runRuleJavaScript:run});
 expect(result.content).toContain('正文');expect(result.info.intro).toBe('介绍');expect(events).toEqual(['search:running','search:success','info:running','info:success','toc:running','toc:success','content:running','content:success']);
 expect(run.mock.calls.map(([task])=>task.script)).toEqual(expect.arrayContaining(['result.books','result.intro','result.chapters','result.content']));expect(fetcher).toHaveBeenCalledTimes(4);
});
test('cancellation during detail extraction stops subsequent debug stages',async()=>{
 let index=0;const fetcher=jest.spyOn(globalThis,'fetch').mockImplementation(async input=>({ok:true,status:200,url:String(input),headers:{get:()=>null,forEach:()=>{}},text:async()=>JSON.stringify(responses[index++])}) as unknown as Response);
 const controller=new AbortController(),run=jest.fn(async(task:SourceRuleScriptTask)=>{if(task.script==='result.intro')controller.abort();return runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);});
 const events:string[]=[];await expect(runSourceDebug(source,'书',event=>events.push(`${event.stage}:${event.status}`),undefined,{signal:controller.signal,runRuleJavaScript:run})).rejects.toMatchObject({name:'AbortError'});
 expect(events.at(-1)).toBe('info:error');expect(fetcher).toHaveBeenCalledTimes(2);
});
