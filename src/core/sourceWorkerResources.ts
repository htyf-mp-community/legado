import type {WorkerCommand} from './sourceWorkerSession';

/** Serialize data, never interpolate source code as executable JavaScript. */
export function sourceWorkerCommandScript(command: WorkerCommand): string {
  const json = JSON.stringify(command);
  if (!json || json.length > 1_000_000) throw new Error('JavaScript 消息过长');
  return `window.__legadoReceive(${json.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')});true;`;
}

// This is a transport prototype, not a security boundary for untrusted rules.
// The host must serve it with the restrictive headers in localServerRuntime.
export const SOURCE_WORKER_SCRIPT = String.raw`
(function () {
  var send = self.postMessage.bind(self);
  function conceal(name) {
    var current = self;
    while (current) {
      var descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (!descriptor.configurable) {
          if (current[name] !== undefined) throw new Error('Cannot disable ' + name);
        } else Object.defineProperty(current, name, {value: undefined, configurable: false, writable: false});
      }
      current = Object.getPrototypeOf(current);
    }
    if (self[name] !== undefined) throw new Error('Cannot disable ' + name);
  }
  try {
    ['BroadcastChannel','indexedDB','caches','SharedWorker','Worker','fetch','XMLHttpRequest','WebSocket','WebTransport','EventSource','importScripts','postMessage'].forEach(conceal);
  } catch (error) {
    send({type:'bootstrap-error', error:String(error && error.message || error)});
    return;
  }
  var used = false;
  self.onmessage = function (event) {
    var message = event.data;
    if (used || !message || message.type !== 'start') return;
    used = true;
    var task = message.task, call = 0;
    try {
      var ctrl = new Int32Array(message.shared, 0, 4);
      var bytes = new Uint8Array(message.shared, 16);
      var atomicStore=Atomics.store.bind(Atomics),atomicLoad=Atomics.load.bind(Atomics),atomicWait=Atomics.wait.bind(Atomics);
      var decoder=new TextDecoder(), decode=decoder.decode.bind(decoder), parse=JSON.parse.bind(JSON);
      var sliceBytes=Function.prototype.call.bind(Uint8Array.prototype.subarray);
      var sliceArray=Function.prototype.call.bind(Array.prototype.slice);
      var isArray=Array.isArray.bind(Array);
      var isFiniteNumber=Number.isFinite.bind(Number);
      var objectKeys=Object.keys.bind(Object);
      var handles = new WeakMap();
      var getHandle = WeakMap.prototype.get.bind(handles), setHandle = WeakMap.prototype.set.bind(handles);
      var nodeHandles = new WeakMap();
      var getNodeHandle = WeakMap.prototype.get.bind(nodeHandles), setNodeHandle = WeakMap.prototype.set.bind(nodeHandles);
      var graphAncestors=new WeakSet(),hasAncestor=WeakSet.prototype.has.bind(graphAncestors),addAncestor=WeakSet.prototype.add.bind(graphAncestors),removeAncestor=WeakSet.prototype.delete.bind(graphAncestors);
      function makeResponse(value) {
        if (!value || typeof value.handle !== 'string' || typeof value.body !== 'string' || typeof value.url !== 'string' || typeof value.code !== 'number') throw new Error('Invalid response');
        var object = {body:function(){return value.body},url:function(){return value.url},code:function(){return value.code},statusCode:function(){return value.code},header:function(name){var key=String(name).toLowerCase(),headers=value.headers||{};for(var header in headers)if(Object.prototype.hasOwnProperty.call(headers,header)&&header.toLowerCase()===key)return headers[header];return null}};
        setHandle(object,value.handle);
        return object;
      }
      function domArgument(value){
        if(value===null||typeof value==='object')return value;
        if(typeof value==='function'||typeof value==='symbol'||typeof value==='bigint')return {};
        return String(value);
      }
      function makeElement(handle) {
        var object={
          attr:function(name){return callHost('dom.attr',[[handle],domArgument(name)])},
          text:function(){return callHost('dom.text',[[handle]])},
          html:function(){return callHost('dom.html',[[handle]])},
          select:function(selector){return callHost('dom.select',[[handle],domArgument(selector)])}
        };
        setNodeHandle(object,handle);
        return object;
      }
      function decodeInput(root){
        var refs=new Map(),nodes=new Map(),count=0,chars=0;
        function decode(item,depth){
          if(++count>8000||depth>20||!item||typeof item!=='object'||isArray(item))throw new Error('Invalid input');
          if(item.kind==='undefined')return undefined;
          if(item.kind==='number'){
            if(item.value==='NaN')return NaN;if(item.value==='Infinity')return Infinity;if(item.value==='-Infinity')return -Infinity;if(item.value==='-0')return -0;
            throw new Error('Invalid input number');
          }
          if(item.kind==='value'){
            if(typeof item.value==='string'){chars+=item.value.length;if(chars>1000000)throw new Error('Input exceeds limit');return item.value;}
            if(item.value===null||typeof item.value==='boolean'||typeof item.value==='number'&&isFiniteNumber(item.value))return item.value;
            throw new Error('Invalid input value');
          }
          if(item.kind==='node'){
            if(typeof item.handle!=='string')throw new Error('Invalid input node');
            if(!nodes.has(item.handle))nodes.set(item.handle,makeElement(item.handle));
            return nodes.get(item.handle);
          }
          if(item.kind==='ref'){
            if(!refs.has(item.id))throw new Error('Invalid input reference');return refs.get(item.id);
          }
          if(!Number.isSafeInteger(item.id)||item.id<1||refs.has(item.id))throw new Error('Invalid input id');
          if(item.kind==='array'){
            if(!isArray(item.items)||item.items.length>8000)throw new Error('Invalid input array');
            var array=[];refs.set(item.id,array);
            for(var i=0;i<item.items.length;i++)array[i]=decode(item.items[i],depth+1);
            return array;
          }
          if(item.kind==='object'){
            if(!isArray(item.entries)||item.entries.length>8000)throw new Error('Invalid input object');
            var object={},keys=new Set();refs.set(item.id,object);
            for(var j=0;j<item.entries.length;j++){
              var entry=item.entries[j];
              if(!isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||keys.has(entry[0]))throw new Error('Invalid input entry');
              keys.add(entry[0]);chars+=entry[0].length;if(chars>1000000)throw new Error('Input exceeds limit');
              Object.defineProperty(object,entry[0],{value:decode(entry[1],depth+1),writable:true,configurable:true,enumerable:true});
            }
            return object;
          }
          throw new Error('Invalid input kind');
        }
        return decode(root,0);
      }
      function makeList(values,elements) {
        function current(){var ids=[];for(var i=0;i<values.length;i++){var value=values[i],id=value&&typeof value==='object'?getNodeHandle(value):undefined;if(id!==undefined)ids[ids.length]=id}return ids}
        var methods={
          size:{value:function(){return this.length}},isEmpty:{value:function(){return this.length===0}},
          get:{value:function(index){index=Number(index);if(!Number.isInteger(index)||index<0||index>=this.length)throw new RangeError('列表索引越界');return this[index]}},
          toArray:{value:function(){return sliceArray(this)}}
        };
        if(elements){
          methods.attr={value:function(name){return callHost('dom.attr',[current(),domArgument(name)])}};
          methods.text={value:function(){return callHost('dom.text',[current()])}};
          methods.html={value:function(){return callHost('dom.html',[current()])}};
          methods.select={value:function(selector){return callHost('dom.select',[current(),domArgument(selector)])}};
        }
        Object.defineProperties(values,methods);
        return values;
      }
      function makeLookup(value){
        if(!value||typeof value!=='object')throw new Error('Invalid lookup response');
        if(value.kind==='node')return makeElement(value.handle);
        if(value.kind==='elements'&&isArray(value.handles)){var nodes=[];for(var i=0;i<value.handles.length;i++)nodes[i]=makeElement(value.handles[i]);return makeList(nodes,true)}
        if(value.kind==='values'&&isArray(value.values))return makeList(value.values,false);
        if(value.kind==='value')return value.value;
        throw new Error('Invalid lookup response');
      }
      function callHost(action,args) {
        if (typeof action !== 'string' || !isArray(args)) throw new Error('Invalid bridge call');
        if((action==='java.getString'||action==='java.getStringList')&&args[1]&&typeof args[1]==='object'){
          var contentNode=getNodeHandle(args[1]);
          if(contentNode!==undefined){args=sliceArray(args);args[1]=contentNode;action+='Node';}
        } else if(action==='java.setContent'&&args[0]&&typeof args[0]==='object'){
          var replacementNode=getNodeHandle(args[0]);
          if(replacementNode!==undefined){args=sliceArray(args);args[0]=replacementNode;action='java.setContentNode';}
        }
        var id = ++call;
        atomicStore(ctrl, 0, 0);
        send({type:'rpc',task:task,call:id,action:action,args:args});
        if (atomicWait(ctrl, 0, 0, 35000) === 'timed-out') throw new Error('Bridge timed out');
        var length = atomicLoad(ctrl, 1);
        if (length < 0 || length > bytes.length) throw new Error('Invalid bridge reply');
        var reply = parse(decode(sliceBytes(bytes, 0, length)));
        if (!reply.ok) throw new Error(String(reply.error || 'Bridge failed'));
        if (action === 'java.post' || action === 'java.connect' || action === 'java.startBrowserAwait') return makeResponse(reply.value);
        if (action === 'java.getElements' || action === 'java.getElement' || action === 'dom.select') return makeLookup(reply.value);
        return reply.value;
      }
      var api = Object.freeze({context:message.context, initialInput:message.initialInput===undefined?undefined:decodeInput(message.initialInput),initialResponse:message.initialResponse ? makeResponse(message.initialResponse) : undefined, call:callHost});
      Object.defineProperty(self, '__legado', {value:api, configurable:false, writable:false});
      if(message.context.largeSource)Object.defineProperty(self,'src',{configurable:true,enumerable:true,
        get:function(){throw new Error('JavaScript 输入过长')},
        set:function(value){Object.defineProperty(self,'src',{value:value,writable:true,configurable:true,enumerable:true})}});
      var result = (0, eval)(message.script);
      var handle = result && typeof result === 'object' ? getHandle(result) : undefined;
      var node = result && typeof result === 'object' ? getNodeHandle(result) : undefined;
      function encodeGraph(value){
        var count=0,chars=0;
        function encode(item,depth){
          if(++count>8000||depth>20)throw new Error('Output exceeds limit');
          if(item===undefined)return {kind:'undefined'};
          if(typeof item==='string'){chars+=item.length;if(chars>1000000)throw new Error('Output exceeds limit');return {kind:'value',value:item}}
          if(typeof item==='number'&&!isFiniteNumber(item))return {kind:'number',value:item!==item?'NaN':item>0?'Infinity':'-Infinity'};
          if(typeof item==='number'&&item===0&&1/item===-Infinity)return {kind:'number',value:'-0'};
          if(item===null||typeof item==='boolean'||typeof item==='number')return {kind:'value',value:item};
          if(typeof item!=='object')throw new Error('Unsupported output');
          var n=getNodeHandle(item);if(n!==undefined)return {kind:'node',handle:n};
          var r=getHandle(item);if(r!==undefined)return {kind:'response',handle:r};
          if(hasAncestor(item))throw new Error('Output contains a cycle');addAncestor(item);
          var encoded;
          if(isArray(item)){
            if(item.length>8000)throw new Error('Output exceeds limit');
            var items=[];for(var i=0;i<item.length;i++)items[i]=encode(item[i],depth+1);
            encoded={kind:'array',items:items};
          }else{
            var keys=objectKeys(item),entries=[];
            if(keys.length>8000)throw new Error('Output exceeds limit');
            for(var j=0;j<keys.length;j++){chars+=keys[j].length;if(chars>1000000)throw new Error('Output exceeds limit');entries[j]=[keys[j],encode(item[keys[j]],depth+1)];}
            encoded={kind:'object',entries:entries};
          }
          removeAncestor(item);return encoded;
        }
        return encode(value,0);
      }
      if (handle !== undefined) send({type:'response',task:task,handle:handle});
      else if(node!==undefined)send({type:'node',task:task,handle:node});
      else if((result && typeof result==='object') || typeof result==='number'&&(!isFiniteNumber(result)||result===0&&1/result===-Infinity))send({type:'graph',task:task,value:encodeGraph(result)});
      else send({type:'result',task:task,value:result});
    } catch (error) {
      send({type:'error',task:task,error:String(error && error.message || error).slice(0,1024)});
    }
  };
})();`;

export const SOURCE_WORKER_HTML = String.raw`<!doctype html><html><head><meta charset="utf-8"></head><body><script>
(function () {
  var nonce = location.hash.slice(1), active = null;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(nonce)) return;
  function emit(message) {
    message.nonce = nonce;
    var json = JSON.stringify(message);
    if (new TextEncoder().encode(json).length > 1000000) throw new Error('Message too large');
    window.ReactNativeWebView.postMessage(json);
  }
  function clear() {
    if (!active) return;
    clearTimeout(active.timer);
    active.worker.terminate();
    active = null;
  }
  function fail(message) {
    if (!active) return;
    var task = active.task;
    clear();
    try {emit({type:'error',task:task,error:String(message).slice(0,1024)});} catch (_) {}
  }
  function arm(ms) {
    clearTimeout(active.timer);
    active.timer = setTimeout(function(){fail('Worker timed out');}, ms);
  }
  window.__legadoReceive = function (command) {
    if (!command || !Number.isSafeInteger(command.task)) return;
    if (command.type === 'cancel') {if (active && active.task === command.task) clear(); return;}
    if (command.type === 'reply') {
      if (!active || active.task !== command.task || active.waiting !== command.call) return;
      try {
        var data = new TextEncoder().encode(JSON.stringify(command.ok ? {ok:true,value:command.value} : {ok:false,error:command.error}));
        if (data.length > active.bytes.length) throw new Error('Reply too large');
        active.bytes.set(data);
        Atomics.store(active.ctrl, 1, data.length);
        active.waiting = 0;
        arm(5000);
        Atomics.store(active.ctrl, 0, 1);
        Atomics.notify(active.ctrl, 0);
      } catch (error) {fail(error && error.message || error);}
      return;
    }
    if (command.type !== 'start' || active) return;
    try {
      var shared = new SharedArrayBuffer(1000016);
      var worker = new Worker(location.pathname + '/worker.js');
      var state = active = {task:command.task, worker:worker, ctrl:new Int32Array(shared,0,4), bytes:new Uint8Array(shared,16), waiting:0, call:0, timer:0};
      worker.onmessage = function (event) {
        if (active !== state) return;
        var message = event.data;
        if (!message || typeof message !== 'object') return fail('Invalid worker message');
        if (message.type === 'bootstrap-error') return fail(message.error);
        if (message.task !== state.task) return fail('Invalid worker task');
        if (message.type === 'rpc') {
          if (state.waiting || message.call !== state.call + 1 || !Array.isArray(message.args)) return fail('Invalid worker call');
          state.waiting = state.call = message.call;
          arm(35000);
          try {emit(message);} catch (error) {fail(error && error.message || error);}
        } else if (message.type === 'result' || message.type === 'response' || message.type === 'node' || message.type === 'nodes' || message.type === 'graph' || message.type === 'error') {
          if (state.waiting) return fail('Invalid worker result');
          clear();
          try {emit(message);} catch (error) {try {emit({type:'error',task:state.task,error:String(error)});} catch (_) {}}
        } else fail('Invalid worker message');
      };
      worker.onerror = function (event) {if (active === state) fail(event.message || 'Worker error');};
      arm(5000);
      worker.postMessage({type:'start',task:command.task,script:command.script,context:command.context,initialResponse:command.initialResponse,initialInput:command.initialInput,shared:shared});
    } catch (error) {if (active) fail(error && error.message || error); else {try {emit({type:'error',task:command.task,error:String(error)});} catch (_) {}}}
  };
  emit({type:'ready'});
})();
</script></body></html>`;
