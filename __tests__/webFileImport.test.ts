jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  downloadFile: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(async () => {}),
}));
jest.mock('react-native-nitro-unzip', () => ({ getUnzip: jest.fn() }));
jest.mock('@react-native-documents/picker', () => ({
  keepLocalCopy: jest.fn(async () => [
    {
      status: 'success',
      localUri: 'file:///documents/legado-txt-retained.txt',
    },
  ]),
}));
jest.mock('../src/core/localBookImport', () => ({
  SUPPORTED_BOOK_FILE: /\.(?:txt|epub|mobi|prc|azw)$/i,
  importSupportedBook: jest.fn(async () => ({ id: 'local:book' })),
}));
jest.mock('../src/core/remoteBookArchive', () => ({
  collectArchiveBookFiles: jest.fn(),
}));
jest.mock('../src/core/sourceRequest', () => ({
  buildSourcePageRequest: jest.fn(),
}));
jest.mock('../src/data/sourceCookies', () => ({
  saveResponseCookies: jest.fn(),
}));
jest.mock('react-native-quick-base64', () => ({
  fromByteArray: jest.fn(() => 'encoded'),
}));
import { downloadFile, unlink, writeFile } from '@dr.pogodin/react-native-fs';
import { buildSourcePageRequest } from '../src/core/sourceRequest';
import { importSupportedBook } from '../src/core/localBookImport';
import {
  prepareWebFile,
  normalizeWebFileName,
} from '../src/core/webFileImport';
import type { BookSource, SearchBook } from '../src/types';

const source = { bookSourceUrl: 'https://source.test' } as BookSource;
const book = { name: '书', author: '作者' } as SearchBook;

test('native type suffix replaces a URL suffix but appends to a fallback book name', () => {
  expect(normalizeWebFileName('download.php', '.epub', true)).toBe(
    'download.epub',
  );
  expect(normalizeWebFileName('书 作者：A.B', 'txt', false)).toBe(
    '书 作者：A.B.txt',
  );
  expect(normalizeWebFileName('book.txt', '../../bad', true)).toBe('book.txt');
});

test('selected file downloads with source headers, imports once, and cleans staging', async () => {
  jest.mocked(buildSourcePageRequest).mockReturnValue({
    url: 'https://source.test/book.txt',
    method: 'GET',
    headers: { Cookie: 'session=1' },
    sourceId: source.bookSourceUrl,
    cookieJar: true,
  });
  jest.mocked(downloadFile).mockReturnValue({
    jobId: 1,
    promise: Promise.resolve({ jobId: 1, statusCode: 200, bytesWritten: 4 }),
  });
  const prepared = await prepareWebFile(
    source,
    book,
    'https://source.test/book.txt',
  );
  expect(downloadFile).toHaveBeenCalledWith(
    expect.objectContaining({ headers: { Cookie: 'session=1' } }),
  );
  expect(prepared.files.map(file => file.name)).toEqual(['book.txt']);
  await expect(
    prepared.importFile(prepared.files[0], []),
  ).resolves.toMatchObject({ id: 'local:book', name: '书', author: '作者' });
  expect(importSupportedBook).toHaveBeenCalledTimes(1);
  expect(importSupportedBook).toHaveBeenCalledWith(
    'file:///documents/legado-txt-retained.txt',
    'book.txt',
    [],
  );
  await prepared.dispose();
  expect(unlink).toHaveBeenCalled();
});

test('HTTP failure cleans staging and never imports a book', async () => {
  jest.mocked(importSupportedBook).mockClear();
  jest.mocked(buildSourcePageRequest).mockReturnValue({
    url: 'https://source.test/book.txt',
    method: 'GET',
    headers: {},
    sourceId: source.bookSourceUrl,
    cookieJar: false,
  });
  jest.mocked(downloadFile).mockReturnValue({
    jobId: 2,
    promise: Promise.resolve({ jobId: 2, statusCode: 403, bytesWritten: 0 }),
  });
  await expect(
    prepareWebFile(source, book, 'https://source.test/book.txt'),
  ).rejects.toThrow('HTTP 403');
  expect(importSupportedBook).not.toHaveBeenCalled();
});

test('POST download sends the source body and retains binary data', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    headers: { forEach: () => {} },
    arrayBuffer: async () => new Uint8Array([0, 255]).buffer,
  })) as unknown as typeof fetch;
  try {
    jest.mocked(buildSourcePageRequest).mockReturnValue({
      url: 'https://source.test/download',
      method: 'POST',
      headers: { Authorization: 'token' },
      body: 'id=1',
      sourceId: source.bookSourceUrl,
      cookieJar: false,
      fileType: 'txt',
    });
    const prepared = await prepareWebFile(
      source,
      book,
      'https://source.test/download',
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://source.test/download',
      expect.objectContaining({
        method: 'POST',
        body: 'id=1',
        headers: { Authorization: 'token' },
      }),
    );
    expect(writeFile).toHaveBeenCalledWith(
      expect.any(String),
      'encoded',
      'base64',
    );
    expect(prepared.files[0].name).toBe('书 作者：作者.txt');
    await prepared.dispose();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ZIP download lists supported entries without importing them until selection', async () => {
  const { getUnzip } = require('react-native-nitro-unzip');
  const { collectArchiveBookFiles } = require('../src/core/remoteBookArchive');
  const files = [
    { path: '/cache/extracted/a.txt', name: 'a.txt', relative: 'a.txt' },
    { path: '/cache/extracted/b.epub', name: 'b.epub', relative: 'b.epub' },
  ];
  jest.mocked(importSupportedBook).mockClear();
  jest.mocked(buildSourcePageRequest).mockReturnValue({
    url: 'https://source.test/books.zip',
    method: 'GET',
    headers: {},
    sourceId: source.bookSourceUrl,
    cookieJar: false,
  });
  jest.mocked(downloadFile).mockReturnValue({
    jobId: 3,
    promise: Promise.resolve({ jobId: 3, statusCode: 200, bytesWritten: 4 }),
  });
  getUnzip.mockReturnValue({
    extract: () => ({ await: async () => ({ success: true }) }),
  });
  collectArchiveBookFiles.mockResolvedValue(files);
  const prepared = await prepareWebFile(
    source,
    book,
    'https://source.test/books.zip',
  );
  expect(prepared.files).toEqual(files);
  expect(importSupportedBook).not.toHaveBeenCalled();
  await prepared.importFile(files[1], []);
  expect(importSupportedBook).toHaveBeenCalledTimes(1);
  expect(importSupportedBook).toHaveBeenCalledWith(
    'file:///documents/legado-txt-retained.txt',
    'b.epub',
    [],
  );
  await prepared.dispose();
});

test('file choices show filenames and inspect headers only when the URL has no usable suffix', async () => {
  const { describeWebFiles } = require('../src/core/webFileImport');
  jest.mocked(buildSourcePageRequest).mockImplementation((_source, value) => ({
    url: value,
    method: 'GET',
    headers: { Cookie: 'session=1' },
    sourceId: source.bookSourceUrl,
    cookieJar: true,
    ...(value.endsWith('/download') ? { fileType: 'epub' } : {}),
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn(async () => ({
    headers: {
      get: (key: string) =>
        key.toLowerCase() === 'content-disposition'
          ? "attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95.txt"
          : null,
    },
  })) as unknown as typeof fetch;
  try {
    const files = await describeWebFiles(source, book, [
      'https://source.test/book.zip',
      'https://source.test/download',
    ]);
    expect(files).toEqual([
      { url: 'https://source.test/book.zip', name: 'book.zip' },
      { url: 'https://source.test/download', name: '测试.epub' },
    ]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://source.test/download',
      expect.objectContaining({
        method: 'HEAD',
        headers: { Cookie: 'session=1' },
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('file choice falls back to the book identity when HEAD cannot resolve a filename', async () => {
  const { describeWebFiles } = require('../src/core/webFileImport');
  jest
    .mocked(buildSourcePageRequest)
    .mockReturnValue({
      url: 'https://source.test/download',
      method: 'GET',
      headers: {},
      sourceId: source.bookSourceUrl,
      cookieJar: false,
      fileType: 'txt',
    });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  try {
    expect(
      await describeWebFiles(source, book, ['https://source.test/download']),
    ).toEqual([
      { url: 'https://source.test/download', name: '书 作者：作者.txt' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
