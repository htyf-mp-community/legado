import {SourceHttpError, SourceRuleError} from './errors';
import {canEncodeSourceCharset} from './sourceCharsetAvailability';
import {encodeJavaFormValue} from './sourceUrlEncoding';
import type {SourceJavaScriptBridge, SourceJavaScriptResponse} from './sourceJavaScript';
import type {WorkerResponse} from './sourceWorkerSession';
import {resolveNativeResourceUrl} from './nativeSourceUrl';
import {createSourceWorkerDom} from './sourceWorkerDom';
import {encodeSourceWorkerInput} from './sourceWorkerInput';
import {decodeSourceBase64, encodeSourceBase64} from './sourceJavaScriptBase64';
import {sourceJavaScriptMd5} from './sourceJavaScriptMd5';
import {sourceDigestAlgorithm, sourceJavaScriptDigest} from './sourceJavaScriptDigest';
import {createSourceWorkerCrypto} from './sourceWorkerCrypto';

// Experimental search-script adapter. It is deliberately not registered as
// the production interpreter until isolation and the remaining APIs are proven.
const SEARCH_PRELUDE = String.raw`
var baseUrl=__legado.context.baseUrl,key=__legado.context.key,page=__legado.context.page;
var __input=__legado.initialInput,__globals=__input?__input.globals:undefined;
var searchKey=key,searchPage=page,result=__legado.initialResponse===undefined?(__input?__input.result:__legado.context.result):__legado.initialResponse;
if(!__legado.context.largeSource)globalThis.src=__globals?__globals.src:undefined;
var title=__globals?__globals.title:undefined,chapter=__globals?__globals.chapter:undefined,nextChapterUrl=__globals?__globals.nextChapterUrl:undefined;
var source=__legado.context.hasSource===false?undefined:{bookSourceUrl:__legado.context.sourceUrl,key:__legado.context.sourceUrl,getKey:(function(value){return function(){return value}})(__legado.context.sourceUrl)};
function variableArg(value){
  if(value===null || typeof value==='object')return value;
  if(typeof value==='function'||typeof value==='symbol'||typeof value==='bigint')return {};
  return String(value);
}
function bytesArg(value){return typeof value==='string'||Array.isArray(value)?value:value===null?null:{}}
if(source&&__legado.context.hasSourceVariables){
  source.get=function(key){return __legado.call('source.get',[variableArg(key)])};
  source.put=function(key,value){return __legado.call('source.put',[variableArg(key),variableArg(value)])};
  source.getVariable=function(){return __legado.call('source.getVariable',[])};
  source.setVariable=function(value){return __legado.call('source.setVariable',[value==null?null:variableArg(value)])};
  source.putVariable=source.setVariable;
}
var cookie={removeCookie:function(url){return __legado.call('cookie.removeCookie',[String(url)])},getCookie:function(url){return __legado.call('cookie.getCookie',[url])}};
var java={
  log:function(value){__legado.call('java.log',[value!==null&&typeof value==='object'?'[object Object]':String(value)]);return value},
  get:function(key){return __legado.call('java.get',[variableArg(key)])},
  put:function(key,value){return __legado.call('java.put',[variableArg(key),variableArg(value)])},
  ajax:function(url){return __legado.call('java.ajax',[String(url)])},
  connect:function(url){return __legado.call('java.connect',[String(url)])},
  startBrowserAwait:function(url,title,refetch,html){return __legado.call('java.startBrowserAwait',[url,title==null?'':title,refetch!==false,html==null?null:html])},
  toast:function(message){return __legado.call('java.toast',[message,false])},
  longToast:function(message){return __legado.call('java.toast',[message,true])},
  encodeURI:function(value,encoding){return __legado.call('java.encodeURI',encoding===undefined?[value]:[value,encoding])},
  base64Encode:function(value,options){return __legado.call('java.base64Encode',options===undefined?[variableArg(value)]:[variableArg(value),Number(options)|0])},
  base64Decode:function(value,options){return __legado.call('java.base64Decode',typeof options==='string'?[variableArg(value),options]:[variableArg(value)])},
  md5Encode:function(value){return __legado.call('java.md5Encode',[variableArg(value)])},
  md5Encode16:function(value){return __legado.call('java.md5Encode16',[variableArg(value)])},
  digestHex:function(value,algorithm){return __legado.call('java.digestHex',[variableArg(value),variableArg(algorithm)])},
  digestBase64Str:function(value,algorithm){return __legado.call('java.digestBase64Str',[variableArg(value),variableArg(algorithm)])},
  HMacHex:function(value,algorithm,key){return __legado.call('java.HMacHex',key===undefined?[variableArg(value),variableArg(algorithm)]:[variableArg(value),variableArg(algorithm),variableArg(key)])},
  HMacBase64:function(value,algorithm,key){return __legado.call('java.HMacBase64',key===undefined?[variableArg(value),variableArg(algorithm)]:[variableArg(value),variableArg(algorithm),variableArg(key)])},
  randomUUID:function(){return __legado.call('java.randomUUID',[])},
  t2s:function(value){return __legado.call('java.t2s',[variableArg(value)])},
  s2t:function(value){return __legado.call('java.s2t',[variableArg(value)])},
  toNumChapter:function(value){return __legado.call('java.toNumChapter',[variableArg(value)])},
  hexDecodeToString:function(value){return __legado.call('java.hexDecodeToString',[variableArg(value)])},
  hexEncodeToString:function(value){return __legado.call('java.hexEncodeToString',[variableArg(value)])},
  strToBytes:function(value,charset){return __legado.call('java.strToBytes',charset===undefined?[variableArg(value)]:[variableArg(value),variableArg(charset)])},
  bytesToStr:function(value,charset){return __legado.call('java.bytesToStr',charset===undefined?[bytesArg(value)]:[bytesArg(value),variableArg(charset)])},
  base64DecodeToByteArray:function(value,flags){return __legado.call('java.base64DecodeToByteArray',flags===undefined?[value==null?null:variableArg(value)]:[value==null?null:variableArg(value),Number(flags)|0])},
  createSymmetricCrypto:function(transformation,key,iv){
    var handle=__legado.call('java.crypto.create',[variableArg(transformation),bytesArg(key),iv==null?null:bytesArg(iv)]);
    return {
      encrypt:function(value){return __legado.call('java.crypto.run',[handle,'encrypt',bytesArg(value)])},
      decrypt:function(value){return __legado.call('java.crypto.run',[handle,'decrypt',bytesArg(value)])},
      encryptBase64:function(value){return __legado.call('java.crypto.run',[handle,'encryptBase64',bytesArg(value)])},
      encryptHex:function(value){return __legado.call('java.crypto.run',[handle,'encryptHex',bytesArg(value)])},
      decryptStr:function(value){return __legado.call('java.crypto.run',[handle,'decryptStr',bytesArg(value)])}
    };
  },
  aesBase64DecodeToString:function(value,key,transformation,iv){return __legado.call('java.aesBase64DecodeToString',[bytesArg(value),bytesArg(key),variableArg(transformation),iv==null?null:bytesArg(iv)])},
  post:function(url,body,headers,timeout){
    var args=[url,body,headers==null?{}:headers];if(timeout!=null)args.push(timeout);
    return __legado.call('java.post',args);
  }
};
if(__legado.context.ruleMode){delete java.ajax;delete java.post;delete java.connect;delete java.startBrowserAwait;delete java.toast;delete java.longToast;cookie=undefined;}
if(__legado.context.hasLookup){
  function lookupArgs(rule,content,isUrl){
    var args=[rule==null?null:variableArg(rule)];
    if(content!==undefined||isUrl!==undefined)args.push(content===undefined?null:content);
    if(isUrl!==undefined)args.push(isUrl);
    return args;
  }
  function stringList(values){
    if(values===null)return null;
    Object.defineProperties(values,{
      size:{value:function(){return this.length}},isEmpty:{value:function(){return this.length===0}},
      get:{value:function(index){index=Number(index);if(!Number.isInteger(index)||index<0||index>=this.length)throw new RangeError('列表索引越界');return this[index]}},
      toArray:{value:function(){return Array.prototype.slice.call(this)}}
    });
    return values;
  }
  java.getString=function(rule,content,isUrl){return __legado.call('java.getString',lookupArgs(rule,content,isUrl))};
  java.getStringList=function(rule,content,isUrl){return stringList(__legado.call('java.getStringList',lookupArgs(rule,content,isUrl)))};
  java.getElements=function(rule){return __legado.call('java.getElements',[rule==null?null:variableArg(rule)])};
  java.getElement=function(rule){return __legado.call('java.getElement',[rule==null?null:variableArg(rule)])};
  java.setContent=function(content,baseUrl){__legado.call('java.setContent',[content==null?null:content,baseUrl==null?null:variableArg(baseUrl)]);return java};
}
`;

export function prepareSourceWorkerScript(script: string): string {
  return SEARCH_PRELUDE + '\n' + script;
}

function argumentText(value: unknown): string {
  if (value !== null && typeof value === 'object')
    throw new SourceRuleError('JavaScript 编码参数必须是基本类型');
  const result = String(value);
  if (result.length > 64_000) throw new SourceRuleError('JavaScript 编码超过限制');
  return result;
}
function checkAbort(signal: AbortSignal) {
  if (signal.aborted) {const error = new Error('Operation cancelled'); error.name = 'AbortError'; throw error;}
}

/** Invoke only through the per-task whitelist and the existing source bridge. */
export async function invokeSourceWorkerBridge(bridge: SourceJavaScriptBridge, action: string, args: unknown[], signal: AbortSignal, register?: (response:SourceJavaScriptResponse)=>WorkerResponse, dom?:ReturnType<typeof createSourceWorkerDom>): Promise<unknown> {
  checkAbort(signal);
  // Scripts can access __legado.call directly, so the host must enforce the
  // same capabilities as the JavaScript facade instead of trusting it.
  if (bridge.ruleMode && ['java.ajax','java.post','java.connect','java.startBrowserAwait','java.toast','cookie.getCookie','cookie.removeCookie'].includes(action))
    throw new SourceRuleError('JavaScript 桥接接口不支持');
  if (action.startsWith('source.') && !(bridge.ruleMode ? bridge.sourceUrl : bridge.sourceUrl ?? bridge.baseUrl))
    throw new SourceRuleError('JavaScript 桥接接口不支持');
  switch (action) {
    case 'java.getStringNode':
    case 'java.getStringListNode': {
      if(!dom || typeof args[1]!=='string') throw new SourceRuleError('JavaScript 元素引用无效');
      const next=[...args];next[1]=dom.resolve(args[1]);
      return invokeSourceWorkerBridge(bridge,action==='java.getStringNode'?'java.getString':'java.getStringList',next,signal,register,dom);
    }
    case 'java.setContentNode': {
      if(!dom || typeof args[0]!=='string') throw new SourceRuleError('JavaScript 元素引用无效');
      const next=[...args];next[0]=dom.resolve(args[0]);
      return invokeSourceWorkerBridge(bridge,'java.setContent',next,signal,register,dom);
    }
    case 'java.getElements':
      if(!dom) throw new SourceRuleError('JavaScript 桥接接口不支持');
      return dom.elements(args[0]==null?'':argumentText(args[0]));
    case 'java.getElement':
      if(!dom) throw new SourceRuleError('JavaScript 桥接接口不支持');
      return args[0]==null ? {kind:'value',value:null} : dom.element(argumentText(args[0]));
    case 'dom.attr':
    case 'dom.text':
    case 'dom.html':
    case 'dom.select': {
      if(!dom || !Array.isArray(args[0]) || args[0].some(value=>typeof value!=='string')) throw new SourceRuleError('JavaScript 元素引用无效');
      const handles=args[0] as string[];
      if(action==='dom.attr') return dom.attr(handles,argumentText(args[1]));
      if(action==='dom.text') return dom.text(handles);
      if(action==='dom.html') return dom.html(handles);
      return dom.select(handles,argumentText(args[1]));
    }
    case 'java.getString':
    case 'java.getStringList': {
      const lookup=bridge.lookup;
      if(!lookup) throw new SourceRuleError('JavaScript 桥接接口不支持');
      const isString=action==='java.getString';
      const unescape=isString && typeof args[1]==='boolean' && args[2]===undefined ? args[1] : true;
      const content=isString && typeof args[1]==='boolean' && args[2]===undefined ? undefined : args[1];
      if(typeof content==='boolean') throw new SourceRuleError('JavaScript 查询解码选项暂不支持');
      if(args[2]!==undefined && typeof args[2]!=='boolean') throw new SourceRuleError('JavaScript URL 查询参数无效');
      if(args[0]==null) return isString?'':null;
      const rule=argumentText(args[0]),isUrl=args[2]===true;
      const result=isString ? lookup.text(rule,isUrl,content==null?undefined:content,unescape) : lookup.list(rule,isUrl,content==null?undefined:content);
      if(typeof result==='string' && result.length>1_000_000) throw new SourceRuleError('JavaScript 规则查询结果超过限制');
      if(Array.isArray(result) && (result.length>8000 || result.reduce((sum,item)=>sum+item.length+1,0)>1_000_000)) throw new SourceRuleError('JavaScript 列表查询结果超过限制');
      return result;
    }
    case 'java.setContent': {
      if(!bridge.lookup) throw new SourceRuleError('JavaScript 桥接接口不支持');
      if(args[0]==null) throw new SourceRuleError('JavaScript 解析内容不能为空');
      const content=args[0],baseUrl=args[1]==null?undefined:argumentText(args[1]);
      bridge.lookup.setContent(()=>content,baseUrl);
      return undefined;
    }
    case 'java.get': {
      const name=argumentText(args[0]);
      if(name==='bookName' && bridge.bookName!==undefined) return bridge.bookName;
      if(name==='title' && bridge.chapterTitle!=null) return bridge.chapterTitle;
      const value=bridge.variables?.get(name) || bridge.fallbackVariables?.get(name);
      if(value)return value;
      const fallback=bridge.ruleMode ? bridge.sourceVariables?.get(name) ?? '' : '';
      if(fallback.length>1_000_000)throw new SourceRuleError('JavaScript 书源变量超过限制');
      return fallback;
    }
    case 'java.put': {
      const name=argumentText(args[0]), value=argumentText(args[1]);
      const variables=bridge.variables;
      if(!variables) throw new SourceRuleError('JavaScript 变量容器不可用');
      if(!variables.has(name) && variables.size>=1024) throw new SourceRuleError('JavaScript 变量数量超过限制');
      let total=name.length+value.length;
      for(const [key,previous] of variables) if(key!==name) total+=key.length+previous.length;
      if(total>1_000_000) throw new SourceRuleError('JavaScript 变量大小超过限制');
      variables.set(name,value);
      return value;
    }
    case 'source.get':
    case 'source.put':
    case 'source.getVariable':
    case 'source.setVariable': {
      const variables=bridge.sourceVariables;
      if(!variables) throw new SourceRuleError('JavaScript 桥接接口不支持');
      try {
        if(action==='source.get') {
          const result=variables.get(argumentText(args[0]));
          if(result.length>1_000_000) throw new SourceRuleError('JavaScript 书源变量超过限制');
          return result;
        }
        if(action==='source.put') return variables.put(argumentText(args[0]),argumentText(args[1]));
        if(action==='source.getVariable') {
          const result=variables.getVariable();
          if(result.length>1_000_000) throw new SourceRuleError('JavaScript 书源变量超过限制');
          return result;
        }
        variables.setVariable(args[0]==null?null:argumentText(args[0]));
        return undefined;
      } catch(error) {
        if(error instanceof SourceRuleError) throw error;
        throw new SourceRuleError(error instanceof Error?error.message:String(error));
      }
    }
    case 'cookie.removeCookie':
      bridge.removeCookie(String(args[0]));
      return undefined;
    case 'cookie.getCookie':
      if (!bridge.getCookie) throw new SourceRuleError('JavaScript 桥接接口不支持');
      return bridge.getCookie(argumentText(args[0]));
    case 'java.toast':
      if (!bridge.toast) throw new SourceRuleError('JavaScript 桥接接口不支持');
      bridge.toast(argumentText(args[0]), args[1] === true);
      return undefined;
    case 'java.log':
      console.log('[书源]',argumentText(args[0]));
      return undefined;
    case 'java.encodeURI': {
      const text = argumentText(args[0]), charset = args.length < 2 ? 'UTF-8' : argumentText(args[1]);
      if (!canEncodeSourceCharset(charset)) return '';
      const result = encodeJavaFormValue(text, charset);
      if (result.length > 1_000_000) throw new SourceRuleError('JavaScript 编码超过限制');
      return result;
    }
    case 'java.base64Encode':
      return encodeSourceBase64(argumentText(args[0]),args[1]);
    case 'java.base64Decode':
      return decodeSourceBase64(argumentText(args[0]),typeof args[1]==='string'?argumentText(args[1]):undefined);
    case 'java.md5Encode':
      return sourceJavaScriptMd5(argumentText(args[0]));
    case 'java.md5Encode16':
      return sourceJavaScriptMd5(argumentText(args[0])).slice(8,24);
    case 'java.digestHex':
    case 'java.digestBase64Str':
    case 'java.HMacHex':
    case 'java.HMacBase64': {
      const hmac=(action==='java.HMacHex'||action==='java.HMacBase64') && args.length>=3;
      const algorithm=sourceDigestAlgorithm(argumentText(args[1]),hmac);
      if(!algorithm) throw new TypeError('JavaScript 摘要算法不支持');
      const value=argumentText(args[0]),key=hmac?argumentText(args[2]):undefined;
      try {return sourceJavaScriptDigest(value,algorithm,action==='java.digestHex'||action==='java.HMacHex'?'hex':'base64',key);}
      catch(error){if(error instanceof SourceRuleError)throw error;throw new TypeError(error instanceof Error?error.message:'JavaScript 摘要失败');}
    }
    case 'java.ajax': {
      try {
        const value = await bridge.ajax(String(args[0]));
        checkAbort(signal);
        if (value.length > 1_000_000) throw new SourceRuleError('JavaScript 响应超过限制');
        return value;
      } catch (error) {
        checkAbort(signal);
        if ((error instanceof SourceRuleError && !(error instanceof SourceHttpError)) || (error instanceof Error && error.name === 'AbortError')) throw error;
        return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      }
    }
    case 'java.post': {
      if (!bridge.post) throw new SourceRuleError('JavaScript 桥接接口不支持');
      const address = argumentText(args[0]), body = argumentText(args[1]);
      let headers = args[2] ?? {};
      if (typeof headers === 'string') {try {headers=JSON.parse(headers);} catch {throw new SourceRuleError('JavaScript 请求头 JSON 无效');}}
      if (!headers || typeof headers !== 'object' || Array.isArray(headers)) throw new SourceRuleError('JavaScript 请求头无效');
      const entries = Object.entries(headers);
      if (entries.length > 128) throw new SourceRuleError('JavaScript 请求头超过限制');
      const converted: Record<string,string> = Object.create(null);
      for (const [name,value] of entries) {
        if (value == null || typeof value === 'object') throw new SourceRuleError('JavaScript 请求头无效');
        converted[argumentText(name)] = argumentText(value);
      }
      const timeout = args[3] == null ? undefined : Number(args[3]);
      if (timeout !== undefined && (!Number.isInteger(timeout) || timeout < 1 || timeout > 30_000)) throw new SourceRuleError('JavaScript 请求超时无效');
      const response = await bridge.post(address, body, converted, timeout);
      checkAbort(signal);
      if (response.body.length > 1_000_000) throw new SourceRuleError('JavaScript 响应超过限制');
      if (register) return register(response);
      bridge.onResponse?.(response);
      return {body:response.body,url:response.url,code:response.code,headers:response.headers};
    }
    case 'java.connect': {
      if (!bridge.connect || !register) throw new SourceRuleError('JavaScript 桥接接口不支持');
      const address=String(args[0]);
      let response:SourceJavaScriptResponse;
      try {response=await bridge.connect(address);}
      catch (error) {
        checkAbort(signal);
        if ((error instanceof SourceRuleError && !(error instanceof SourceHttpError)) || (error instanceof Error && error.name === 'AbortError')) throw error;
        const body=error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        response={data:body,body,url:resolveNativeResourceUrl(address,bridge.baseUrl),code:200};
      }
      checkAbort(signal);
      return register(response);
    }
    case 'java.startBrowserAwait': {
      if (!bridge.browser || !register) throw new SourceRuleError('JavaScript 桥接接口不支持');
      const response=await bridge.browser(argumentText(args[0]),args[1]==null?'':argumentText(args[1]),args[2]!==false,args[3]==null?undefined:argumentText(args[3]));
      checkAbort(signal);
      return register(response);
    }
    default: throw new SourceRuleError('JavaScript 桥接接口不支持');
  }
}

/** A registry belongs to one script task and must not be reused for another. */
export function createSourceWorkerBridge(bridge: SourceJavaScriptBridge) {
  const localBridge=bridge.variables ? bridge : {...bridge,variables:new Map<string,string>()};
  const dom=createSourceWorkerDom(bridge.lookup);
  const crypto=createSourceWorkerCrypto();
  const responses=new Map<string,SourceJavaScriptResponse>();
  let next=0, requests=0, variableWork=0, lookups=0, lookupItems=0, lookupChars=0, listWork=0, logs=0, uuidCount=0;
  const chargeLookup=(value:unknown)=>{
    const pending:Array<{value:unknown;depth:number}>=[{value,depth:0}];
    while(pending.length){
      const item=pending.pop()!;
      if(++lookupItems>8000 || item.depth>20) throw new SourceRuleError('JavaScript 规则查询结果超过限制');
      if(typeof item.value==='string') {lookupChars+=item.value.length;if(lookupChars>1_000_000) throw new SourceRuleError('JavaScript 规则查询结果超过限制');}
      else if(item.value && typeof item.value==='object') for(const child of Object.values(item.value))pending.push({value:child,depth:item.depth+1});
    }
  };
  const register=(response:SourceJavaScriptResponse):WorkerResponse=>{
    if (response.body.length>1_000_000 || responses.size>=256) throw new SourceRuleError('JavaScript 响应超过限制');
    const handle=String(++next);
    responses.set(handle,response);
    bridge.onResponse?.(response);
    return {handle,body:response.body,url:response.url,code:response.code,headers:response.headers};
  };
  const initialResponse=bridge.response ? register(bridge.response) : undefined;
  return {
    initialResponse,
    resolveResponse:(handle:string)=>responses.get(handle),
    resolveNode:(handle:string)=>dom.resolve(handle),
    encodeInput:(value:unknown)=>encodeSourceWorkerInput(value,dom.register),
    invoke:(action:string,args:unknown[],signal:AbortSignal)=>{
      if(action==='java.randomUUID') return Promise.resolve().then(()=>{
        checkAbort(signal);
        if(++uuidCount>1024)throw new SourceRuleError('JavaScript UUID 生成次数超过限制');
        return require('react-native-quick-crypto').randomUUID();
      });
      if(['java.crypto.create','java.crypto.run','java.aesBase64DecodeToString','java.strToBytes','java.bytesToStr','java.base64DecodeToByteArray','java.t2s','java.s2t','java.toNumChapter','java.hexDecodeToString','java.hexEncodeToString'].includes(action))
        return Promise.resolve().then(()=>{checkAbort(signal);return crypto(action,args);});
      if(action==='java.log' && logs++>=32) return Promise.resolve(undefined);
      if (['java.ajax','java.post','java.connect'].includes(action) && ++requests>8) throw new SourceRuleError('JavaScript 请求次数超过限制');
      if (action==='java.getString'||action==='java.getStringList'||action==='java.getStringNode'||action==='java.getStringListNode'||action==='java.getElements'||action==='java.getElement') {
        if(++lookups>16) throw new SourceRuleError('JavaScript 规则查询次数超过限制');
        if(args[1]!=null && typeof args[1]!=='boolean') chargeLookup(args[1]);
      }
      if((action==='java.setContent'||action==='java.setContentNode') && args[0]!=null) chargeLookup(args[0]);
      if (['java.get','java.put','source.get','source.put','source.setVariable','java.base64Encode','java.base64Decode','java.md5Encode','java.md5Encode16','java.digestHex','java.digestBase64Str','java.HMacHex','java.HMacBase64'].includes(action)) {
        for(const value of args) if(value!==null) variableWork+=argumentText(value).length+1;
        if(variableWork>1_000_000) throw new SourceRuleError('JavaScript 编码超过限制');
      }
      return invokeSourceWorkerBridge(localBridge,action,args,signal,register,dom).then(result=>{
        if((action==='java.getStringList'||action==='java.getStringListNode') && Array.isArray(result)){
          listWork+=result.reduce((sum,item)=>sum+item.length+1,0);
          if(listWork>1_000_000) throw new SourceRuleError('JavaScript 列表查询结果超过限制');
        }
        return result;
      });
    },
  };
}
