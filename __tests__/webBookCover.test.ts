const BufferValue = jest.requireActual('node:buffer').Buffer;
const mockPng = new Uint8Array(24);
mockPng.set([137, 80, 78, 71, 13, 10, 26, 10]);
new DataView(mockPng.buffer).setUint32(16, 84);
new DataView(mockPng.buffer).setUint32(20, 112);
const mockFiles = new Map<string, Uint8Array>(),
  mockHeaders = new Map<string, string>();
let mockDefaults = ['/docs/default.jpg'];
jest.mock('@dr.pogodin/react-native-fs', () => ({
  stat: jest.fn(async (path: string) => {
    const bytes = mockFiles.get(path);
    if (!bytes) throw new Error('ENOENT');
    return { size: bytes.byteLength, mtime: new Date(1), isFile: () => true };
  }),
  readFile: jest.fn(async (path: string) =>
    jest
      .requireActual('node:buffer')
      .Buffer.from(mockFiles.get(path))
      .toString('base64'),
  ),
}));
jest.mock('react-native-quick-base64', () => ({
  toByteArray: (value: string) =>
    new Uint8Array(
      jest.requireActual('node:buffer').Buffer.from(value, 'base64'),
    ),
  fromByteArray: (value: Uint8Array) =>
    jest.requireActual('node:buffer').Buffer.from(value).toString('base64'),
}));
jest.mock('../src/data/storage', () => ({
  appStorage: {
    getString: (key: string) => mockHeaders.get(key),
    set: jest.fn(),
  },
}));
jest.mock('../src/data/sources', () => ({
  loadSources: async () => [
    {
      bookSourceUrl: 'https://source.test',
      bookSourceName: 'S',
      bookSourceType: 0,
      header: '{"X-Source":"source-only"}',
      enabledCookieJar: true,
    },
  ],
}));
jest.mock('../src/core/coverThumbnail', () => ({
  ...jest.requireActual('../src/core/coverThumbnail'),
  defaultCoverSources: () => mockDefaults,
  coverThumbnail: jest.fn(
    async (_key: string, load: (signal: AbortSignal) => Promise<unknown>) => {
      await load(new AbortController().signal);
      return jest
        .requireActual('node:buffer')
        .Buffer.from(mockPng)
        .toString('base64');
    },
  ),
}));
import { readFile, stat } from '@dr.pogodin/react-native-fs';
import { coverThumbnail } from '../src/core/coverThumbnail';
import { requestedWebCover, webBookCover } from '../src/services/webBookCover';
import type { Book } from '../src/types';
const book: Book = {
  id: 'b',
  bookUrl: 'https://source.test/book',
  origin: 'https://source.test',
  name: 'Book',
  author: 'Author',
  intro: '',
  chapterTitle: '',
  content: '',
  progress: 0.35,
  updatedAt: 1,
  coverUrl: 'https://source.test/source.png',
  customCoverUrl: 'https://other.test/custom.png',
  persistedCoverUrl: '/docs/covers/saved.cover',
};
const url = (query: string) => new URL('http://127.0.0.1:1122/cover?' + query);
const original = globalThis.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  mockFiles.clear();
  mockHeaders.clear();
  mockDefaults = ['/docs/default.jpg'];
  mockFiles.set('/docs/default.jpg', new Uint8Array([255, 216, 255, 1]));
  mockFiles.set(book.persistedCoverUrl!, mockPng);
  globalThis.fetch = jest.fn(
    async () =>
      ({
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => mockPng.buffer,
      }) as unknown as Response,
  );
});
afterAll(() => {
  globalThis.fetch = original;
});
test('serves the persisted layer as a binary 84×112 PNG without making a network request', async () => {
  const response = await webBookCover(url('id=b'), [book]);
  expect(response.statusCode).toBe(200);
  expect(response.headers?.['content-type']).toBe('image/png');
  expect(response.body).toBeInstanceOf(ArrayBuffer);
  expect(new Uint8Array(response.body as ArrayBuffer)).toEqual(mockPng);
  expect(readFile).toHaveBeenCalledWith(book.persistedCoverUrl, 'base64');
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
test('accepts legacy path-only and encoded file URI requests only when a book references the image', async () => {
  const path = '/docs/covers/name with space.cover',
    value = { ...book, persistedCoverUrl: path };
  mockFiles.set(path, mockPng);
  await webBookCover(
    url(
      'path=' +
        encodeURIComponent('file:///docs/covers/name%20with%20space.cover'),
    ),
    [value],
  );
  expect(readFile).toHaveBeenCalledWith(path, 'base64');
  expect(
    requestedWebCover(url('id=wrong&path=' + encodeURIComponent(path)), [value])
      ?.owner?.id,
  ).toBe('b');
});
test('does not read arbitrary files, or files bound to a different explicitly selected book', async () => {
  await webBookCover(
    url('path=' + encodeURIComponent('file:///private/secret')),
    [book],
  );
  expect(stat).not.toHaveBeenCalledWith('/private/secret');
  expect(readFile).toHaveBeenCalledWith('/docs/default.jpg', 'base64');
  expect(
    requestedWebCover(
      url('id=b&path=' + encodeURIComponent('/docs/other.cover')),
      [book],
    ),
  ).toBeUndefined();
});
test('missing selected image falls back to the configured default without discarding its saved layer', async () => {
  mockFiles.delete(book.persistedCoverUrl!);
  expect((await webBookCover(url('id=b'), [book])).statusCode).toBe(200);
  expect(readFile).toHaveBeenCalledWith('/docs/default.jpg', 'base64');
  expect(book.persistedCoverUrl).toBe('/docs/covers/saved.cover');
});
test('wrong bitmap bytes and failed custom defaults continue to the next default candidate', async () => {
  mockFiles.set(
    book.persistedCoverUrl!,
    new Uint8Array([60, 104, 116, 109, 108]),
  );
  mockDefaults = ['/missing/default.jpg', '/docs/default.jpg'];
  expect((await webBookCover(url('id=b'), [book])).statusCode).toBe(200);
  expect(readFile).toHaveBeenCalledWith('/docs/default.jpg', 'base64');
});
test('cross-origin custom covers do not inherit source credentials', async () => {
  mockHeaders.set(
    'source-cookie.v1.https%3A%2F%2Fsource.test',
    '{"session":"source-cookie"}',
  );
  await webBookCover(url('id=b'), [{ ...book, persistedCoverUrl: undefined }]);
  const headers = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers;
  expect(headers['X-Source']).toBeUndefined();
  expect(headers.Cookie).toBeUndefined();
});
test('native source images and same-origin custom covers retain source headers and isolated cookies', async () => {
  mockHeaders.set(
    'source-cookie.v1.https%3A%2F%2Fsource.test',
    '{"session":"source-cookie"}',
  );
  await webBookCover(url('id=b'), [
    { ...book, persistedCoverUrl: undefined, customCoverUrl: undefined },
  ]);
  expect(globalThis.fetch).toHaveBeenCalledWith(
    book.coverUrl,
    expect.objectContaining({
      headers: expect.objectContaining({
        'X-Source': 'source-only',
        Cookie: 'session=source-cookie',
      }),
    }),
  );
});
test('explicit unbound remote image requests do not acquire a selected book’s credentials', async () => {
  await webBookCover(
    url('id=b&path=' + encodeURIComponent('https://unknown.test/a.png')),
    [book],
  );
  expect(
    (globalThis.fetch as jest.Mock).mock.calls[0][1].headers['X-Source'],
  ).toBeUndefined();
});
test('supports a base64 bitmap path and reports a visible error only if every candidate fails', async () => {
  const uri =
    'data:image/png;base64,' + BufferValue.from(mockPng).toString('base64');
  expect(
    (await webBookCover(url('path=' + encodeURIComponent(uri)), [])).statusCode,
  ).toBe(200);
  mockDefaults = [];
  expect(
    (await webBookCover(url('path=file%3A%2F%2F%2Fsecret'), [])).statusCode,
  ).toBe(502);
  expect(coverThumbnail).toHaveBeenCalled();
});

test('a cover failure uses the current default even if it changed while the original was loading', async () => {
  mockDefaults = ['/old/default.jpg'];
  (stat as jest.Mock).mockImplementationOnce(async () => {
    mockDefaults = ['/docs/default.jpg'];
    throw new Error('failed after theme change');
  });
  expect((await webBookCover(url('id=b'), [book])).statusCode).toBe(200);
  expect(readFile).toHaveBeenCalledWith('/docs/default.jpg', 'base64');
});
