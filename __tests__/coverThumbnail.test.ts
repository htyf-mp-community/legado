import {
  bitmapMime,
  coverThumbnail,
  defaultCoverSources,
  registerCoverRasterizer,
  validCoverPng,
  type CoverRasterizer,
} from '../src/core/coverThumbnail';
const bitmap = { base64: 'input', mime: 'image/png' };
const event = () => {
  let signal!: () => void;
  const promise = new Promise<void>(resolve => {
    signal = resolve;
  });
  return { promise, signal };
};
let detach: (() => void) | undefined;
afterEach(() => {
  detach?.();
  detach = undefined;
  jest.useRealTimers();
});
test('same-key requests share loading and rendering, then reuse the successful thumbnail', async () => {
  let finish!: (value: string) => void;
  const ready = event();
  const render = jest.fn(
      () =>
        new Promise<string>(resolve => {
          finish = resolve;
          ready.signal();
        }),
    ),
    load = jest.fn(async () => bitmap);
  detach = registerCoverRasterizer({
    render,
    defaultSources: () => ['default'],
  });
  const first = coverThumbnail('same', load),
    second = coverThumbnail('same', load);
  expect(second).toBe(first);
  await ready.promise;
  finish('png');
  expect(await first).toBe('png');
  expect(await coverThumbnail('same', load)).toBe('png');
  expect(load).toHaveBeenCalledTimes(1);
  expect(render).toHaveBeenCalledTimes(1);
});
test('image loading is bounded while native canvas decoding remains serial', async () => {
  let firstDone!: (value: string) => void;
  const ready = event();
  const render = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>(resolve => {
            firstDone = resolve;
            ready.signal();
          }),
      )
      .mockResolvedValue('next'),
    load = jest.fn(async () => bitmap);
  detach = registerCoverRasterizer({ render, defaultSources: () => [] });
  const a = coverThumbnail('first', load),
    b = coverThumbnail('second', load),
    c = coverThumbnail('third', load),
    d = coverThumbnail('fourth', load),
    e = coverThumbnail('fifth', load);
  await ready.promise;
  expect(load).toHaveBeenCalledTimes(4);
  expect(render).toHaveBeenCalledTimes(1);
  firstDone('first');
  await Promise.all([a, b, c, d, e]);
  expect(load).toHaveBeenCalledTimes(5);
});
test('a failed image does not block later requests or become a successful cache entry', async () => {
  const render = jest.fn(async () => 'png'),
    load = jest
      .fn()
      .mockRejectedValueOnce(new Error('bad'))
      .mockResolvedValue(bitmap);
  detach = registerCoverRasterizer({ render, defaultSources: () => [] });
  await expect(coverThumbnail('retry', load)).rejects.toThrow('bad');
  expect(await coverThumbnail('retry', load)).toBe('png');
  expect(load).toHaveBeenCalledTimes(2);
});
test('a timed-out loader cannot render late or overwrite the following request', async () => {
  jest.useFakeTimers();
  let late!: (value: typeof bitmap) => void;
  const render = jest.fn(async () => 'current');
  detach = registerCoverRasterizer({ render, defaultSources: () => [] });
  const failed = coverThumbnail(
      'slow',
      () =>
        new Promise(resolve => {
          late = resolve;
        }),
      100,
    ),
    rejected = expect(failed).rejects.toThrow('timed out');
  await Promise.resolve();
  await jest.advanceTimersByTimeAsync(100);
  await rejected;
  expect(await coverThumbnail('fresh', async () => bitmap)).toBe('current');
  late(bitmap);
  await Promise.resolve();
  await Promise.resolve();
  expect(render).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
test('replacing the renderer rejects an older in-flight response and keeps the newer provider attached', async () => {
  const ready = event();
  let finish!: (value: string) => void;
  const old = registerCoverRasterizer({
    render: () =>
      new Promise(resolve => {
        finish = resolve;
        ready.signal();
      }),
    defaultSources: () => ['old'],
  });
  const pending = coverThumbnail('cover', async () => bitmap),
    rejected = expect(pending).rejects.toThrow('changed');
  await ready.promise;
  const provider: CoverRasterizer = {
    render: async () => 'new',
    defaultSources: () => ['new'],
  };
  detach = registerCoverRasterizer(provider);
  old();
  finish('old');
  await rejected;
  expect(defaultCoverSources()).toEqual(['new']);
  expect(await coverThumbnail('cover', async () => bitmap)).toBe('new');
});
test('recognizes real bitmap signatures and only accepts the native cover output dimensions', () => {
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(png.buffer);
  view.setUint32(16, 84);
  view.setUint32(20, 112);
  expect(bitmapMime(png)).toBe('image/png');
  expect(validCoverPng(png)).toBe(true);
  view.setUint32(20, 336);
  expect(validCoverPng(png)).toBe(false);
  expect(bitmapMime(new Uint8Array([255, 216, 255]))).toBe('image/jpeg');
  expect(bitmapMime(new Uint8Array([60, 104, 116, 109, 108]))).toBeUndefined();
});

test('each request deadline includes time waiting behind another decode', async () => {
  const ready = event();
  jest.useFakeTimers();
  let finish!: (value: string) => void;
  const render = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<string>(resolve => {
          finish = resolve;
          ready.signal();
        }),
    )
    .mockResolvedValue('next');
  detach = registerCoverRasterizer({ render, defaultSources: () => [] });
  const first = coverThumbnail('long-decode', async () => bitmap, 5000);
  let result = 'pending';
  const second = coverThumbnail('waiting-decode', async () => bitmap, 100).then(
    () => {
      result = 'success';
    },
    () => {
      result = 'timed-out';
    },
  );
  await ready.promise;
  await jest.advanceTimersByTimeAsync(100);
  const atDeadline = result;
  finish('first');
  await first;
  await second;
  expect(atDeadline).toBe('timed-out');
});
