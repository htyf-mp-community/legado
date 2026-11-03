const mockValues = new Map<string, string | number | boolean>();
const mockHttpLog = jest.fn();
jest.mock('../src/data/storage', () => ({
  APP_STORAGE_ID: 'io.legado.htyf.application-storage',
  SENSITIVE_STORAGE_KEYS: new Set([
    'backup.local-password.v1',
    'reading.record-device.v1',
  ]),
  ENCRYPTED_BACKUP_KEY_PREFIXES: ['source-cookie.v1.'],
  appStorage: {
    getAllKeys: () => [...mockValues.keys()],
    getString: (key: string) =>
      typeof mockValues.get(key) === 'string' ? mockValues.get(key) : undefined,
    getNumber: (key: string) =>
      typeof mockValues.get(key) === 'number' ? mockValues.get(key) : undefined,
    getBoolean: (key: string) =>
      typeof mockValues.get(key) === 'boolean'
        ? mockValues.get(key)
        : undefined,
    set: (key: string, value: string | number | boolean) =>
      mockValues.set(key, value),
    clearAll: () => mockValues.clear(),
  },
}));
jest.mock('react-native-quick-crypto', () => require('node:crypto'));
jest.mock('../src/data/generalPreferences', () => ({
  loadGeneralPreferences: () => ({ userAgent: 'default-UA' }),
}));
jest.mock('../src/data/httpLog', () => ({
  addHttpLog: (...args: unknown[]) => mockHttpLog(...args),
}));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
import { appStorage, APP_STORAGE_ID } from '../src/data/storage';
import { createBackup, restoreBackup } from '../src/data/backup';
import {
  buildSourceRequest,
  executeSourceRequest,
} from '../src/core/sourceRequest';
import { fetchRssFeedPage, fetchRssArticleContent } from '../src/core/rss';
import { searchBookCover } from '../src/core/coverRule';
import type { BookSource } from '../src/types';

const source: BookSource = {
  bookSourceUrl: 'https://example.invalid',
  bookSourceName: 'fixture',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
};
const cacheKey = 'legacy.runtime-source-cache.v1';
const row = (
  key: string,
  value: string | null,
  deadline: number | string = 0,
) => ({ key, value, deadline });
function restore(rows: ReturnType<typeof row>[]) {
  restoreBackup(
    JSON.stringify({
      format: 'legado-htyf-backup',
      version: 1,
      createdAt: 1,
      storageId: APP_STORAGE_ID,
      entries: { [cacheKey]: { type: 'string', value: JSON.stringify(rows) } },
    }),
    appStorage,
    '',
    {},
  );
}
beforeEach(() => {
  mockValues.clear();
  mockHttpLog.mockReset();
  jest.spyOn(Date, 'now').mockReturnValue(1000);
});
afterEach(() => jest.restoreAllMocks());

test('restored login headers are used for that source and options override them', () => {
  restore([
    row(
      'loginHeader_https://example.invalid',
      '{"Authorization":"Bearer public-fixture","X-Mode":"login","User-Agent":"login-UA"}',
    ),
    row('loginHeader_https://other.invalid', '{"Authorization":"different"}'),
  ]);
  const request = buildSourceRequest(
    { ...source, header: '{"X-Mode":"base","X-Base":"yes"}' },
    '/search,{"headers":{"X-Mode":"option"}}',
  );
  expect(request.headers).toMatchObject({
    Authorization: 'Bearer public-fixture',
    'X-Mode': 'option',
    'X-Base': 'yes',
    'User-Agent': 'login-UA',
  });
  expect(
    buildSourceRequest(
      { ...source, bookSourceUrl: 'https://missing.invalid' },
      '/search',
    ).headers.Authorization,
  ).toBeUndefined();
});

test('expired, null and malformed restored values do not contribute headers', () => {
  for (const entry of [
    row('loginHeader_https://example.invalid', '{"X-Fixture":"bad"}', 1000),
    row('loginHeader_https://example.invalid', null),
    row('loginHeader_https://example.invalid', 'not json'),
  ]) {
    mockValues.clear();
    restore([entry]);
    expect(
      buildSourceRequest(source, '/search').headers['X-Fixture'],
    ).toBeUndefined();
  }
  mockValues.clear();
  restore([
    row(
      'loginHeader_https://example.invalid',
      '{"X-Fixture":"ok"}',
      '9223372036854775807',
    ),
  ]);
  expect(buildSourceRequest(source, '/search').headers['X-Fixture']).toBe('ok');
});

test('login header values are redacted in request diagnostics even for arbitrary header names', async () => {
  restore([
    row(
      'loginHeader_https://example.invalid',
      '{"X-Custom":"public-fixture-secret"}',
    ),
  ]);
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    url: 'https://example.invalid/search',
    headers: { get: () => null, forEach: () => {} },
    text: async () => 'ok',
  } as unknown as Response);
  await executeSourceRequest(buildSourceRequest(source, '/search'));
  expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
    'X-Custom': 'public-fixture-secret',
  });
  expect(mockHttpLog).toHaveBeenCalled();
  expect(JSON.stringify(mockHttpLog.mock.calls)).not.toContain(
    'public-fixture-secret',
  );
});

test('an encrypted HTYF backup restores login headers into actual requests', () => {
  mockValues.set(
    cacheKey,
    JSON.stringify([
      row(
        'loginHeader_https://example.invalid',
        '{"X-Custom":"public-fixture-secret"}',
      ),
    ]),
  );
  mockValues.set(
    'backup.preferences.v1',
    JSON.stringify({ categories: { sourceVariables: true } }),
  );
  const archive = createBackup(appStorage, 'fixture-password');
  expect(archive).not.toContain('public-fixture-secret');
  mockValues.clear();
  restoreBackup(archive, appStorage, 'fixture-password', {});
  expect(buildSourceRequest(source, '/search').headers['X-Custom']).toBe(
    'public-fixture-secret',
  );
});

test('native Gson string conversion accepts structured and primitive header values', () => {
  restore([
    row(
      'loginHeader_https://example.invalid',
      "{'X-Number':123,'X-Boolean':true,'X-Array':[1,'x'],'X-Object':{'x':2}}",
    ),
  ]);
  expect(buildSourceRequest(source, '/search').headers).toMatchObject({
    'X-Number': '123',
    'X-Boolean': 'true',
    'X-Array': '[1,"x"]',
    'X-Object': '{"x":2}',
  });
});

test('failed requests also redact restored headers after differently cased overrides', async () => {
  restore([
    row(
      'loginHeader_https://example.invalid',
      '{"X-Private":"fixture-secret"}',
    ),
  ]);
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
  const request = buildSourceRequest(
    source,
    '/search,{"headers":{"x-private":"fixture-override"}}',
  );
  await expect(executeSourceRequest(request)).rejects.toThrow('offline');
  const logged = JSON.stringify(mockHttpLog.mock.calls);
  expect(logged).not.toContain('fixture-secret');
  expect(logged).not.toContain('fixture-override');
});

test('RSS feed and article requests do not attach restored login headers', async () => {
  restore([
    row(
      'loginHeader_https://example.invalid',
      '{"X-Private":"fixture-secret"}',
    ),
  ]);
  const rss = {
    sourceUrl: source.bookSourceUrl,
    sourceName: 'fixture',
    enabled: true,
    customOrder: 0,
    ruleContent: '$.body',
    header: '{"X-Base":"yes"}',
  };
  const fetcher = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.invalid/page',
      text: async () => '{"body":"text","items":[]}',
    });
  await fetchRssFeedPage(rss, { url: '/feed' }, fetcher);
  await fetchRssArticleContent(
    {
      id: '1',
      origin: rss.sourceUrl,
      sort: '',
      title: '',
      link: 'https://example.invalid/article',
      read: false,
      starred: false,
    },
    rss,
    fetcher,
  );
  for (const [, options] of fetcher.mock.calls) {
    expect(options.headers['X-Private']).toBeUndefined();
    expect(options.headers['X-Base']).toBe('yes');
  }
});

test('cover search does not attach restored login headers', async () => {
  restore([
    row(
      'loginHeader_https://example.invalid/search',
      '{"X-Private":"fixture-secret"}',
    ),
  ]);
  const fetcher = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.invalid/search',
      headers: { get: () => null, forEach: () => {} },
      text: async () => '{"cover":"/x.png"}',
    } as unknown as Response);
  await searchBookCover(
    {
      id: '1',
      name: 'fixture',
      author: '',
      intro: '',
      chapterTitle: '',
      content: '',
      progress: 0,
      updatedAt: 0,
    },
    {
      enable: true,
      searchUrl: 'https://example.invalid/search',
      coverRule: '$.cover',
      enabledCookieJar: false,
    },
  );
  expect(fetcher.mock.calls[0][1]?.headers).not.toHaveProperty('X-Private');
});
