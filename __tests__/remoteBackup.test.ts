jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
jest.mock('react-native-quick-base64', () => ({
  fromByteArray: () => 'dXNlcjpwYXNz',
}));

import { createBackup } from '../src/data/backup';
import {
  downloadWebDavBackup,
  normalizeWebDavConfig,
  uploadWebDavBackup,
  uploadWebDavBookProgress,
  downloadWebDavBookProgress,
  webDavBookProgressUrl,
  webDavBackupUrl,
  parseWebDavBackupList,
} from '../src/data/remoteBackup';

const config = {
  url: 'https://dav.example.com/root',
  username: 'user',
  password: 'pass',
  directory: 'legado/手机',
};
const validBackup = createBackup({
  getAllKeys: () => [],
  getString: () => undefined,
  getNumber: () => undefined,
  getBoolean: () => undefined,
  set: () => {},
  clearAll: () => {},
});

test('normalizes and safely encodes the remote backup URL', () => {
  expect(normalizeWebDavConfig(config)).toMatchObject({
    url: 'https://dav.example.com/root/',
    directory: 'legado/手机',
  });
  expect(webDavBackupUrl(config)).toBe(
    'https://dav.example.com/root/legado/%E6%89%8B%E6%9C%BA/backup-htyf.json',
  );
});

test('creates nested WebDAV directories then uploads a validated backup', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({ status: 201 })
    .mockResolvedValueOnce({ status: 405 })
    .mockResolvedValueOnce({ ok: true, status: 201 });
  globalThis.fetch = fetchMock as typeof fetch;
  await uploadWebDavBackup(config, validBackup);
  expect(fetchMock.mock.calls.map(call => call[1]?.method)).toEqual([
    'MKCOL',
    'MKCOL',
    'PUT',
  ]);
  expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
    'Basic dXNlcjpwYXNz',
  );
});

test('uploads an encoded dated device backup and parses WebDAV history safely',async()=>{const fetchMock=jest.fn().mockResolvedValueOnce({status:201}).mockResolvedValueOnce({status:405}).mockResolvedValueOnce({ok:true,status:201});globalThis.fetch=fetchMock as typeof fetch;await uploadWebDavBackup(config,validBackup,'backup2026-08-29-我的设备.json');expect(fetchMock.mock.calls[2][0]).toContain('backup2026-08-29-%E6%88%91%E7%9A%84%E8%AE%BE%E5%A4%87.json');const root='https://dav.example.com/root/legado/',xml=`<d:multistatus xmlns:d="DAV:"><d:response><d:href>/root/legado/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response><d:response><d:href>/root/legado/backup2026-08-29-phone.json</d:href><d:propstat><d:prop><d:displayname>backup2026-08-29-phone.json</d:displayname><d:getlastmodified>Sat, 29 Aug 2026 08:00:00 GMT</d:getlastmodified></d:prop></d:propstat></d:response><d:response><d:href>https://evil.test/backup2026-08-30.json</d:href></d:response></d:multistatus>`;expect(parseWebDavBackupList(xml,root)).toEqual([{name:'backup2026-08-29-phone.json',url:'https://dav.example.com/root/legado/backup2026-08-29-phone.json',modifiedAt:Date.parse('Sat, 29 Aug 2026 08:00:00 GMT')}])});

test('validates downloaded backup before returning it', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => validBackup,
  }) as typeof fetch;
  await expect(downloadWebDavBackup(config)).resolves.toBe(validBackup);
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => '{}',
  }) as typeof fetch;
  await expect(downloadWebDavBackup(config)).rejects.toThrow('备份');
});

const book = {
  id: 'book',
  name: '书/名',
  author: '作者',
  intro: '',
  chapterTitle: '第二章',
  content: '',
  chapters: [
    { id: '1', title: '第一章', content: '' },
    { id: '2', title: '第二章', content: '' },
  ],
  currentChapterIndex: 1,
  progress: 1,
  updatedAt: 1,
};

test('uploads Android-compatible per-book WebDAV progress', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({ status: 201 })
    .mockResolvedValueOnce({ status: 405 })
    .mockResolvedValueOnce({ status: 201 })
    .mockResolvedValueOnce({ ok: true, status: 201 });
  globalThis.fetch = fetchMock as typeof fetch;
  await uploadWebDavBookProgress(config, book);
  expect(webDavBookProgressUrl(config, book)).toContain(
    '/bookProgress/%E4%B9%A6_%E5%90%8D_%E4%BD%9C%E8%80%85.json',
  );
  expect(fetchMock.mock.calls.map(call => call[1]?.method)).toEqual([
    'MKCOL',
    'MKCOL',
    'MKCOL',
    'PUT',
  ]);
  const body = JSON.parse(fetchMock.mock.calls[3][1].body);
  expect(body).toMatchObject({ durChapterIndex: 1, durChapterTitle: '第二章' });
});

test('downloads and validates per-book progress without auto-applying it', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      name: book.name,
      author: book.author,
      durChapterIndex: 3,
      durChapterPos: 42,
      durChapterTime: 9,
      durChapterTitle: '第四章',
    }),
  }) as typeof fetch;
  await expect(downloadWebDavBookProgress(config, book)).resolves.toMatchObject(
    { durChapterIndex: 3, durChapterPos: 42 },
  );
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as typeof fetch;
  await expect(downloadWebDavBookProgress(config, book)).resolves.toBeNull();
});
jest.mock('react-native-quick-crypto', () => ({
  createHash: jest.fn(),
  createCipheriv: jest.fn(),
  createDecipheriv: jest.fn(),
}));
