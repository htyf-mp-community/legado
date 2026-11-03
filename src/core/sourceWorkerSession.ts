import { SourceHttpError, SourceRuleError } from './errors';

export type WorkerResponse = {handle:string; body:string; url:string; code:number; headers?:Record<string,string>};
export type WorkerCommand =
  | {
      type: 'start';
      task: number;
      script: string;
      context: Record<string, unknown>;
      initialResponse?: WorkerResponse;
      initialInput?: unknown;
    }
  | { type: 'reply'; task: number; call: number; ok: true; value: unknown }
  | { type: 'reply'; task: number; call: number; ok: false; error: string }
  | { type: 'cancel'; task: number };
type WorkerOptions = {
  readyMs?: number;
  executionMs?: number;
  bridgeMs?: number;
  allowedActions?: readonly string[];
  maxCalls?: number;
  resolveResponse?: (handle: string) => unknown;
  resolveNode?: (handle: string) => unknown;
};
type Invoke = (
  action: string,
  args: unknown[],
  signal: AbortSignal,
) => Promise<unknown>;
type Pending = {
  id: number;
  script: string;
  context: Record<string, unknown>;
  initialResponse?: WorkerResponse;
  initialInput?: unknown;
  started: boolean;
  waiting: boolean;
  call: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  controller: AbortController;
  external?: AbortSignal;
  onAbort?: () => void;
  timer?: ReturnType<typeof setTimeout>;
};
const MAX_SCRIPT = 16_384,
  MAX_MESSAGE = 1_000_000;
const DEFAULT_ACTIONS = [
  'java.ajax',
  'java.post',
  'java.encodeURI',
  'java.base64Encode',
  'java.base64Decode',
  'java.md5Encode',
  'java.md5Encode16',
  'java.digestHex',
  'java.digestBase64Str',
  'java.HMacHex',
  'java.HMacBase64',
  'java.randomUUID',
  'java.crypto.create',
  'java.crypto.run',
  'java.aesBase64DecodeToString',
  'java.strToBytes',
  'java.bytesToStr',
  'java.base64DecodeToByteArray',
  'java.t2s',
  'java.s2t',
  'java.toNumChapter',
  'java.hexDecodeToString',
  'java.hexEncodeToString',
  'cookie.removeCookie',
  'cookie.getCookie',
  'java.connect',
  'java.startBrowserAwait',
  'java.toast',
  'java.log',
  'java.get',
  'java.put',
  'source.get',
  'source.put',
  'source.getVariable',
  'source.setVariable',
  'java.getString',
  'java.getStringList',
  'java.getStringNode',
  'java.getStringListNode',
  'java.setContent',
  'java.setContentNode',
  'java.getElements',
  'java.getElement',
  'dom.attr',
  'dom.text',
  'dom.html',
  'dom.select',
] as const;
function aborted() {
  const error = new Error('Operation cancelled');
  error.name = 'AbortError';
  return error;
}
function assertMessageSize(json: string): void {
  if (json.length > MAX_MESSAGE) throw new SourceRuleError('JavaScript 消息过长');
  let bytes = 0;
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i);
    if (c < 0x80) bytes++;
    else if (c < 0x800) bytes += 2;
    else if (
      c >= 0xd800 &&
      c <= 0xdbff &&
      json.charCodeAt(i + 1) >= 0xdc00 &&
      json.charCodeAt(i + 1) <= 0xdfff
    ) {
      bytes += 4;
      i++;
    } else bytes += 3;
    if (bytes > MAX_MESSAGE) throw new SourceRuleError('JavaScript 消息过长');
  }
}
function boundedJson(value: unknown): string {
  let json: string | undefined;
  try {
    json = JSON.stringify(value);
  } catch {
    throw new SourceRuleError('JavaScript 消息无法序列化');
  }
  if (json === undefined)
    throw new SourceRuleError('JavaScript 消息无法序列化');
  assertMessageSize(json);
  return json;
}
function decodeWorkerGraph(root:unknown,resolveNode?: (handle:string)=>unknown,resolveResponse?: (handle:string)=>unknown):unknown {
  let count=0,chars=0;
  const decode=(input:unknown,depth:number):unknown=>{
    if(++count>8000 || depth>20 || !input || typeof input!=='object' || Array.isArray(input)) throw new SourceRuleError('JavaScript 输出超过限制或格式无效');
    const item=input as Record<string,unknown>;
    switch(item.kind){
      case 'undefined': return undefined;
      case 'number':
        if(item.value==='NaN')return Number.NaN;
        if(item.value==='Infinity')return Infinity;
        if(item.value==='-Infinity')return -Infinity;
        if(item.value==='-0')return -0;
        break;
      case 'value':
        if(item.value===null || typeof item.value==='boolean' || (typeof item.value==='number'&&Number.isFinite(item.value)))return item.value;
        if(typeof item.value==='string'){chars+=item.value.length;if(chars<=1_000_000)return item.value;}
        break;
      case 'node':
      case 'response': {
        if(typeof item.handle!=='string')break;
        const value=(item.kind==='node'?resolveNode:resolveResponse)?.(item.handle);
        if(value===undefined)throw new SourceRuleError(item.kind==='node'?'JavaScript 元素引用无效':'JavaScript 响应身份无效');
        return value;
      }
      case 'array':
        if(!Array.isArray(item.items)||item.items.length>8000)break;
        return item.items.map(value=>decode(value,depth+1));
      case 'object': {
        if(!Array.isArray(item.entries)||item.entries.length>8000)break;
        const result:Record<string,unknown>=Object.create(null),keys=new Set<string>();
        for(const entry of item.entries){
          if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||keys.has(entry[0]))throw new SourceRuleError('JavaScript 输出格式无效');
          chars+=entry[0].length;if(chars>1_000_000)throw new SourceRuleError('JavaScript 输出超过限制');
          keys.add(entry[0]);result[entry[0]]=decode(entry[1],depth+1);
        }
        return result;
      }
    }
    throw new SourceRuleError('JavaScript 输出格式无效');
  };
  return decode(root,0);
}
/** One asynchronous WebView channel; each task owns a fresh worker in the page. */
export class SourceWorkerSession {
  private ready = false;
  private disposed = false;
  private readonly pageNonces = new Set<string>();
  private nextId = 0;
  private pending?: Pending;
  private readonly readyMs: number;
  private readonly executionMs: number;
  private readonly bridgeMs: number;
  private readonly allowed: Set<string>;
  private readonly maxCalls: number;
  private readonly resolveResponse?: (handle:string) => unknown;
  private readonly resolveNode?: (handle:string) => unknown;
  constructor(
    private nonce: string | null,
    private send: (command: WorkerCommand) => void,
    private invoke: Invoke,
    options: WorkerOptions = {},
  ) {
    if (!nonce || !/^[A-Za-z0-9_-]{1,128}$/.test(nonce)) throw new SourceRuleError('JavaScript 页面标识无效');
    this.pageNonces.add(nonce);
    this.readyMs = options.readyMs ?? 5000;
    this.executionMs = options.executionMs ?? 1500;
    this.bridgeMs = options.bridgeMs ?? 30000;
    this.allowed = new Set(options.allowedActions ?? DEFAULT_ACTIONS);
    this.maxCalls = Math.max(1, Math.min(10_000, Math.floor(options.maxCalls ?? 256)));
    this.resolveResponse = options.resolveResponse;
    this.resolveNode = options.resolveNode;
  }
  run(
    script: string,
    context: Record<string, unknown>,
    signal?: AbortSignal,
    initialResponse?: WorkerResponse,
    initialInput?: unknown,
  ): Promise<unknown> {
    if (this.disposed)
      return Promise.reject(new SourceRuleError('JavaScript 运行通道已关闭'));
    if (!this.nonce)
      return Promise.reject(new SourceRuleError('JavaScript 运行页面不可用'));
    if (this.pending)
      return Promise.reject(new SourceRuleError('JavaScript 运行通道正忙'));
    if (signal?.aborted) return Promise.reject(aborted());
    if (script.length > MAX_SCRIPT)
      return Promise.reject(new SourceRuleError('JavaScript 脚本过长'));
    try {
      boundedJson({ script, context, initialResponse, initialInput });
    } catch (error) {
      return Promise.reject(error);
    }
    return new Promise((resolve, reject) => {
      const task: Pending = {
        id: ++this.nextId,
        script,
        context,
        initialResponse,
        initialInput,
        started: false,
        waiting: false,
        call: 0,
        resolve,
        reject,
        controller: new AbortController(),
        external: signal,
      };
      this.pending = task;
      if (signal) {
        task.onAbort = () => this.fail(task, aborted());
        signal.addEventListener('abort', task.onAbort, { once: true });
        if (signal.aborted) {
          task.onAbort();
          return;
        }
      }
      if (this.ready) this.start(task);
      else this.arm(task, this.readyMs, 'JavaScript 启动超时');
    });
  }
  receive(raw: string): void {
    const task = this.pending;
    try {assertMessageSize(raw);} catch (error) {if(task)this.fail(task,error as Error);return;}
    let message: any;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (!this.nonce || !message || typeof message !== 'object' || message.nonce !== this.nonce)
      return;
    if (message.type === 'ready') {
      if (this.disposed) return;
      this.ready = true;
      if (task && !task.started) this.start(task);
      return;
    }
    if (!task || !task.started || message.task !== task.id) return;
    if (message.type === 'result' || message.type === 'response' || message.type === 'node' || message.type === 'nodes' || message.type === 'graph') {
      if (task.waiting) {
        this.fail(task, new SourceRuleError('JavaScript 桥接协议无效'));
        return;
      }
      if (message.type === 'response') {
        try {
          const value = typeof message.handle === 'string' ? this.resolveResponse?.(message.handle) : undefined;
          if (value === undefined) throw new SourceRuleError('JavaScript 响应身份无效');
          this.finish(task, undefined, value);
        } catch (error) {this.fail(task,error instanceof Error ? error : new SourceRuleError('JavaScript 响应身份无效'));}
      } else if(message.type==='node' || message.type==='nodes') {
        try {
          const handles=message.type==='node'?[message.handle]:message.handles;
          if(!Array.isArray(handles)||handles.length>8000||handles.some(handle=>typeof handle!=='string')) throw new SourceRuleError('JavaScript 元素引用无效');
          const values=handles.map(handle=>{const node=this.resolveNode?.(handle);if(node===undefined)throw new SourceRuleError('JavaScript 元素引用无效');return node;});
          this.finish(task,undefined,message.type==='node'?values[0]:values);
        } catch(error) {this.fail(task,error instanceof Error?error:new SourceRuleError('JavaScript 元素引用无效'));}
      } else if(message.type==='graph') {
        try {this.finish(task,undefined,decodeWorkerGraph(message.value,this.resolveNode,this.resolveResponse));}
        catch(error) {this.fail(task,error instanceof Error?error:new SourceRuleError('JavaScript 输出格式无效'));}
      } else this.finish(task, undefined, message.value);
      return;
    }
    if (message.type === 'error') {
      this.fail(
        task,
        new SourceRuleError(
          `JavaScript 规则执行失败: ${typeof message.error === 'string' ? message.error.slice(0, 1024) : '未知错误'}`,
        ),
      );
      return;
    }
    if (message.type !== 'rpc') return;
    if (
      task.waiting ||
      !Number.isSafeInteger(message.call) ||
      message.call !== task.call + 1 ||
      !Array.isArray(message.args)
    ) {
      this.fail(task, new SourceRuleError('JavaScript 桥接协议无效'));
      return;
    }
    if (
      typeof message.action !== 'string' ||
      !this.allowed.has(message.action)
    ) {
      this.fail(task, new SourceRuleError('JavaScript 桥接接口不支持'));
      return;
    }
    if (message.call > this.maxCalls) {
      this.fail(task, new SourceRuleError('JavaScript 宿主调用次数超过限制'));
      return;
    }
    task.call = message.call;
    task.waiting = true;
    this.arm(task, this.bridgeMs, 'JavaScript 宿主调用超时');
    let promise: Promise<unknown>;
    try {
      promise = this.invoke(
        message.action,
        message.args,
        task.controller.signal,
      );
    } catch (error) {
      this.rpcFailure(task, message.call, error);
      return;
    }
    Promise.resolve(promise).then(
      value => this.rpcSuccess(task, message.call, value),
      error => this.rpcFailure(task, message.call, error),
    );
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.pending)
      this.fail(this.pending, new SourceRuleError('JavaScript 运行通道已关闭'));
  }
  /** Invalidate a failed WebView; late messages from it are no longer accepted. */
  pageUnavailable(nonce?: string): void {
    if (this.disposed || (nonce !== undefined && nonce !== this.nonce)) return;
    this.ready = false;
    if (this.pending) this.fail(this.pending, new SourceRuleError('JavaScript 运行页面不可用'));
    this.nonce = null;
  }
  /** Call before loading a replacement document with a fresh, random fragment. */
  replacePage(nonce: string): void {
    if (this.disposed) throw new SourceRuleError('JavaScript 运行通道已关闭');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(nonce) || this.pageNonces.has(nonce))
      throw new SourceRuleError('JavaScript 页面标识无效');
    this.ready = false;
    if (this.pending) this.fail(this.pending, new SourceRuleError('JavaScript 运行页面重新加载'));
    this.pageNonces.add(nonce);
    this.nonce = nonce;
  }
  private start(task: Pending) {
    if (this.pending !== task) return;
    task.started = true;
    this.arm(task, this.executionMs, 'JavaScript 执行超时');
    try {
      this.send({
        type: 'start',
        task: task.id,
        script: task.script,
        context: task.context,
        ...(task.initialResponse ? {initialResponse:task.initialResponse} : {}),
        ...(task.initialInput !== undefined ? {initialInput:task.initialInput} : {}),
      });
    } catch (error) {
      this.fail(
        task,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
  private arm(task: Pending, ms: number, message: string) {
    if (task.timer !== undefined) clearTimeout(task.timer);
    task.timer = setTimeout(
      () => this.fail(task, new SourceRuleError(message)),
      ms,
    );
  }
  private liveCall(task: Pending, call: number) {
    return this.pending === task && task.waiting && task.call === call;
  }
  private reply(task: Pending, command: WorkerCommand) {
    try {
      boundedJson(command);
      task.waiting = false;
      this.arm(task, this.executionMs, 'JavaScript 执行超时');
      this.send(command);
    } catch (error) {
      this.fail(
        task,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
  private rpcSuccess(task: Pending, call: number, value: unknown) {
    if (!this.liveCall(task, call)) return;
    this.reply(task, {
      type: 'reply',
      task: task.id,
      call,
      ok: true,
      value,
    });
  }
  private rpcFailure(task: Pending, call: number, error: unknown) {
    if (!this.liveCall(task, call)) return;
    if (
      (error instanceof SourceRuleError && !(error instanceof SourceHttpError)) ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      this.fail(task, error);
      return;
    }
    this.reply(task, {
      type: 'reply',
      task: task.id,
      call,
      ok: false,
      error: (error instanceof Error ? error.message : String(error)).slice(
        0,
        1024,
      ),
    });
  }
  private fail(task: Pending, error: Error) {
    this.finish(task, error);
  }
  private finish(task: Pending, error?: Error, value?: unknown) {
    if (this.pending !== task) return;
    this.pending = undefined;
    if (task.timer !== undefined) clearTimeout(task.timer);
    if (task.external && task.onAbort)
      task.external.removeEventListener('abort', task.onAbort);
    task.controller.abort();
    if (error) {
      try {
        this.send({ type: 'cancel', task: task.id });
      } catch {}
      task.reject(error);
    } else task.resolve(value);
  }
}
