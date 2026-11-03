import {SourceRuleError} from './errors';
import {createSourceWorkerBridge, prepareSourceWorkerScript} from './sourceWorkerBridge';
import {SourceWorkerSession, type WorkerCommand} from './sourceWorkerSession';
import type {SourceJavaScriptBridge} from './sourceJavaScript';

type Task = {
  script:string;
  bridge:SourceJavaScriptBridge;
  input:unknown;
  signal?:AbortSignal;
  onAbort?:()=>void;
  resolve:(value:unknown)=>void;
  reject:(error:unknown)=>void;
};
function cancellation() {const error=new Error('Operation cancelled');error.name='AbortError';return error;}

/** Experimental queued execution; the caller owns the WebView and its lease. */
export class SourceWorkerExecutor {
  private readonly session:SourceWorkerSession;
  private queue:Task[]=[];
  private active?:Task;
  private adapter?:ReturnType<typeof createSourceWorkerBridge>;
  private disposed=false;
  private page:string|null;
  constructor(nonce:string, send:(command:WorkerCommand)=>void) {
    this.page=nonce;
    this.session=new SourceWorkerSession(nonce,send,
      (action,args,signal)=>{
        if (!this.adapter) throw new SourceRuleError('JavaScript 运行通道已关闭');
        return this.adapter.invoke(action,args,signal);
      },
      {resolveResponse:handle=>this.adapter?.resolveResponse(handle),resolveNode:handle=>this.adapter?.resolveNode(handle)});
  }
  run(script:string,bridge:SourceJavaScriptBridge,input:unknown='',signal?:AbortSignal):Promise<unknown> {
    if (this.disposed) return Promise.reject(new SourceRuleError('JavaScript 运行通道已关闭'));
    if (!this.page) return Promise.reject(new SourceRuleError('JavaScript 运行页面不可用'));
    if (signal?.aborted) return Promise.reject(cancellation());
    if (this.queue.length>=64) return Promise.reject(new SourceRuleError('JavaScript 任务队列已满'));
    return new Promise((resolve,reject)=>{
      const task:Task={script,bridge,input,signal,resolve,reject};
      if (signal) {
        task.onAbort=()=>{
          const index=this.queue.indexOf(task);
          if (index<0) return;
          this.queue.splice(index,1);
          signal.removeEventListener('abort',task.onAbort!);
          reject(cancellation());
        };
        signal.addEventListener('abort',task.onAbort,{once:true});
      }
      this.queue.push(task);
      if (signal?.aborted) {task.onAbort?.();return;}
      this.drain();
    });
  }
  receive(raw:string):void {this.session.receive(raw);}
  pageUnavailable(nonce?:string):void {
    if (this.disposed || (nonce!==undefined && nonce!==this.page)) return;
    this.page=null;
    this.session.pageUnavailable(nonce);
    this.rejectQueued(new SourceRuleError('JavaScript 运行页面不可用'));
  }
  replacePage(nonce:string):void {
    this.session.replacePage(nonce);
    this.page=nonce;
    this.drain();
  }
  dispose():void {
    if (this.disposed) return;
    this.disposed=true;
    this.session.dispose();
    this.rejectQueued(new SourceRuleError('JavaScript 运行通道已关闭'));
  }
  private rejectQueued(error:Error):void {
    for (const task of this.queue.splice(0)) {
      if (task.signal && task.onAbort) task.signal.removeEventListener('abort',task.onAbort);
      task.reject(error);
    }
  }
  private drain():void {
    if (this.active || this.disposed || !this.page) return;
    const task=this.queue.shift();
    if (!task) return;
    if (task.signal && task.onAbort) task.signal.removeEventListener('abort',task.onAbort);
    this.active=task;
    const complete=(error:unknown,value?:unknown)=>{
      this.active=undefined;
      this.adapter=undefined;
      if (error !== undefined) task.reject(error); else task.resolve(value);
      this.drain();
    };
    try {
      this.adapter=createSourceWorkerBridge(task.bridge);
      const ruleMode=task.bridge.ruleMode===true;
      const sourceUrl=ruleMode?task.bridge.sourceUrl:task.bridge.sourceUrl ?? task.bridge.baseUrl;
      const rawGlobals=task.bridge.ruleGlobals??{};
      const largeSource=typeof rawGlobals.src==='string'&&rawGlobals.src.length>1_000_000&&rawGlobals.src!==task.input;
      const globals=largeSource?{...rawGlobals,src:undefined}:rawGlobals;
      const context={baseUrl:ruleMode?rawGlobals.baseUrl:task.bridge.baseUrl,sourceUrl,key:task.bridge.key,page:task.bridge.page,hasSource:!!sourceUrl,ruleMode,hasSourceVariables:!!task.bridge.sourceVariables,hasLookup:!!task.bridge.lookup,largeSource};
      const initialInput=this.adapter.encodeInput({result:task.input,globals});
      this.session.run(prepareSourceWorkerScript(task.script),context,task.signal,this.adapter.initialResponse,initialInput).then(value=>complete(undefined,value),error=>complete(error));
    } catch (error) {complete(error);}
  }
}
