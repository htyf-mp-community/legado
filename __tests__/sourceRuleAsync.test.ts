import {sourceRuleText,sourceRuleValues,sourceRuleTextAsync,sourceRuleValuesAsync,type SourceRuleScriptTask} from '../src/core/sourceRule';
import {runSourceJavaScript} from '../src/core/sourceJavaScript';

const run=async(task:SourceRuleScriptTask)=>runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);

test.each([
  ['plain selector','<p>甲</p><p>乙</p>','p@text'],
  ['script on selection','<h1>书名</h1><span class="author">作者</span>','tag.h1@text@js:result+":"+java.getString("class.author@text")'],
  ['script before selector','<div><a href="/1">第一章</a></div>','<js>result</js>tag.a@text'],
  ['template expression','<p>原文</p>','书名:{{"西游"+"记"}}'],
  ['replacement chain','<p>第一章</p>','p@text@js:result.replace(/第一/,"第二")'],
  ['JSON lookup',{book:{name:'西游记'}},'@js:java.getString("$.book.name")'],
])('async %s preserves the existing rule result',async(_name,value,rule)=>{
  await expect(sourceRuleTextAsync(value,rule,false,undefined,run)).resolves.toBe(sourceRuleText(value,rule));
});

test('async rule awaits script stages and retains DOM nodes',async()=>{
  const html='<div><a href="/a">甲</a><a href="/b">乙</a></div>',calls:string[]=[];
  const execute=async(task:SourceRuleScriptTask)=>{calls.push(task.script);await Promise.resolve();return run(task);};
  const result=await sourceRuleValuesAsync(html,'<js>java.getElements("tag.a")</js>text',undefined,execute);
  expect(result).toEqual(sourceRuleValues(html,'<js>java.getElements("tag.a")</js>text'));
  expect(calls).toHaveLength(1);
});

test('template side effects occur once in the original order',async()=>{
  const variables=new Map<string,string>(),calls:string[]=[];
  const execute=async(task:SourceRuleScriptTask)=>{calls.push(task.script);return run(task);};
  const result=await sourceRuleTextAsync('','{{java.get("x")}}:{{java.put("x","值")}}',false,{variables},execute);
  expect(result).toBe('值:值');expect(calls).toHaveLength(2);expect(variables.get('x')).toBe('值');
});

test('cancellation during a script stops the rule before the next stage',async()=>{
  const controller=new AbortController(),runStage=jest.fn(async()=>{controller.abort();return 'value';});
  await expect(sourceRuleTextAsync('','{{java.get("a")}}:{{java.get("b")}}',false,undefined,runStage,controller.signal)).rejects.toMatchObject({name:'AbortError'});
  expect(runStage).toHaveBeenCalledTimes(1);
});
