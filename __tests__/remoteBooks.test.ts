jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  downloadFile: jest.fn(),
  uploadFiles: jest.fn(),
  unlink: jest.fn(),
}));
jest.mock('react-native-quick-base64', () => ({ fromByteArray: () => '' }));
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
import {
  parseWebDavBookList,
  remoteBooksRoot,
  sortRemoteBooks,
  uploadRemoteBookFile,
} from '../src/core/remoteBooks';
import { uploadFiles } from '@dr.pogodin/react-native-fs';
const config = {
  url: 'https://dav.example/',
  directory: 'legado',
  username: '',
  password: '',
};
test('builds the configured books root', () =>
  expect(remoteBooksRoot(config)).toBe('https://dav.example/legado/books/'));
test('parses WebDAV folders and supported books while rejecting unrelated paths and files', () => {
  const xml = `<d:multistatus xmlns:d="DAV:"><d:response><d:href>/legado/books/</d:href></d:response><d:response><d:href>/legado/books/Fiction/</d:href><d:propstat><d:prop><d:displayname>Fiction</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response><d:response><d:href>/legado/books/a.epub</d:href><d:propstat><d:prop><d:displayname>a.epub</d:displayname><d:getcontentlength>123</d:getcontentlength><d:getlastmodified>Wed, 01 Jan 2025 00:00:00 GMT</d:getlastmodified></d:prop></d:propstat></d:response><d:response><d:href>/legado/books/a.exe</d:href><d:prop><d:displayname>a.exe</d:displayname></d:prop></d:response><d:response><d:href>/other/escape.txt</d:href></d:response></d:multistatus>`;
  expect(
    parseWebDavBookList(xml, remoteBooksRoot(config), remoteBooksRoot(config)),
  ).toMatchObject([
    { name: 'Fiction', isDirectory: true },
    { name: 'a.epub', isDirectory: false, size: 123 },
  ]);
});
test('keeps directories first and supports filtering and sort direction', () => {
  const values = [
    {
      name: 'Book 10.txt',
      url: 'b',
      isDirectory: false,
      size: 0,
      modifiedAt: 20,
    },
    { name: 'Folder', url: 'f', isDirectory: true, size: 0, modifiedAt: 1 },
    {
      name: 'Book 2.txt',
      url: 'a',
      isDirectory: false,
      size: 0,
      modifiedAt: 10,
    },
  ];
  expect(sortRemoteBooks(values, 'name', true).map(x => x.name)).toEqual([
    'Folder',
    'Book 2.txt',
    'Book 10.txt',
  ]);
  expect(
    sortRemoteBooks(values, 'modified', false, 'book').map(x => x.name),
  ).toEqual(['Book 10.txt', 'Book 2.txt']);
});
test('uploads an exported book with binary PUT into the WebDAV books directory', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn().mockResolvedValue({ status: 405 }) as typeof fetch;
  (uploadFiles as jest.Mock).mockReturnValue({
    promise: Promise.resolve({ statusCode: 201 }),
  });
  await expect(
    uploadRemoteBookFile(
      config,
      '/cache/book.epub',
      'Book?.epub',
      'application/epub+zip',
    ),
  ).resolves.toMatchObject({ statusCode: 201 });
  expect(uploadFiles).toHaveBeenCalledWith(
    expect.objectContaining({
      toUrl: 'https://dav.example/legado/books/Book_.epub',
      method: 'PUT',
      binaryStreamOnly: true,
      files: [expect.objectContaining({ filepath: '/cache/book.epub' })],
    }),
  );
  globalThis.fetch = originalFetch;
});
jest.mock('react-native-quick-crypto', () => ({
  createHash: jest.fn(),
  createCipheriv: jest.fn(),
  createDecipheriv: jest.fn(),
}));
