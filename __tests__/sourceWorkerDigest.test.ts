jest.mock('react-native-quick-crypto', () => require('node:crypto'));
import { runInNewContext } from 'node:vm';
import { createSourceWorkerBridge, prepareSourceWorkerScript } from '../src/core/sourceWorkerBridge';
import { SourceWorkerSession, type WorkerCommand } from '../src/core/sourceWorkerSession';

const bridge = () => createSourceWorkerBridge({ baseUrl: 'https://example.org', key: null, page: 1, ajax: async () => '', removeCookie: () => {} });
const signal = new AbortController().signal;

test('exposes digest, HMAC and UUID calls with their original arguments', () => {
  const calls: unknown[] = [];
  runInNewContext(prepareSourceWorkerScript("java.digestHex('书','SHA-256');java.digestBase64Str('书','SHA-1');java.HMacHex('书','HmacSHA256','key');java.HMacBase64('书','HmacMD5','key');java.randomUUID()"), {
    __legado: { context: {}, call: (action: string, args: unknown[]) => { calls.push([action, Array.from(args)]); return ''; } },
  });
  expect(calls).toEqual([
    ['java.digestHex', ['书', 'SHA-256']], ['java.digestBase64Str', ['书', 'SHA-1']],
    ['java.HMacHex', ['书', 'HmacSHA256', 'key']], ['java.HMacBase64', ['书', 'HmacMD5', 'key']],
    ['java.randomUUID', []],
  ]);
  calls.length = 0;
  runInNewContext(prepareSourceWorkerScript("java.HMacHex('x','SHA-1');java.HMacBase64('x','SHA-1',undefined);java.HMacHex('x','HmacSHA1',null)"), {
    __legado: { context: {}, call: (action: string, args: unknown[]) => { calls.push([action, Array.from(args)]); return ''; } },
  });
  expect(calls).toEqual([
    ['java.HMacHex', ['x', 'SHA-1']], ['java.HMacBase64', ['x', 'SHA-1']], ['java.HMacHex', ['x', 'HmacSHA1', null]],
  ]);
});

test.each([
  ['java.digestHex', ['西游记', 'SHA-256'], '942c26cac8c24d7070c084e2a5a4c3166e612b604d46db2b19600586c53fd995'],
  ['java.digestBase64Str', ['西游记', 'SHA-1'], 'VklNE8vHWXnr6SAkRMmL+5+xJpY='],
  ['java.HMacHex', ['西游记', 'HMAC-SHA1', 'snY%169j'], 'a4781450fd18ca1e3642d2c2060bd29b4fd56eb6'],
  ['java.HMacBase64', ['西游记', 'HmacSHA256', 'snY%169j'], 'ZeXuQgd1Mkl7DQSpF0N6W5s54hyNTsJ+ZRTwr5ztyVo='],
])('matches Java digest output for %s', async (action, args, expected) => {
  await expect(bridge().invoke(action, args, signal)).resolves.toBe(expected);
});

test('handles malformed UTF-16, invalid algorithms and empty HMAC keys', async () => {
  const b = bridge();
  await expect(b.invoke('java.digestHex', ['\ud800', 'SHA-256'], signal)).resolves.toBe(require('node:crypto').createHash('sha256').update('?').digest('hex'));
  await expect(b.invoke('java.digestHex', ['x', 'unknown'], signal)).rejects.toThrow(/算法/);
  await expect(b.invoke('java.HMacHex', ['x', 'HmacSHA1', ''], signal)).rejects.toThrow(/密钥/);
  await expect(b.invoke('java.HMacHex', ['x', 'SHA-1', 'key'], signal)).rejects.toThrow(/算法/);
  await expect(b.invoke('java.HMacHex', ['x', 'SHA-1'], signal)).resolves.toBe(require('node:crypto').createHash('sha1').update('x').digest('hex'));
  await expect(b.invoke('java.digestHex', ['abc', 'MD5'], signal)).resolves.toBe('900150983cd24fb0d6963f7d28e17f72');
});

test('limits both individual digest input and total per-task encoding work', async () => {
  const b = bridge();
  expect(() => b.invoke('java.digestHex', ['x'.repeat(64001), 'MD5'], signal)).toThrow(/限制/);
  const many = bridge();
  for (let i = 0; i < 15; i++) await many.invoke('java.digestHex', ['x'.repeat(64000), 'MD5'], signal);
  expect(() => many.invoke('java.digestHex', ['x'.repeat(64000), 'MD5'], signal)).toThrow(/限制/);
});

test('provides bounded, task-local version 4 UUID generation', async () => {
  const b = bridge();
  const first = await b.invoke('java.randomUUID', [], signal);
  const second = await b.invoke('java.randomUUID', [], signal);
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(first).not.toBe(second);
  for (let i = 2; i < 1024; i++) await b.invoke('java.randomUUID', [], signal);
  await expect(b.invoke('java.randomUUID', [], signal)).rejects.toThrow(/次数/);
  await expect(bridge().invoke('java.randomUUID', [], signal)).resolves.toMatch(/^[0-9a-f-]{36}$/);
});

test('permits digest calls through the worker session protocol', async () => {
  const sent: WorkerCommand[] = [], b = bridge();
  const session = new SourceWorkerSession('test', command => sent.push(command), b.invoke);
  session.receive('{"type":"ready","nonce":"test"}');
  const result = session.run('script', {});
  void result.catch(() => undefined);
  session.receive(JSON.stringify({ type: 'rpc', nonce: 'test', task: 1, call: 1, action: 'java.digestHex', args: ['abc', 'MD5'] }));
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(sent).toContainEqual(expect.objectContaining({ type: 'reply', task: 1, call: 1, ok: true, value: '900150983cd24fb0d6963f7d28e17f72' }));
  session.receive('{"type":"result","nonce":"test","task":1,"value":"ok"}');
  await expect(result).resolves.toBe('ok');
  session.dispose();
});
