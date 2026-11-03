import {
  SourceWorkerSession,
  type WorkerCommand,
} from '../src/core/sourceWorkerSession';
import { SourceHttpError, SourceRuleError } from '../src/core/errors';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('waits for its page, executes one task, and ignores foreign or stale results', async () => {
  const sent: WorkerCommand[] = [];
  const session = new SourceWorkerSession(
    'nonce',
    command => sent.push(command),
    async () => null,
  );
  const result = session.run('1+1', { key: '书' });
  expect(sent).toEqual([]);
  session.receive(JSON.stringify({ type: 'ready', nonce: 'other' }));
  expect(sent).toEqual([]);
  session.receive(JSON.stringify({ type: 'ready', nonce: 'nonce' }));
  expect(sent).toEqual([
    expect.objectContaining({
      type: 'start',
      task: 1,
      script: '1+1',
      context: { key: '书' },
    }),
  ]);
  session.receive(
    JSON.stringify({ type: 'result', nonce: 'nonce', task: 2, value: 99 }),
  );
  session.receive(
    JSON.stringify({ type: 'result', nonce: 'nonce', task: 1, value: 2 }),
  );
  await expect(result).resolves.toBe(2);
  session.receive(
    JSON.stringify({ type: 'result', nonce: 'nonce', task: 1, value: 3 }),
  );
  expect(sent).toHaveLength(1);
  session.dispose();
});

test('delivers a synchronous RPC reply and resumes the execution budget', async () => {
  const sent: WorkerCommand[] = [],
    invoke = jest.fn(async () => ({ body: '正文' }));
  const session = new SourceWorkerSession(
    'n',
    command => sent.push(command),
    invoke,
    { executionMs: 100, bridgeMs: 1000 },
  );
  session.receive('{"type":"ready","nonce":"n"}');
  const result = session.run('script', {});
  jest.advanceTimersByTime(80);
  session.receive(
    JSON.stringify({
      type: 'rpc',
      nonce: 'n',
      task: 1,
      call: 1,
      action: 'java.ajax',
      args: ['https://example.org'],
    }),
  );
  await flush();
  expect(invoke).toHaveBeenCalledWith(
    'java.ajax',
    ['https://example.org'],
    expect.any(AbortSignal),
  );
  expect(sent).toContainEqual(
    expect.objectContaining({
      type: 'reply',
      task: 1,
      call: 1,
      ok: true,
      value: { body: '正文' },
    }),
  );
  jest.advanceTimersByTime(80);
  session.receive(
    JSON.stringify({ type: 'result', nonce: 'n', task: 1, value: 'ok' }),
  );
  await expect(result).resolves.toBe('ok');
  session.dispose();
});

test('cancels an in-flight host request and ignores its late result', async () => {
  const sent: WorkerCommand[] = [];
  let finish!: (value: string) => void;
  let hostSignal!: AbortSignal;
  const session = new SourceWorkerSession(
    'n',
    command => sent.push(command),
    (_action, _args, signal) => {
      hostSignal = signal;
      return new Promise(resolve => {
        finish = resolve;
      });
    },
  );
  session.receive('{"type":"ready","nonce":"n"}');
  const controller = new AbortController();
  const result = session.run('script', {}, controller.signal);
  session.receive(
    JSON.stringify({
      type: 'rpc',
      nonce: 'n',
      task: 1,
      call: 1,
      action: 'java.ajax',
      args: ['x'],
    }),
  );
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  expect(hostSignal.aborted).toBe(true);
  expect(sent).toContainEqual({ type: 'cancel', task: 1 });
  finish('late');
  await flush();
  expect(sent.filter(x => x.type === 'reply')).toHaveLength(0);
  session.dispose();
});

test('enforces separate ready, execution and host-call timeouts', async () => {
  const sent: WorkerCommand[] = [];
  const session = new SourceWorkerSession(
    'n',
    command => sent.push(command),
    () => new Promise(() => {}),
    { readyMs: 10, executionMs: 20, bridgeMs: 30 },
  );
  const initial = session.run('a', {});
  jest.advanceTimersByTime(10);
  await expect(initial).rejects.toThrow(/启动.*超时/);
  session.receive('{"type":"ready","nonce":"n"}');
  const busy = session.run('b', {});
  jest.advanceTimersByTime(20);
  await expect(busy).rejects.toThrow(/执行.*超时/);
  const waiting = session.run('c', {});
  session.receive(
    JSON.stringify({
      type: 'rpc',
      nonce: 'n',
      task: 3,
      call: 1,
      action: 'java.ajax',
      args: [],
    }),
  );
  jest.advanceTimersByTime(30);
  await expect(waiting).rejects.toThrow(/调用.*超时/);
  expect(sent.filter(x => x.type === 'cancel')).toHaveLength(3);
  session.dispose();
});

test('reports ordinary bridge errors to the worker but treats policy errors as fatal', async () => {
  const sent: WorkerCommand[] = [];
  const invoke = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockRejectedValueOnce(new SourceRuleError('blocked'));
  const session = new SourceWorkerSession(
    'n',
    command => sent.push(command),
    invoke,
  );
  session.receive('{"type":"ready","nonce":"n"}');
  const result = session.run('script', {});
  session.receive(
    JSON.stringify({
      type: 'rpc',
      nonce: 'n',
      task: 1,
      call: 1,
      action: 'java.ajax',
      args: [],
    }),
  );
  await flush();
  expect(sent).toContainEqual(
    expect.objectContaining({
      type: 'reply',
      task: 1,
      call: 1,
      ok: false,
      error: 'offline',
    }),
  );
  session.receive(
    JSON.stringify({
      type: 'rpc',
      nonce: 'n',
      task: 1,
      call: 2,
      action: 'java.post',
      args: [],
    }),
  );
  await flush();
  await expect(result).rejects.toThrow('blocked');
  expect(sent).toContainEqual({ type: 'cancel', task: 1 });
  session.dispose();
});

test('refuses duplicate calls, unsupported actions and oversized messages', async () => {
  const sent: WorkerCommand[] = [];
  const session = new SourceWorkerSession(
    'n',
    command => sent.push(command),
    () => new Promise(() => {}),
  );
  session.receive('{"type":"ready","nonce":"n"}');
  const first = session.run('script', {});
  session.receive(
    JSON.stringify({
      type: 'rpc',
      nonce: 'n',
      task: 1,
      call: 1,
      action: 'java.ajax',
      args: [],
    }),
  );
  session.receive(
    JSON.stringify({
      type: 'rpc',
      nonce: 'n',
      task: 1,
      call: 1,
      action: 'java.ajax',
      args: [],
    }),
  );
  await expect(first).rejects.toThrow(/协议/);
  const second = session.run('script', {});
  session.receive(
    JSON.stringify({
      type: 'rpc',
      nonce: 'n',
      task: 2,
      call: 1,
      action: 'evil',
      args: [],
    }),
  );
  await expect(second).rejects.toThrow(/接口/);
  await expect(session.run('x'.repeat(16_385), {})).rejects.toThrow(/过长/);
  const third = session.run('script', {});
  session.receive('x'.repeat(1_000_001));
  await expect(third).rejects.toThrow(/过长/);
  session.dispose();
});

test('counts UTF-8 bytes when limiting incoming messages', async () => {
  const session = new SourceWorkerSession('n', () => {}, async () => null);
  session.receive('{"type":"ready","nonce":"n"}');
  const result = session.run('script', {});
  session.receive(JSON.stringify({type:'result',nonce:'n',task:1,value:'书'.repeat(340_000)}));
  await expect(result).rejects.toThrow(/过长/);
  session.dispose();
});

test('preserves undefined from a host call instead of converting it to null', async () => {
  const sent: WorkerCommand[] = [];
  const session = new SourceWorkerSession('n', command => sent.push(command), async () => undefined);
  session.receive('{"type":"ready","nonce":"n"}');
  const result = session.run('script', {});
  session.receive(JSON.stringify({type:'rpc',nonce:'n',task:1,call:1,action:'cookie.removeCookie',args:[]}));
  await flush();
  expect(sent).toContainEqual({type:'reply',task:1,call:1,ok:true,value:undefined});
  session.receive('{"type":"result","nonce":"n","task":1}');
  await expect(result).resolves.toBeUndefined();
  session.dispose();
});

test('lets source scripts handle HTTP errors while preserving fatal policy errors', async () => {
  const sent:WorkerCommand[]=[];
  const session=new SourceWorkerSession('n',command=>sent.push(command),async()=>{throw new SourceHttpError(403)});
  session.receive('{"type":"ready","nonce":"n"}');
  const result=session.run('script',{});
  session.receive('{"type":"rpc","nonce":"n","task":1,"call":1,"action":"java.post","args":[]}');
  await flush();
  expect(sent).toContainEqual(expect.objectContaining({type:'reply',ok:false,error:'HTTP 403'}));
  session.receive('{"type":"result","nonce":"n","task":1,"value":"recovered"}');
  await expect(result).resolves.toBe('recovered');session.dispose();
});

test('stops a task that exceeds its host-call budget', async () => {
  const session=new SourceWorkerSession('n',()=>{},async()=>null,{maxCalls:2});
  session.receive('{"type":"ready","nonce":"n"}');
  const result=session.run('script',{});
  for(let call=1;call<=2;call++){session.receive(JSON.stringify({type:'rpc',nonce:'n',task:1,call,action:'java.ajax',args:[]}));await flush();}
  session.receive(JSON.stringify({type:'rpc',nonce:'n',task:1,call:3,action:'java.ajax',args:[]}));
  await expect(result).rejects.toThrow(/次数/);session.dispose();
});

test('maps a worker response handle back to its original host object', async () => {
  const original={body:'ok',url:'https://example.org',code:200};
  const session=new SourceWorkerSession('n',()=>{},async()=>null,{resolveResponse:handle=>handle==='opaque' ? original : undefined});
  session.receive('{"type":"ready","nonce":"n"}');
  const result=session.run('result',{},undefined,{handle:'opaque',...original});
  session.receive('{"type":"response","nonce":"n","task":1,"handle":"opaque"}');
  expect(await result).toBe(original);
  const invalid=session.run('result',{});
  session.receive('{"type":"response","nonce":"n","task":2,"handle":"unknown"}');
  await expect(invalid).rejects.toThrow(/响应/);
  session.dispose();
});

test('maps returned node handles to their original elements and rejects unknown handles', async () => {
  const first={name:'first'},second={name:'second'};
  const session=new SourceWorkerSession('n',()=>{},async()=>null,{resolveNode:id=>id==='1'?first:id==='2'?second:undefined});
  session.receive('{"type":"ready","nonce":"n"}');
  const result=session.run('elements',{});
  session.receive('{"type":"nodes","nonce":"n","task":1,"handles":["1","2"]}');
  const values=await result as unknown[];
  expect(values[0]).toBe(first);expect(values[1]).toBe(second);
  const invalid=session.run('node',{});
  session.receive('{"type":"node","nonce":"n","task":2,"handle":"unknown"}');
  await expect(invalid).rejects.toThrow(/元素/);session.dispose();
});

test('restores nested node and response identities while retaining ordinary objects', async () => {
  const node={hostNode:true},response={hostResponse:true};
  const session=new SourceWorkerSession('n',()=>{},async()=>null,{resolveNode:id=>id==='1'?node:undefined,resolveResponse:id=>id==='2'?response:undefined});
  session.receive('{"type":"ready","nonce":"n"}');
  const result=session.run('mixed',{});
  session.receive(JSON.stringify({type:'graph',nonce:'n',task:1,value:{kind:'array',items:[{kind:'node',handle:'1'},{kind:'object',entries:[['response',{kind:'response',handle:'2'}],['ordinary',{kind:'object',entries:[['kind',{kind:'value',value:'node'}],['handle',{kind:'value',value:'1'}]]}]]}]}}));
  const values=await result as [unknown,{response:unknown;ordinary:unknown}];
  expect(values[0]).toBe(node);expect(values[1].response).toBe(response);expect(values[1].ordinary).toEqual({kind:'node',handle:'1'});
  const invalid=session.run('bad',{});
  session.receive('{"type":"graph","nonce":"n","task":2,"value":{"kind":"node","handle":"bad"}}');
  await expect(invalid).rejects.toThrow(/元素/);session.dispose();
});

test('decodes negative zero from a worker graph without losing its sign', async () => {
  const session=new SourceWorkerSession('n',()=>{},async()=>{});
  session.receive('{"type":"ready","nonce":"n"}');
  const result=session.run('value',{});
  session.receive('{"type":"graph","nonce":"n","task":1,"value":{"kind":"number","value":"-0"}}');
  expect(Object.is(await result,-0)).toBe(true);
});
test('rejects malformed output graphs with duplicate object keys', async () => {
  const session=new SourceWorkerSession('n',()=>{},async()=>null);
  session.receive('{"type":"ready","nonce":"n"}');
  const result=session.run('bad',{});
  session.receive(JSON.stringify({type:'graph',nonce:'n',task:1,value:{kind:'object',entries:[['x',{kind:'value',value:1}],['x',{kind:'value',value:2}]]}}));
  await expect(result).rejects.toThrow(/格式/);session.dispose();
});

test('replacing a page aborts its task, ignores old messages, and waits for the new page', async () => {
  const sent:WorkerCommand[]=[];
  let hostSignal:AbortSignal|undefined;
  const session=new SourceWorkerSession('old',command=>sent.push(command),(_action,_args,signal)=>{hostSignal=signal;return new Promise(()=>{});});
  session.receive('{"type":"ready","nonce":"old"}');
  const first=session.run('first',{});
  session.receive('{"type":"rpc","nonce":"old","task":1,"call":1,"action":"java.ajax","args":[]}');
  session.replacePage('new');
  await expect(first).rejects.toThrow(/重新加载/);
  expect(hostSignal?.aborted).toBe(true);
  const second=session.run('second',{});
  session.receive('{"type":"ready","nonce":"old"}');
  session.receive('{"type":"result","nonce":"old","task":2,"value":"stale"}');
  expect(sent.filter(command=>command.type==='start')).toHaveLength(1);
  session.receive('{"type":"ready","nonce":"new"}');
  session.receive('{"type":"result","nonce":"new","task":2,"value":"new page"}');
  await expect(second).resolves.toBe('new page');
  session.dispose();
});

test('unavailable page rejects pending work and cannot be revived by its old ready message', async () => {
  const sent:WorkerCommand[]=[];
  const session=new SourceWorkerSession('old',command=>sent.push(command),async()=>null);
  const first=session.run('waiting',{});
  session.pageUnavailable();
  await expect(first).rejects.toThrow(/页面不可用/);
  session.receive('{"type":"ready","nonce":"old"}');
  await expect(session.run('next',{})).rejects.toThrow(/页面不可用/);
  expect(()=>session.replacePage('old')).toThrow(/页面标识/);
  session.replacePage('fresh');
  const next=session.run('next',{});
  session.receive('{"type":"ready","nonce":"fresh"}');
  session.receive('{"type":"result","nonce":"fresh","task":2,"value":42}');
  await expect(next).resolves.toBe(42);
  session.dispose();
});

test('ignores a late WebView failure from a replaced page', async () => {
  const session=new SourceWorkerSession('old',()=>{},async()=>null);
  session.replacePage('new');
  const result=session.run('new task',{});
  session.pageUnavailable('old');
  session.receive('{"type":"ready","nonce":"new"}');
  session.receive('{"type":"result","nonce":"new","task":1,"value":42}');
  await expect(result).resolves.toBe(42);
  session.dispose();
});
