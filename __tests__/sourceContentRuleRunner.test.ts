jest.mock('../src/data/storage',()=>({appStorage:{getString:jest.fn(),set:jest.fn(),remove:jest.fn()}}));
import {loadChapterPayload} from '../src/core/webBook';
import {runSourceJavaScript} from '../src/core/sourceJavaScript';
import type {SourceRuleScriptTask} from '../src/core/sourceRule';
import type {BookChapter,BookSource} from '../src/types';

const source:BookSource={bookSourceUrl:'https://example.org',bookSourceName:'测试',bookSourceType:0,customOrder:0,enabled:true,enabledExplore:false,ruleContent:{content:'p@text@js:result+java.put("seen","!")',subContent:'i@text@js:result+"副"',nextContentUrl:'a@href@js:result',replaceRegex:'@js:result.replace(/正文/g,"内容")'}};
const chapter:BookChapter={url:'https://example.org/1',title:'第一章',index:0,bookUrl:'https://example.org/book',baseUrl:'https://example.org/book',isVolume:false,isVip:false,isPay:false};
const response=(body:string,url:string)=>({ok:true,status:200,url,headers:{get:()=>null,forEach:()=>{}},text:async()=>body});
afterEach(()=>jest.restoreAllMocks());

test('content, subcontent, pagination and replacement use the supplied asynchronous rule runner',async()=>{
  const controller=new AbortController();
  jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(response('<p>正文一</p><i>一</i><a href="/2">下页</a>','https://example.org/1') as unknown as Response)
    .mockResolvedValueOnce(response('<p>正文二</p><i>二</i>','https://example.org/2') as unknown as Response);
  const run=jest.fn(async(task:SourceRuleScriptTask,signal?:AbortSignal)=>{
    expect(signal).toBe(controller.signal);
    await Promise.resolve();
    return runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);
  });
  const result=await loadChapterPayload(source,chapter,{runRuleJavaScript:run,signal:controller.signal});
  expect(result.content).toContain('内容一!');expect(result.content).toContain('内容二!');
  expect(result.subContent).toBe('一副\n二副');expect(result.variable).toContain('seen');
  expect(run.mock.calls.map(([task])=>task.script)).toEqual(expect.arrayContaining(['result+java.put("seen","!")','result+"副"','result','result.replace(/正文/g,"内容")']));
});

test('cancelling while extracting content stops subsequent stages and page requests',async()=>{
  const controller=new AbortController(),fetcher=jest.spyOn(globalThis,'fetch').mockResolvedValue(response('<p>正文</p><a href="/2">下页</a>','https://example.org/1') as unknown as Response);
  const run=jest.fn(async()=>{controller.abort();return '正文';});
  await expect(loadChapterPayload(source,chapter,{runRuleJavaScript:run,signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
  expect(run).toHaveBeenCalledTimes(1);expect(fetcher).toHaveBeenCalledTimes(1);
});
