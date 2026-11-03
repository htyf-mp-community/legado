import type {AnyNode,Element} from 'domhandler';
import type {RuleLookup} from './sourceJavaScript';
import {SourceRuleError} from './errors';
import {isSourceNode} from './sourceDomIdentity';
import {selectSourceElements} from './sourceSelector';
import {sourceHtmlText} from './htmlText';
import {serializeSourceHtml} from './htmlSerialization';

type Elements = {kind:'elements';handles:string[]};
type LookupResult = Elements | {kind:'node';handle:string} | {kind:'values';values:unknown[]} | {kind:'value';value:unknown};

/** Task-local references to nodes already produced by the rule parser. */
export function createSourceWorkerDom(lookup?:RuleLookup) {
  const nodes=new Map<string,AnyNode>(), ids=new WeakMap<object,string>();
  let next=0,work=0,lookupItems=0,lookupChars=0;
  const resolve=(handle:string):AnyNode=>{
    const node=nodes.get(handle);
    if(!node) throw new SourceRuleError('JavaScript 元素引用无效');
    return node;
  };
  const register=(node:AnyNode)=>{
    if(!isSourceNode(node))throw new SourceRuleError('JavaScript 元素引用无效');
    const prior=ids.get(node);
    if(prior) return prior;
    if(nodes.size>=8000) throw new SourceRuleError('JavaScript 元素数量超过限制');
    const handle=String(++next);nodes.set(handle,node);ids.set(node,handle);return handle;
  };
  const chargeLookup=(value:unknown)=>{
    const pending:Array<{value:unknown;depth:number}>=[{value,depth:0}];
    while(pending.length){
      const item=pending.pop()!;
      if(++lookupItems>8000 || item.depth>20)throw new SourceRuleError('JavaScript 规则查询结果超过限制');
      if(typeof item.value==='string'){lookupChars+=item.value.length;if(lookupChars>1_000_000)throw new SourceRuleError('JavaScript 规则查询结果超过限制');}
      else if(item.value && typeof item.value==='object'&&!isSourceNode(item.value))
        for(const child of Object.values(item.value))pending.push({value:child,depth:item.depth+1});
    }
  };
  const packArray=(values:unknown[]):LookupResult=>{
    if(values.length>8000)throw new SourceRuleError('JavaScript 元素数量超过限制');
    values.forEach(chargeLookup);
    if(values.every(isSourceNode))return {kind:'elements',handles:values.map(register)};
    if(values.some(isSourceNode))throw new SourceRuleError('JavaScript 混合元素列表暂不支持');
    return {kind:'values',values};
  };
  const pack=(value:unknown):LookupResult=>{
    if(Array.isArray(value)) return packArray(value);
    chargeLookup(value);
    if(isSourceNode(value)) return {kind:'node',handle:register(value)};
    return {kind:'value',value};
  };
  const resolveAll=(handles:string[])=>{
    if(!Array.isArray(handles)||handles.length>8000)throw new SourceRuleError('JavaScript 元素引用无效');
    return handles.map(handle=>typeof handle==='string'?resolve(handle):(()=>{throw new SourceRuleError('JavaScript 元素引用无效')})());
  };
  const charge=(roots:AnyNode[])=>{
    const stack=[...roots];
    while(stack.length){const node=stack.pop()!;if(++work>3_000_000)throw new SourceRuleError('JavaScript 元素操作超过限制');if('children' in node)stack.push(...node.children);}
  };
  const attr=(handles:string[],name:string)=>{
    for(const node of resolveAll(handles))if(['tag','script','style'].includes(node.type)){
      const attrs=(node as Element).attribs,key=Object.keys(attrs).find(item=>item.toLowerCase()===name.toLowerCase());
      if(key!==undefined)return attrs[key];
    }
    return '';
  };
  const text=(handles:string[])=>{
    const values=resolveAll(handles);charge(values);const result=values.map(node=>sourceHtmlText(node)).filter(Boolean).join(' ');
    if(result.length>1_000_000)throw new SourceRuleError('JavaScript 元素文本超过限制');return result;
  };
  const html=(handles:string[])=>{
    const values=resolveAll(handles);charge(values);const result=values.map(node=>serializeSourceHtml('children' in node?node.children:[],false)).join('\n');
    if(result.length>1_000_000)throw new SourceRuleError('JavaScript 元素 HTML 超过限制');return result;
  };
  const select=(handles:string[],selector:string):Elements=>{
    if(typeof selector!=='string'||selector.length>512)throw new SourceRuleError('JavaScript 元素选择器超过限制');
    const values=resolveAll(handles);charge(values);const selected=values.length?selectSourceElements(selector,values):[];
    if(selected.length>8000)throw new SourceRuleError('JavaScript 元素数量超过限制');
    return {kind:'elements',handles:selected.map(register)};
  };
  return {elements:(rule:string)=>{if(!lookup)throw new SourceRuleError('JavaScript 桥接接口不支持');return packArray(lookup.elements(rule));},element:(rule:string)=>{if(!lookup)throw new SourceRuleError('JavaScript 桥接接口不支持');return pack(lookup.element(rule));},register,resolve,attr,text,html,select};
}
