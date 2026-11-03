import {SourceWorkerRuntime} from '../src/core/sourceWorkerRuntime';
import type {WorkerCommand} from '../src/core/sourceWorkerSession';
const bridge={baseUrl:'https://example.org',sourceUrl:'https://example.org',key:'书',page:1,ajax:async()=>'',removeCookie:()=>{}};
const ready=(runtime:SourceWorkerRuntime,nonce:string)=>runtime.receive(JSON.stringify({type:'ready',nonce}));
const result=(runtime:SourceWorkerRuntime,nonce:string,task:number,value:unknown)=>runtime.receive(JSON.stringify({type:'result',nonce,task,value}));
const tick=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
function setup(){let serial=0;const sent:WorkerCommand[]=[],views:Array<{url:string;nonce:string}|null>=[],release=jest.fn(async()=>{});
 const runtime=new SourceWorkerRuntime({acquire:jest.fn(async()=>({url:'http://127.0.0.1:1234/page',release})),nonce:()=>`page_${++serial}`,send:command=>sent.push(command),showPage:page=>views.push(page)});
 return {runtime,sent,views,release};}
test('acquires one page, queues until ready and releases it on disposal',async()=>{
 const {runtime,sent,views,release}=setup();await Promise.all([runtime.start(),runtime.start()]);expect(views).toEqual([{url:'http://127.0.0.1:1234/page#page_1',nonce:'page_1'}]);
 const pending=runtime.runJavaScript('1+1',bridge);expect(sent).toEqual([]);ready(runtime,'page_1');expect(sent[0]).toMatchObject({type:'start',task:1});result(runtime,'page_1',1,2);await expect(pending).resolves.toBe(2);
 await runtime.dispose();expect(release).toHaveBeenCalledTimes(1);expect(views.at(-1)).toBeNull();await expect(runtime.runJavaScript('1',bridge)).rejects.toThrow(/关闭/);
});
test('failure rejects work, ignores old callbacks and recovers with a fresh page',async()=>{
 const {runtime,views}=setup();await runtime.start();ready(runtime,'page_1');const pending=runtime.runJavaScript('1',bridge);runtime.pageUnavailable('page_1');await expect(pending).rejects.toThrow(/不可用/);
 await Promise.all([runtime.start(),runtime.start()]);expect(views.at(-1)).toEqual({url:'http://127.0.0.1:1234/page#page_2',nonce:'page_2'});expect(views.filter(view=>view?.nonce==='page_2')).toHaveLength(1);const next=runtime.runJavaScript('2',bridge);
 runtime.pageUnavailable('page_1');ready(runtime,'page_1');result(runtime,'page_1',2,9);ready(runtime,'page_2');result(runtime,'page_2',2,2);await expect(next).resolves.toBe(2);await runtime.dispose();
});
test('dispose while acquiring releases the eventual lease without mounting a page',async()=>{
 let finish!:(lease:{url:string;release:()=>Promise<void>})=>void;const release=jest.fn(async()=>{}),views=jest.fn();
 const runtime=new SourceWorkerRuntime({acquire:()=>new Promise(resolve=>{finish=resolve;}),nonce:()=> 'page',send:jest.fn(),showPage:views});
 const start=runtime.start();const disposed=runtime.dispose();finish({url:'http://127.0.0.1:1/page',release});await expect(start).rejects.toThrow(/关闭/);await disposed;await tick();expect(release).toHaveBeenCalledTimes(1);expect(views).not.toHaveBeenCalledWith(expect.objectContaining({nonce:'page'}));
});
test('a failed WebView mount leaves the runtime unavailable and can be retried',async()=>{
 let serial=0,fail=false;const release=jest.fn(async()=>{}),showPage=jest.fn(()=>{if(fail)throw new Error('mount failed');});
 const runtime=new SourceWorkerRuntime({acquire:async()=>({url:'http://127.0.0.1:1/page',release}),nonce:()=>`page_${++serial}`,send:jest.fn(),showPage});
 await runtime.start();fail=true;expect(()=>runtime.reload()).toThrow('mount failed');await expect(runtime.runJavaScript('1',bridge)).rejects.toThrow(/不可用/);
 fail=false;runtime.reload();const next=runtime.runJavaScript('2',bridge);ready(runtime,'page_3');result(runtime,'page_3',1,2);await expect(next).resolves.toBe(2);await runtime.dispose();
});
test('start reports failed remounts and retries after the mount problem clears',async()=>{
 let serial=0,fail=false;const release=jest.fn(async()=>{}),showPage=jest.fn((page)=>{if(page&&fail)throw new Error('mount failed');});
 const runtime=new SourceWorkerRuntime({acquire:async()=>({url:'http://127.0.0.1:1/page',release}),nonce:()=>`page_${++serial}`,send:jest.fn(),showPage});
 await runtime.start();runtime.pageUnavailable('page_1');fail=true;
 await expect(runtime.start()).rejects.toThrow('mount failed');
 fail=false;await runtime.start();const next=runtime.runJavaScript('2',bridge);ready(runtime,'page_3');result(runtime,'page_3',1,2);
 await expect(next).resolves.toBe(2);await runtime.dispose();expect(release).toHaveBeenCalledTimes(1);
});
test('oversized messages from a previous page cannot cancel a new task',async()=>{
 const {runtime}=setup();await runtime.start();runtime.pageUnavailable('page_1');runtime.reload();const task=runtime.runJavaScript('2',bridge);ready(runtime,'page_2');
 runtime.receive('x'.repeat(1_000_001),'page_1');result(runtime,'page_2',1,2);await expect(task).resolves.toBe(2);await runtime.dispose();
});
