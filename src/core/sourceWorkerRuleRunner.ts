import {SourceRuleError} from './errors';
import type {SourceRuleScriptRunner} from './sourceRule';
import type {SourceWorkerExecutor} from './sourceWorkerExecutor';

/** Experimental adapter for asynchronous rule steps; not registered by default. */
export function createSourceWorkerRuleRunner(executor:Pick<SourceWorkerExecutor,'run'>):SourceRuleScriptRunner {
  return (task,signal)=>executor.run(task.script,{
    baseUrl:typeof task.globals?.baseUrl==='string'?task.globals.baseUrl:'',
    sourceUrl:task.variableContext?.sourceUrl,
    key:null,page:null,
    ajax:async()=>{throw new SourceRuleError('JavaScript 桥接接口不支持');},
    removeCookie:()=>{throw new SourceRuleError('JavaScript 桥接接口不支持');},
    variables:task.variables,
    fallbackVariables:task.variableContext?.fallback,
    bookName:task.variableContext?.bookName,
    chapterTitle:task.variableContext?.title ?? undefined,
    sourceVariables:task.variableContext?.sourceVariables,
    lookup:task.lookup,
    ruleGlobals:task.globals,
    ruleMode:true,
  },task.input,signal);
}
