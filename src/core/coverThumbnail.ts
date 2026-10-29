export const COVER_THUMBNAIL_WIDTH = 84,
  COVER_THUMBNAIL_HEIGHT = 112;
export type CoverBitmap = { base64: string; mime: string };
export type CoverRasterizer = {
  render: (bitmap: CoverBitmap, signal: AbortSignal) => Promise<string>;
  defaultSources: () => string[];
};
let provider: CoverRasterizer | undefined;
let renderQueue: Promise<unknown> = Promise.resolve();
let activeJobs = 0;
const starters: Array<() => void> = [];
const drain = () => {
  while (activeJobs < 4 && starters.length) starters.shift()!();
};
const pending = new Map<string, Promise<string>>(),
  cache = new Map<string, { value: string; expires: number }>();
export function registerCoverRasterizer(value: CoverRasterizer) {
  if (provider !== value) cache.clear();
  provider = value;
  return () => {
    if (provider === value) {
      provider = undefined;
      cache.clear();
    }
  };
}
export function defaultCoverSources() {
  return provider?.defaultSources() ?? [];
}
/** Bounded image loading, one canvas decode, and a per-request deadline that includes queue time. */
export function coverThumbnail(
  key: string,
  load: (signal: AbortSignal) => Promise<CoverBitmap>,
  timeout = 3000,
): Promise<string> {
  const prior = cache.get(key);
  if (prior && prior.expires > Date.now()) {
    cache.delete(key);
    cache.set(key, prior);
    return Promise.resolve(prior.value);
  }
  const waiting = pending.get(key);
  if (waiting) return waiting;
  const current = provider;
  if (!current) return Promise.reject(new Error('Cover renderer unavailable'));
  const controller = new AbortController(),
    deadline = Date.now() + timeout,
    error = new Error('Cover rendering timed out');
  let rejectExpired!: (error: Error) => void,
    release = () => undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    rejectExpired = reject;
  });
  const expire = () => {
    rejectExpired(error);
    controller.abort();
  };
  const timer = setTimeout(expire, timeout);
  const acquired = new Promise<void>((resolve, reject) => {
    const cancel = () => {
      const at = starters.indexOf(begin);
      if (at >= 0) starters.splice(at, 1);
      reject(error);
    };
    const begin = () => {
      if (controller.signal.aborted || Date.now() >= deadline) {
        expire();
        return;
      }
      controller.signal.removeEventListener('abort', cancel);
      activeJobs++;
      let released = false;
      release = () => {
        if (!released) {
          released = true;
          activeJobs--;
          drain();
        }
      };
      resolve();
    };
    controller.signal.addEventListener('abort', cancel);
    if (activeJobs < 4) begin();
    else starters.push(begin);
  });
  const check = () => {
    if (controller.signal.aborted) throw error;
    if (provider !== current) throw new Error('Cover renderer changed');
  };
  const rendered = (async () => {
    await acquired;
    check();
    const bitmap = await load(controller.signal);
    check();
    const result = renderQueue.then(() => {
      check();
      return current.render(bitmap, controller.signal);
    });
    const bounded = Promise.race([result, expired]);
    renderQueue = bounded.then(
      () => undefined,
      () => undefined,
    );
    return bounded;
  })();
  const job = Promise.race([rendered, expired])
    .then(value => {
      check();
      cache.set(key, { value, expires: Date.now() + 3600000 });
      while (cache.size > 128) cache.delete(cache.keys().next().value!);
      return value;
    })
    .finally(() => {
      clearTimeout(timer);
      controller.abort();
      release();
    });
  pending.set(key, job);
  void job
    .finally(() => {
      if (pending.get(key) === job) pending.delete(key);
    })
    .catch(() => undefined);
  return job;
}
export const bitmapMime = (bytes: Uint8Array) => {
  const starts = (...values: number[]) =>
    values.every((value, index) => bytes[index] === value);
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) return 'image/png';
  if (starts(255, 216, 255)) return 'image/jpeg';
  if (starts(71, 73, 70, 56) && [55, 57].includes(bytes[4]) && bytes[5] === 97)
    return 'image/gif';
  if (
    starts(82, 73, 70, 70) &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80
  )
    return 'image/webp';
  if (starts(66, 77)) return 'image/bmp';
  if (starts(73, 73, 42, 0) || starts(77, 77, 0, 42)) return 'image/tiff';
  if (
    bytes[4] === 102 &&
    bytes[5] === 116 &&
    bytes[6] === 121 &&
    bytes[7] === 112 &&
    bytes[8] === 104 &&
    bytes[9] === 101
  )
    return 'image/heic';
};
export function validCoverPng(bytes: Uint8Array) {
  if (bytes.length < 24 || bitmapMime(bytes) !== 'image/png') return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return (
    view.getUint32(16) === COVER_THUMBNAIL_WIDTH &&
    view.getUint32(20) === COVER_THUMBNAIL_HEIGHT
  );
}
