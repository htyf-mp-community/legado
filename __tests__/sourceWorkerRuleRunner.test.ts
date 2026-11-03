import {createSourceWorkerRuleRunner} from '../src/core/sourceWorkerRuleRunner';
import {createSourceRuleLookup} from '../src/core/sourceRule';
import type {SourceJavaScriptBridge} from '../src/core/sourceJavaScript';

test('passes rule input, lookup, context, variables and cancellation to the worker executor',async()=>{
  const lookup=createSourceRuleLookup('<p>正文</p>'),variables=new Map([['key','值']]),fallback=new Map([['book','书']]);
  const sourceVariables={get:()=>'',put:(_key:string,value:string)=>value,getVariable:()=>'',setVariable:()=>{}};
  const run=jest.fn(async(_script:string,_bridge:SourceJavaScriptBridge,_input:unknown,_signal?:AbortSignal)=>'结果');
  const runner=createSourceWorkerRuleRunner({run}),controller=new AbortController();
  const globals={baseUrl:'https://example.org/page',src:'<p>正文</p>',title:'第一章'};
  const result=await runner({script:'result',input:'正文',globals,lookup,variables,variableContext:{fallback,bookName:'书名',title:'第一章',sourceUrl:'https://example.org',sourceVariables}},controller.signal);
  expect(result).toBe('结果');
  expect(run).toHaveBeenCalledWith('result',expect.objectContaining({baseUrl:globals.baseUrl,sourceUrl:'https://example.org',lookup,variables,fallbackVariables:fallback,bookName:'书名',chapterTitle:'第一章',sourceVariables,ruleGlobals:globals,ruleMode:true}),'正文',controller.signal);
});
