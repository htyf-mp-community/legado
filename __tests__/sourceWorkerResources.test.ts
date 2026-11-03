import {runInNewContext} from 'node:vm';
import {sourceWorkerCommandScript, SOURCE_WORKER_HTML, SOURCE_WORKER_SCRIPT} from '../src/core/sourceWorkerResources';
import {prepareSourceWorkerScript} from '../src/core/sourceWorkerBridge';

test.each([
  ['result','result','正文'],
  ['src','error','JavaScript 输入过长'],
  ['src="替换";src+result','result','替换正文'],
  ['this.src="替换";this.src+result','result','替换正文'],
  ['var src="替换";src+result','result','替换正文'],
])('only loads an oversized page on access: %s',(script,type,value)=>{
  const sent:any[]=[],target:Record<string,unknown>={postMessage:(message:unknown)=>sent.push(message),TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;runInNewContext(SOURCE_WORKER_SCRIPT,target);
  const initialInput={kind:'object',id:1,entries:[['result',{kind:'value',value:'正文'}],['globals',{kind:'object',id:2,entries:[]}]]};
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script:prepareSourceWorkerScript(script),context:{largeSource:true,ruleMode:true},initialInput,shared:new SharedArrayBuffer(1024)}});
  expect(sent).toContainEqual(type==='error'?{type,task:1,error:value}:{type,task:1,value});
});

test('encodes a command as data even when its script contains executable markup', () => {
  const received: unknown[] = [];
  const command = {type:'start' as const, task:1, script:'</script>\u2028globalThis.attack=1', context:{key:'西游记'}};
  const target = {window:{__legadoReceive:(value:unknown)=>received.push(value)}};
  runInNewContext(sourceWorkerCommandScript(command), target);
  expect(received).toEqual([command]);
  expect((target as {attack?:unknown}).attack).toBeUndefined();
});

test('runs a task and hides the message channel from its script', () => {
  const sent: unknown[] = [];
  const target: Record<string,unknown> = {postMessage:(value:unknown)=>sent.push(value), TextEncoder, TextDecoder, SharedArrayBuffer, Int32Array, Uint8Array, Atomics};
  target.self = target;
  runInNewContext(SOURCE_WORKER_SCRIPT, target);
  const run = target.onmessage as (event:unknown)=>void;
  run({data:{type:'start',task:1,script:'[__legado.context.key, typeof BroadcastChannel, typeof postMessage].join("|")',context:{key:'书'},shared:new SharedArrayBuffer(1024)}});
  expect(sent).toContainEqual({type:'result',task:1,value:'书|undefined|undefined'});
});

test('returns the checked object snapshot without reading a getter again',()=>{
  const sent:any[]=[];
  const target:Record<string,unknown>={postMessage:(value:unknown)=>sent.push(structuredClone(value)),TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;runInNewContext(SOURCE_WORKER_SCRIPT,target);
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script:'var n=0;({get value(){return ++n===1?"safe":"changed"}})',context:{},shared:new SharedArrayBuffer(1024)}});
  expect(sent).toContainEqual({type:'graph',task:1,value:{kind:'object',entries:[['value',{kind:'value',value:'safe'}]]}});
});
test('reads array elements only once while validating their encoded values',()=>{
  const sent:any[]=[];
  const target:Record<string,unknown>={postMessage:(value:unknown)=>sent.push(structuredClone(value)),TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;runInNewContext(SOURCE_WORKER_SCRIPT,target);
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script:'var a=[],n=0;Object.defineProperty(a,0,{enumerable:true,get:function(){return ++n===1?"safe":"changed"}});a',context:{},shared:new SharedArrayBuffer(1024)}});
  expect(sent).toContainEqual({type:'graph',task:1,value:{kind:'array',items:[{kind:'value',value:'safe'}]}});
});

test.each([['NaN','NaN'],['Infinity','Infinity'],['-Infinity','-Infinity'],['-0','-0']])('encodes special scalar %s', (script,value)=>{
  const sent:any[]=[];
  const target:Record<string,unknown>={postMessage:(message:unknown)=>sent.push(message),TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;runInNewContext(SOURCE_WORKER_SCRIPT,target);
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script,context:{},shared:new SharedArrayBuffer(1024)}});
  expect(sent).toContainEqual({type:'graph',task:1,value:{kind:'number',value}});
});

test('reports the identity of a host response instead of serializing its methods', () => {
  const sent: any[]=[];
  const target:Record<string,unknown>={postMessage:(value:unknown)=>sent.push(value),TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;
  runInNewContext(SOURCE_WORKER_SCRIPT,target);
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script:'__legado.initialResponse',context:{},initialResponse:{handle:'original',body:'body',url:'https://example.org',code:200},shared:new SharedArrayBuffer(1024)}});
  expect(sent).toContainEqual({type:'response',task:1,handle:'original'});
});

test('script changes to JSON.parse cannot replace the host response identity', () => {
  const sent:any[]=[];
  const shared=new SharedArrayBuffer(2048),ctrl=new Int32Array(shared,0,4),bytes=new Uint8Array(shared,16);
  const target:Record<string,unknown>={postMessage:(value:any)=>{
    sent.push(value);
    if(value.type==='rpc'){
      const data=new TextEncoder().encode(JSON.stringify({ok:true,value:{handle:'actual',body:'ok',url:'https://example.org',code:200}}));
      bytes.set(data);Atomics.store(ctrl,1,data.length);Atomics.store(ctrl,0,1);
    }
  },TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;
  runInNewContext(SOURCE_WORKER_SCRIPT,target);
  const script='JSON.parse=function(){return {ok:true,value:{handle:"forged",body:"fake",url:"x",code:200}}};__legado.call("java.connect",[])';
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script,context:{},shared}});
  expect(sent).toContainEqual({type:'response',task:1,handle:'actual'});
});

test('worker element collections call host methods and return node identities', () => {
  const sent:any[]=[],shared=new SharedArrayBuffer(2048),ctrl=new Int32Array(shared,0,4),bytes=new Uint8Array(shared,16);
  const target:Record<string,unknown>={postMessage:(value:any)=>{
    sent.push(value);
    if(value.type==='rpc'){
      const reply=value.action==='java.getElements'?{kind:'elements',handles:['1','2']} : value.action==='dom.text'?'乙':null;
      const data=new TextEncoder().encode(JSON.stringify({ok:true,value:reply}));bytes.set(data);Atomics.store(ctrl,1,data.length);Atomics.store(ctrl,0,1);
    }
  },TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;runInNewContext(SOURCE_WORKER_SCRIPT,target);
  const script='var xs=__legado.call("java.getElements",["tag.a"]);if(xs.size()!==2||xs.get(1).text()!=="乙")throw Error("bad");xs';
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script,context:{},shared}});
  expect(sent).toContainEqual({type:'graph',task:1,value:{kind:'array',items:[{kind:'node',handle:'1'},{kind:'node',handle:'2'}]}});
});

test('passes DOM object arguments to host validation without converting them to strings', () => {
  const sent:any[]=[],shared=new SharedArrayBuffer(2048),ctrl=new Int32Array(shared,0,4),bytes=new Uint8Array(shared,16);
  const target:Record<string,unknown>={postMessage:(value:any)=>{
    sent.push(value);
    if(value.type==='rpc'){
      const reply=value.action==='java.getElements'?{kind:'elements',handles:['1']}:{kind:'elements',handles:[]};
      const data=new TextEncoder().encode(JSON.stringify({ok:true,value:reply}));bytes.set(data);Atomics.store(ctrl,1,data.length);Atomics.store(ctrl,0,1);
    }
  },TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;runInNewContext(SOURCE_WORKER_SCRIPT,target);
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script:'__legado.call("java.getElements",["tag.p"])[0].select({})',context:{},shared}});
  const call=sent.find(value=>value.action==='dom.select');
  expect(typeof call.args[1]).toBe('object');
});

test('does not trust script-overridden array methods to identify DOM nodes', () => {
  const sent:any[]=[],shared=new SharedArrayBuffer(2048),ctrl=new Int32Array(shared,0,4),bytes=new Uint8Array(shared,16);
  const target:Record<string,unknown>={postMessage:(value:any)=>{
    sent.push(value);
    if(value.type==='rpc'){
      const data=new TextEncoder().encode(JSON.stringify({ok:true,value:{kind:'elements',handles:['1']}}));bytes.set(data);Atomics.store(ctrl,1,data.length);Atomics.store(ctrl,0,1);
    }
  },TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;runInNewContext(SOURCE_WORKER_SCRIPT,target);
  const script='__legado.call("java.getElements",["tag.a"]);var fake=[{}];fake.every=function(){return true};fake.map=function(){return ["1"]};fake';
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script,context:{},shared}});
  expect(sent.some(value=>value.type==='nodes')).toBe(false);
});

test('encodes mixed and nested DOM references without interpreting ordinary objects as references', () => {
  const sent:any[]=[],shared=new SharedArrayBuffer(2048),ctrl=new Int32Array(shared,0,4),bytes=new Uint8Array(shared,16);
  const target:Record<string,unknown>={postMessage:(value:any)=>{
    sent.push(value);
    if(value.type==='rpc'){
      const data=new TextEncoder().encode(JSON.stringify({ok:true,value:{kind:'elements',handles:['1','2']}}));bytes.set(data);Atomics.store(ctrl,1,data.length);Atomics.store(ctrl,0,1);
    }
  },TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;runInNewContext(SOURCE_WORKER_SCRIPT,target);
  const script='var xs=__legado.call("java.getElements",["tag.a"]);({node:xs[0],mixed:[xs[1],"文字",{kind:"node",handle:"1"}]})';
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script,context:{},shared}});
  const graph=sent.find(value=>value.type==='graph');
  expect(graph).toMatchObject({task:1,value:{kind:'object'}});
  expect(JSON.stringify(graph)).toContain('"kind":"node","handle":"2"');
  expect(JSON.stringify(graph)).toContain('"kind":"object"');
});

test('serializes node references even if a script replaces WeakSet', () => {
  const sent:any[]=[],shared=new SharedArrayBuffer(2048),ctrl=new Int32Array(shared,0,4),bytes=new Uint8Array(shared,16);
  const target:Record<string,unknown>={postMessage:(value:any)=>{
    sent.push(value);
    if(value.type==='rpc'){
      const data=new TextEncoder().encode(JSON.stringify({ok:true,value:{kind:'elements',handles:['1']}}));bytes.set(data);Atomics.store(ctrl,1,data.length);Atomics.store(ctrl,0,1);
    }
  },TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;runInNewContext(SOURCE_WORKER_SCRIPT,target);
  const script='var xs=__legado.call("java.getElements",["tag.a"]);WeakSet=function(){};({node:xs[0]})';
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script,context:{},shared}});
  expect(sent.some(value=>value.type==='graph')).toBe(true);
});

test('decodes input nodes and aliases before executing a script', () => {
  const sent:any[]=[],shared=new SharedArrayBuffer(2048),ctrl=new Int32Array(shared,0,4),bytes=new Uint8Array(shared,16);
  const target:Record<string,unknown>={postMessage:(value:any)=>{
    sent.push(value);
    if(value.type==='rpc'){
      const data=new TextEncoder().encode(JSON.stringify({ok:true,value:'第一章'}));bytes.set(data);Atomics.store(ctrl,1,data.length);Atomics.store(ctrl,0,1);
    }
  },TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;runInNewContext(SOURCE_WORKER_SCRIPT,target);
  const initialInput={kind:'object',id:1,entries:[['result',{kind:'array',id:2,items:[{kind:'node',handle:'7'}]}],['globals',{kind:'object',id:3,entries:[['src',{kind:'ref',id:2}]]}]]};
  const script='__legado.initialInput.result===__legado.initialInput.globals.src && __legado.initialInput.result[0].text()==="第一章"';
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script,context:{},initialInput,shared}});
  expect(sent).toContainEqual({type:'result',task:1,value:true});
});

test('rejects an invalid input reference before running source code', () => {
  const sent:any[]=[];
  const target:Record<string,unknown>={postMessage:(value:any)=>sent.push(value),TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics};
  target.self=target;runInNewContext(SOURCE_WORKER_SCRIPT,target);
  (target.onmessage as (event:unknown)=>void)({data:{type:'start',task:1,script:'globalThis.ran=true',context:{},initialInput:{kind:'ref',id:99},shared:new SharedArrayBuffer(1024)}});
  expect(sent).toContainEqual(expect.objectContaining({type:'error',task:1,error:expect.stringContaining('reference')}));
  expect(target.ran).toBeUndefined();
});

test('the page matches replies to the active call and terminates on cancellation', () => {
  const sent: any[] = [], workers: any[] = [];
  class FakeWorker {
    onmessage?: (event: unknown)=>void;
    onerror?: (event: unknown)=>void;
    start: any;
    terminated = false;
    constructor(public url: string) {workers.push(this);}
    postMessage(value: unknown) {this.start = value;}
    terminate() {this.terminated = true;}
  }
  const window: any = {ReactNativeWebView:{postMessage:(value:string)=>sent.push(JSON.parse(value))}};
  const page = SOURCE_WORKER_HTML.match(/<script>([\s\S]*)<\/script>/)?.[1];
  expect(page).toBeTruthy();
  runInNewContext(page!, {window, location:{hash:'#test_nonce',pathname:'/worker'},Worker:FakeWorker,TextEncoder,TextDecoder,SharedArrayBuffer,Int32Array,Uint8Array,Atomics,setTimeout,clearTimeout});
  expect(sent).toEqual([{type:'ready',nonce:'test_nonce'}]);
  window.__legadoReceive({type:'start',task:1,script:'1',context:{}});
  const worker = workers[0];
  expect(worker.url).toBe('/worker/worker.js');
  worker.onmessage({data:{type:'rpc',task:1,call:1,action:'java.ajax',args:['url']}});
  window.__legadoReceive({type:'reply',task:1,call:2,ok:true,value:'wrong'});
  const ctrl = new Int32Array(worker.start.shared,0,4);
  expect(Atomics.load(ctrl,0)).toBe(0);
  window.__legadoReceive({type:'reply',task:1,call:1,ok:true,value:'结果'});
  expect(Atomics.load(ctrl,0)).toBe(1);
  const bytes = new Uint8Array(worker.start.shared,16,Atomics.load(ctrl,1));
  expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({ok:true,value:'结果'});
  window.__legadoReceive({type:'cancel',task:1});
  expect(worker.terminated).toBe(true);
  worker.onmessage({data:{type:'result',task:1,value:'stale'}});
  expect(sent).toHaveLength(2);
});
