import {SourceWorkerExecutor} from '../src/core/sourceWorkerExecutor';
import type {WorkerCommand} from '../src/core/sourceWorkerSession';

const bridge=(url:string)=>({baseUrl:url,sourceUrl:url,key:'书',page:1,ajax:async()=>url,removeCookie:()=>{}});
const tick=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
const ready=(executor:SourceWorkerExecutor,nonce='page')=>executor.receive(JSON.stringify({type:'ready',nonce}));
const finish=(executor:SourceWorkerExecutor,task:number,value:unknown,nonce='page')=>executor.receive(JSON.stringify({type:'result',nonce,task,value}));

test('serializes concurrent scripts and keeps each source context separate', async () => {
  const commands:WorkerCommand[]=[];
  const executor=new SourceWorkerExecutor('page',command=>commands.push(command));
  const first=executor.run('key',bridge('https://one.example'));
  const second=executor.run('key',bridge('https://two.example'));
  ready(executor);
  expect(commands.filter(item=>item.type==='start')).toHaveLength(1);
  expect(commands[0]).toMatchObject({type:'start',task:1,context:{sourceUrl:'https://one.example'}});
  finish(executor,1,'first');
  await expect(first).resolves.toBe('first');await tick();
  expect(commands[1]).toMatchObject({type:'start',task:2,context:{sourceUrl:'https://two.example'}});
  finish(executor,2,'second');
  await expect(second).resolves.toBe('second');executor.dispose();
});

test('removes a cancelled queued task without disturbing the running task', async () => {
  const commands:WorkerCommand[]=[];const executor=new SourceWorkerExecutor('page',command=>commands.push(command));
  ready(executor);
  const first=executor.run('1',bridge('https://one.example'));
  const controller=new AbortController();
  const cancelled=executor.run('2',bridge('https://two.example'),'',controller.signal);
  controller.abort();await expect(cancelled).rejects.toMatchObject({name:'AbortError'});
  finish(executor,1,1);await expect(first).resolves.toBe(1);await tick();
  expect(commands.filter(item=>item.type==='start')).toHaveLength(1);executor.dispose();
});

test('uses the current task response registry and rejects queued tasks on page failure', async () => {
  const executor=new SourceWorkerExecutor('page',()=>{});
  const response={data:'body',body:'body',url:'https://example.org',code:200};
  const first=executor.run('result',{...bridge('https://example.org'),response});
  const queued=executor.run('2',bridge('https://two.example'));
  ready(executor);executor.receive('{"type":"response","nonce":"page","task":1,"handle":"1"}');
  expect(await first).toBe(response);await tick();
  executor.pageUnavailable('page');await expect(queued).rejects.toThrow(/不可用/);
  await expect(executor.run('3',bridge('https://two.example'))).rejects.toThrow(/不可用/);
  executor.replacePage('new');const recovered=executor.run('4',bridge('https://two.example'));
  ready(executor,'new');finish(executor,3,4,'new');await expect(recovered).resolves.toBe(4);executor.dispose();
});

test('a failing task does not prevent the next source from executing', async () => {
  const sent:WorkerCommand[]=[];const executor=new SourceWorkerExecutor('page',command=>sent.push(command));
  ready(executor);
  const failed=executor.run('1',bridge('https://one.example'));
  const next=executor.run('2',bridge('https://two.example'));
  executor.receive('{"type":"error","nonce":"page","task":1,"error":"bad rule"}');
  await expect(failed).rejects.toThrow('bad rule');await tick();
  finish(executor,2,2);await expect(next).resolves.toBe(2);
  expect(sent.filter(command=>command.type==='start')).toHaveLength(2);executor.dispose();
});

test('disposing rejects both the active and queued tasks', async () => {
  const executor=new SourceWorkerExecutor('page',()=>{});
  ready(executor);
  const active=executor.run('1',bridge('https://one.example'));
  const queued=executor.run('2',bridge('https://two.example'));
  executor.dispose();
  await expect(active).rejects.toThrow(/关闭/);
  await expect(queued).rejects.toThrow(/关闭/);
  await expect(executor.run('3',bridge('https://three.example'))).rejects.toThrow(/关闭/);
});

test('does not serialize an unused oversized source page when the selected result is small',async()=>{
  const commands:WorkerCommand[]=[],executor=new SourceWorkerExecutor('page',command=>commands.push(command));
  ready(executor);
  const page='x'.repeat(1_000_001);
  const pending=executor.run('result',{...bridge('https://example.org'),ruleMode:true,ruleGlobals:{src:page}},'正文');
  expect(commands[0]).toMatchObject({type:'start',context:{largeSource:true}});
  expect(JSON.stringify(commands[0])).not.toContain(page);
  finish(executor,1,'正文');await expect(pending).resolves.toBe('正文');
  await expect(executor.run('result',{...bridge('https://example.org'),ruleMode:true,ruleGlobals:{src:page}},page)).rejects.toThrow(/限制|过长/);
  executor.dispose();
});
