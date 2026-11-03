import {SourceRuleError} from './errors';
import {SourceWorkerExecutor} from './sourceWorkerExecutor';
import {createSourceWorkerRuleRunner} from './sourceWorkerRuleRunner';
import type {SourceJavaScriptRunner} from './sourceJavaScript';
import type {SourceRuleScriptRunner} from './sourceRule';
import type {WorkerCommand} from './sourceWorkerSession';
import type {LocalWorkerPageLease} from '../services/localServerRuntime';

type WorkerPage = {url:string;nonce:string};
type RuntimeDependencies = {
  acquire:()=>Promise<LocalWorkerPageLease>;
  nonce:()=>string;
  send:(command:WorkerCommand)=>void;
  showPage:(page:WorkerPage|null)=>void;
};
const closed=()=>new SourceRuleError('JavaScript 运行通道已关闭');

/** Owns a single experimental page lease and executor; the caller owns its WebView. */
export class SourceWorkerRuntime {
  private disposed=false;
  private starting?:Promise<void>;
  private disposing?:Promise<void>;
  private lease?:LocalWorkerPageLease;
  private executor?:SourceWorkerExecutor;
  private page?:WorkerPage;
  constructor(private readonly deps:RuntimeDependencies) {}

  start():Promise<void> {
    if(this.disposed)return Promise.reject(closed());
    if(this.executor){
      if(!this.page){try {this.reload();} catch(error) {return Promise.reject(error);}}
      return Promise.resolve();
    }
    if(this.starting)return this.starting;
    const start=async()=>{
      const lease=await this.deps.acquire();
      if(this.disposed){await lease.release();throw closed();}
      let executor:SourceWorkerExecutor|undefined;
      try {
        const nonce=this.deps.nonce();
        executor=new SourceWorkerExecutor(nonce,command=>this.deps.send(command));
        const page={url:`${lease.url}#${nonce}`,nonce};
        this.lease=lease;this.executor=executor;this.page=page;
        this.deps.showPage(page);
      } catch(error) {
        executor?.dispose();this.lease=undefined;this.executor=undefined;this.page=undefined;
        await lease.release();throw error;
      }
    };
    const pending=start();this.starting=pending;
    void pending.then(()=>{if(this.starting===pending)this.starting=undefined;},()=>{if(this.starting===pending)this.starting=undefined;});
    return pending;
  }
  readonly runJavaScript:SourceJavaScriptRunner=(script,bridge,input,signal)=>{
    if(this.disposed)return Promise.reject(closed());
    if(!this.executor)return Promise.reject(new SourceRuleError('JavaScript 运行页面不可用'));
    return this.executor.run(script,bridge,input,signal);
  };
  readonly runRuleJavaScript:SourceRuleScriptRunner=(task,signal)=>{
    if(this.disposed)return Promise.reject(closed());
    if(!this.executor)return Promise.reject(new SourceRuleError('JavaScript 运行页面不可用'));
    return createSourceWorkerRuleRunner(this.executor)(task,signal);
  };
  receive(raw:string,nonce?:string):void {
    if(!this.disposed && (nonce===undefined || this.page?.nonce===nonce))this.executor?.receive(raw);
  }
  pageUnavailable(nonce:string):void {
    if(this.disposed||this.page?.nonce!==nonce)return;
    this.executor?.pageUnavailable(nonce);this.page=undefined;this.deps.showPage(null);
  }
  reload():void {
    if(this.disposed)throw closed();
    if(!this.executor||!this.lease)throw new SourceRuleError('JavaScript 运行页面不可用');
    const nonce=this.deps.nonce();this.executor.replacePage(nonce);
    const page={url:`${this.lease.url}#${nonce}`,nonce};this.page=page;
    try {this.deps.showPage(page);}
    catch(error) {this.executor.pageUnavailable(nonce);this.page=undefined;throw error;}
  }
  dispose():Promise<void> {
    if(this.disposing)return this.disposing;
    this.disposed=true;
    this.executor?.dispose();this.executor=undefined;
    if(this.page){this.page=undefined;this.deps.showPage(null);}
    const lease=this.lease;this.lease=undefined;
    this.disposing=(async()=>{if(lease)await lease.release();if(this.starting)await this.starting.catch(()=>undefined);})();
    return this.disposing;
  }
}
