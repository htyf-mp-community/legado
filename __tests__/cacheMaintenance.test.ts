jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ trim: jest.fn() }) }));
jest.mock('@dr.pogodin/react-native-fs', () => ({ CachesDirectoryPath: '/cache', exists: jest.fn(), readDir: jest.fn(), unlink: jest.fn() }));
import { cacheStats, clearApplicationCache, clearExpiredApplicationCache } from '../src/core/cacheMaintenance';

const file = (path: string, size: number) => ({ path, size, isFile: () => true, isDirectory: () => false });
const dir = (path: string) => ({ path, size: 0, isFile: () => false, isDirectory: () => true });

test('counts nested cache bytes and deletes only direct root children', async () => {
  const deleted: string[] = [];
  const fs = {
    exists: async () => true,
    readDir: async (path: string) => path === '/cache' ? [file('/cache/a.tmp', 3), dir('/cache/images')] : [file('/cache/images/1.jpg', 7)],
    unlink: async (path: string) => { deleted.push(path); },
  };
  await expect(cacheStats(fs, '/cache')).resolves.toEqual({ bytes: 10, entries: 2 });
  await expect(clearApplicationCache(fs, '/cache')).resolves.toEqual({ bytes: 10, entries: 2 });
  expect(deleted).toEqual(['/cache/a.tmp', '/cache/images']);
});

test('refuses an unexpected path outside the app cache root', async () => {
  const fs = { exists: async () => true, readDir: async () => [file('/documents/book.txt', 3)], unlink: jest.fn(async () => undefined) };
  await expect(clearApplicationCache(fs, '/cache')).rejects.toThrow('越界');
  expect(fs.unlink).not.toHaveBeenCalled();
});

test('startup expiry removes only old direct cache entries',async()=>{const deleted:string[]=[],fs={exists:async()=>true,readDir:async()=>[{...file('/cache/old.tmp',1),mtime:new Date(1000)},{...file('/cache/new.tmp',1),mtime:new Date(9000)}],unlink:async(path:string)=>{deleted.push(path)}};await expect(clearExpiredApplicationCache(5000,10000,fs,'/cache')).resolves.toEqual({entries:1});expect(deleted).toEqual(['/cache/old.tmp'])});
