import type {AnyNode} from 'domhandler';
import {isSourceNode} from './sourceDomIdentity';
import {SourceRuleError} from './errors';

/** Encode a bounded task input while preserving repeated object references. */
export function encodeSourceWorkerInput(value:unknown,registerNode:(node:AnyNode)=>string):unknown {
  const ids=new WeakMap<object,number>(),active=new WeakSet<object>();
  let next=0,count=0,chars=0;
  const encode=(item:unknown,depth:number):unknown=>{
    if(++count>8000||depth>20)throw new SourceRuleError('JavaScript 输入超过限制或嵌套过深');
    if(item===undefined)return {kind:'undefined'};
    if(typeof item==='string'){chars+=item.length;if(chars>1_000_000)throw new SourceRuleError('JavaScript 输入过长');return {kind:'value',value:item};}
    if(typeof item==='number'&&!Number.isFinite(item))return {kind:'number',value:Number.isNaN(item)?'NaN':item>0?'Infinity':'-Infinity'};
    if(typeof item==='number'&&Object.is(item,-0))return {kind:'number',value:'-0'};
    if(item===null||typeof item==='boolean'||typeof item==='number')return {kind:'value',value:item};
    if(typeof item!=='object')throw new SourceRuleError('JavaScript 输入类型不支持');
    if(isSourceNode(item))return {kind:'node',handle:registerNode(item)};
    if(active.has(item))throw new SourceRuleError('JavaScript 输入包含循环引用');
    const prior=ids.get(item);if(prior!==undefined)return {kind:'ref',id:prior};
    const id=++next;ids.set(item,id);active.add(item);
    try {
      if(Array.isArray(item)){
        if(item.length>8000)throw new SourceRuleError('JavaScript 输入项目过多');
        return {kind:'array',id,items:Array.from(item,value=>encode(value,depth+1))};
      }
      const entries=Object.entries(item);
      if(entries.length>8000)throw new SourceRuleError('JavaScript 输入项目过多');
      return {kind:'object',id,entries:entries.map(([key,value])=>{chars+=key.length;if(chars>1_000_000)throw new SourceRuleError('JavaScript 输入过长');return [key,encode(value,depth+1)];})};
    } finally {active.delete(item);}
  };
  return encode(value,0);
}
