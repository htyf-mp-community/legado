jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn() },
}));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
jest.mock('../src/data/httpLog', () => ({ addHttpLog: jest.fn() }));
import {
  executeSourceRequest,
  type SourceRequest,
} from '../src/core/sourceRequest';
const request: SourceRequest = {
  url: 'http://example.test/search',
  method: 'GET',
  headers: {},
  sourceId: 'test',
  cookieJar: false,
};
const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});
test('an already cancelled operation never starts a request', async () => {
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = jest.fn();
  await expect(
    executeSourceRequest(request, 15000, controller.signal),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
test('cancelling the preferred transport does not start the HTTP fallback', async () => {
  const controller = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  globalThis.fetch = jest.fn(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options!.signal!.addEventListener('abort', () =>
          reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })),
        );
        started();
      }),
  );
  const pending = executeSourceRequest(request, 15000, controller.signal),
    rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await ready;
  controller.abort();
  await rejected;
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});
test('a response body that ignores cancellation cannot complete as a successful result', async () => {
  const controller = new AbortController();
  let started!: () => void, finish!: (text: string) => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  globalThis.fetch = jest.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: () =>
          new Promise<string>(resolve => {
            finish = resolve;
            started();
          }),
      }) as Response,
  );
  const pending = executeSourceRequest(request, 15000, controller.signal),
    rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await ready;
  controller.abort();
  finish('{"stale":true}');
  await rejected;
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});
