jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  readDir: jest.fn(),
  unlink: jest.fn(),
}));
jest.mock('react-native-nitro-unzip', () => ({ getUnzip: jest.fn() }));
jest.mock('../src/core/localBookImport', () => ({
  SUPPORTED_BOOK_FILE: /\.(?:txt|epub|mobi|prc|azw)$/i,
  importSupportedBook: jest.fn(),
}));
import { collectArchiveBookFiles } from '../src/core/remoteBookArchive';

const file = (path: string, name: string, size: number, dir = false) => ({
  path,
  name,
  size,
  isDirectory: () => dir,
  isFile: () => !dir,
});
test('walks nested ZIP output and keeps only supported ebooks', async () => {
  const reader = jest.fn(async (path: string) =>
    path === '/root'
      ? [
          file('/root/sub', 'sub', 0, true),
          file('/root/a.txt', 'a.txt', 10),
          file('/root/no.exe', 'no.exe', 2),
        ]
      : [file('/root/sub/b.epub', 'b.epub', 20)],
  );
  await expect(
    collectArchiveBookFiles('/root', reader as never),
  ).resolves.toEqual([
    { path: '/root/a.txt', name: 'a.txt', relative: 'a.txt' },
    { path: '/root/sub/b.epub', name: 'b.epub', relative: 'sub/b.epub' },
  ]);
});
test('rejects archives with excessive directory depth', async () => {
  const reader = jest.fn(async (path: string) => [
    file(`${path}/x`, 'x', 0, true),
  ]);
  await expect(
    collectArchiveBookFiles('/root', reader as never),
  ).rejects.toThrow('nesting');
});
