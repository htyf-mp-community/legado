type FakeRequest = {
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
};
type FakeHandler = (request: FakeRequest) =>
  | Promise<{
      statusCode: number;
      body?: string;
      headers?: Record<string, string>;
    }>
  | { statusCode: number; body?: string; headers?: Record<string, string> };
const mockNative: {
  running: boolean;
  port: number;
  forcedPort?: number;
  handler?: FakeHandler;
  starts: number;
  stops: number;
  listener?: (state: string) => void;
  counter: number;
} = { running: false, port: 0, starts: 0, stops: 0, counter: 0 };
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, fn: (state: string) => void) => {
      mockNative.listener = fn;
      return {
        remove: () => {
          mockNative.listener = undefined;
        },
      };
    },
  },
}));
jest.mock('react-native-quick-crypto', () => ({
  randomUUID: () =>
    `00000000-0000-4000-8000-${String(++mockNative.counter).padStart(12, '0')}`,
}));
jest.mock('react-native-nitro-http-server', () => ({
  HttpServer: class {
    port = 0;
    async isRunning() {
      return mockNative.running;
    }
    async start(port: number, handler: FakeHandler) {
      mockNative.starts++;
      mockNative.running = true;
      this.port = mockNative.forcedPort ?? (port || 18001);
      mockNative.port = this.port;
      mockNative.handler = handler;
      return this.port;
    }
    async stop() {
      mockNative.stops++;
      mockNative.running = false;
      mockNative.handler = undefined;
    }
  },
}));

type Runtime = typeof import('../src/services/localServerRuntime');
let runtime: Runtime;
async function request(path: string, method = 'GET') {
  if (!mockNative.handler) throw new Error('no listener');
  return await mockNative.handler({
    requestId: 'r',
    method,
    path,
    headers: {},
  });
}
beforeEach(() => {
  jest.resetModules();
  Object.assign(mockNative, {
    running: false,
    port: 0,
    forcedPort: undefined,
    handler: undefined,
    starts: 0,
    stops: 0,
    listener: undefined,
    counter: 0,
  });
  jest.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = new URL(String(input));
    if (
      !mockNative.running ||
      Number(url.port) !== mockNative.port ||
      !mockNative.handler
    )
      throw new Error('not listening');
    const response = await request(url.pathname + url.search);
    return {
      ok: response.statusCode === 200,
      status: response.statusCode,
      text: async () => response.body ?? '',
    } as Response;
  });
  runtime = require('../src/services/localServerRuntime');
});
afterEach(() => jest.restoreAllMocks());

test('shares a running Web listener and leaves it running when the worker releases', async () => {
  await runtime.startLocalServer('web', 1122, async () => ({
    statusCode: 200,
    body: 'web',
  }));
  const lease = await runtime.acquireLocalWorkerPage(
    '<!doctype html>worker',
    'worker',
  );
  const url = new URL(lease.url);
  expect(url.port).toBe('1122');
  expect(mockNative.starts).toBe(1);
  const page = await request(url.pathname);
  expect(page).toMatchObject({
    statusCode: 200,
    body: '<!doctype html>worker',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cache-Control': 'no-store',
    },
  });
  expect((await request('/books')).body).toBe('web');
  await lease.release();
  await lease.release();
  expect(mockNative.stops).toBe(0);
  expect((await request('/books')).body).toBe('web');
  await runtime.stopLocalServer('web');
  expect(mockNative.stops).toBe(1);
});

test('worker retains a listener if the public service is stopped first', async () => {
  await runtime.startLocalServer('mcp', 1236, async () => ({
    statusCode: 200,
    body: 'mcp',
  }));
  const lease = await runtime.acquireLocalWorkerPage('page', 'worker');
  await runtime.stopLocalServer('mcp');
  expect(mockNative.stops).toBe(0);
  expect((await request(new URL(lease.url).pathname)).body).toBe('page');
  expect((await request('/mcp')).statusCode).toBe(404);
  await lease.release();
  expect(mockNative.stops).toBe(1);
});

test('multiple worker leases use separate secret URLs and release independently', async () => {
  const [one, two] = await Promise.all([
    runtime.acquireLocalWorkerPage('one', 'worker'),
    runtime.acquireLocalWorkerPage('two', 'worker'),
  ]);
  expect(one.url).not.toBe(two.url);
  expect(mockNative.starts).toBe(1);
  const path = new URL(one.url).pathname;
  expect((await request(path, 'POST')).statusCode).toBe(405);
  await one.release();
  expect((await request(path)).statusCode).toBe(404);
  expect((await request(new URL(two.url).pathname)).body).toBe('two');
  await two.release();
  expect(mockNative.stops).toBe(1);
});

test('serves a separate worker with a stricter policy and removes both resources on release', async () => {
  await runtime.startLocalServer('web', 1122, async () => ({
    statusCode: 404,
  }));
  const lease = await runtime.acquireLocalWorkerPage('parent', 'worker code');
  const parentPath = new URL(lease.url).pathname;
  const parent = await request(parentPath);
  const worker = await request(`${parentPath}/worker.js`);
  expect(parent.headers?.['Content-Security-Policy']).toContain(
    "worker-src 'self'",
  );
  expect(parent.headers?.['Content-Security-Policy']).not.toContain(
    "'unsafe-eval'",
  );
  expect(worker).toMatchObject({
    statusCode: 200,
    body: 'worker code',
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cache-Control': 'no-store',
    },
  });
  expect(worker.headers?.['Content-Security-Policy']).toContain(
    "connect-src 'none'",
  );
  expect(worker.headers?.['Content-Security-Policy']).toContain(
    "worker-src 'none'",
  );
  expect((await request(`${parentPath}/worker.js`, 'POST')).statusCode).toBe(
    405,
  );
  await lease.release();
  expect((await request(parentPath)).statusCode).toBe(404);
  expect((await request(`${parentPath}/worker.js`)).statusCode).toBe(404);
  await runtime.stopLocalServer('web');
});

test('rejects oversized worker resources without starting a listener', async () => {
  await expect(
    runtime.acquireLocalWorkerPage('parent', 'x'.repeat(1_000_001)),
  ).rejects.toThrow(/过大/);
  expect(mockNative.starts).toBe(0);
});

test('requires a separate worker script instead of falling back to a less restricted blob worker', async () => {
  await expect(
    runtime.acquireLocalWorkerPage('parent', undefined as never),
  ).rejects.toThrow(/脚本/);
  expect(mockNative.starts).toBe(0);
});

test('refuses a port change while a worker is active and preserves that worker', async () => {
  const lease = await runtime.acquireLocalWorkerPage('page', 'worker');
  await expect(
    runtime.startLocalServer('web', 1122, async () => ({ statusCode: 200 })),
  ).rejects.toThrow(/运行/);
  expect(mockNative.stops).toBe(0);
  expect((await request(new URL(lease.url).pathname)).body).toBe('page');
  await lease.release();
  await runtime.startLocalServer('web', 1122, async () => ({
    statusCode: 200,
  }));
  await runtime.stopLocalServer('web');
});

test('does not start or stop the process-wide listener when another owner already runs it', async () => {
  mockNative.running = true;
  mockNative.port = 9999;
  mockNative.handler = async () => ({ statusCode: 200, body: 'foreign' });
  await expect(
    runtime.acquireLocalWorkerPage('page', 'worker'),
  ).rejects.toThrow(/其他/);
  await expect(
    runtime.startLocalServer('web', 1122, async () => ({ statusCode: 200 })),
  ).rejects.toThrow(/其他/);
  expect(mockNative.starts).toBe(0);
  expect(mockNative.stops).toBe(0);
});

test('does not stop a listener replaced by an external owner', async () => {
  await runtime.startLocalServer('web', 1122, async () => ({
    statusCode: 200,
    body: 'web',
  }));
  mockNative.handler = async () => ({ statusCode: 200, body: 'foreign' });
  await expect(runtime.stopLocalServer('web')).rejects.toThrow(/其他|核实/);
  expect(mockNative.stops).toBe(0);
});

test('does not stop an external listener when the last worker lease is released', async () => {
  const lease = await runtime.acquireLocalWorkerPage('page', 'worker');
  mockNative.handler = async () => ({ statusCode: 200, body: 'foreign' });
  await expect(lease.release()).rejects.toThrow(/其他|核实/);
  expect(mockNative.stops).toBe(0);
});

test('foreground recovery leaves an externally replaced listener untouched', async () => {
  await runtime.startLocalServer('web', 1122, async () => ({
    statusCode: 200,
    body: 'web',
  }));
  mockNative.handler = async () => ({ statusCode: 200, body: 'foreign' });
  mockNative.listener?.('active');
  expect((await runtime.localServerState('web', 1122)).running).toBe(false);
  expect(mockNative.starts).toBe(1);
  expect(mockNative.stops).toBe(0);
});

test('only restarts an owned listener on foreground when no other listener is running', async () => {
  await runtime.startLocalServer('web', 1122, async () => ({
    statusCode: 200,
    body: 'web',
  }));
  mockNative.running = false;
  mockNative.listener?.('active');
  await runtime.localServerState('web', 1122);
  expect(mockNative.starts).toBe(2);
  expect((await request('/')).body).toBe('web');
  await runtime.stopLocalServer('web');
});

test('stopping an owned service after the native listener has died does not stop an unrelated server', async () => {
  await runtime.startLocalServer('web', 1122, async () => ({
    statusCode: 200,
  }));
  mockNative.running = false;
  mockNative.handler = undefined;
  await expect(runtime.stopLocalServer('web')).resolves.toBeUndefined();
  expect(mockNative.stops).toBe(0);
  await runtime.startLocalServer('mcp', 1236, async () => ({
    statusCode: 200,
  }));
  expect((await runtime.localServerState('mcp', 1236)).running).toBe(true);
  await runtime.stopLocalServer('mcp');
});

test('manual start recovers a dead listener without waiting for a foreground event', async () => {
  await runtime.startLocalServer('web', 1122, async () => ({
    statusCode: 200,
    body: 'old',
  }));
  mockNative.running = false;
  mockNative.handler = undefined;
  await runtime.startLocalServer('web', 1122, async () => ({
    statusCode: 200,
    body: 'new',
  }));
  expect((await request('/')).body).toBe('new');
  expect(mockNative.starts).toBe(2);
  expect(mockNative.stops).toBe(0);
  await runtime.stopLocalServer('web');
});

test('cleans up an owned replacement that unexpectedly binds a different port', async () => {
  const lease = await runtime.acquireLocalWorkerPage('page', 'worker');
  mockNative.running = false;
  mockNative.handler = undefined;
  mockNative.forcedPort = 19000;
  await expect(
    runtime.startLocalServer('web', 18001, async () => ({ statusCode: 200 })),
  ).rejects.toThrow(/恢复失败/);
  expect(mockNative.stops).toBe(1);
  expect(mockNative.running).toBe(false);
  await lease.release();
});
