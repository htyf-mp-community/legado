const mockExists = jest.fn();
const mockMkdir = jest.fn();
const mockDownload = jest.fn();
const mockCopy = jest.fn();
const mockReadDir = jest.fn();
const mockUnlink = jest.fn();
jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  DocumentDirectoryPath: '/docs',
  copyFile: (...args: unknown[]) => mockCopy(...args),
  exists: (...args: unknown[]) => mockExists(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  downloadFile: (...args: unknown[]) => mockDownload(...args),
  readDir: (...args: unknown[]) => mockReadDir(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));
import {
  cacheMangaImage,
  mangaCachePath,
  pruneMangaCache,
  saveMangaImage,
  stableCacheKey,
} from '../src/core/mangaCache';
describe('manga disk cache', () => {
  it('builds stable app-scoped paths', () => {
    expect(stableCacheKey('abc')).toBe(stableCacheKey('abc'));
    expect(mangaCachePath('book', 'https://x/a.jpg')).toMatch(
      /^\/cache\/legado-manga\/.+\.jpg$/,
    );
  });
  it('downloads once and reuses the cached file', async () => {
    mockExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockDownload.mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    });
    const first = await cacheMangaImage('b', 'https://x/a.jpg', {
      Referer: 'x',
    });
    expect(first).toMatch(/^file:\/\//);
    expect(mockMkdir).toHaveBeenCalled();
    await cacheMangaImage('b', 'https://x/a.jpg');
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });
  it('saves a long-pressed page into the app document directory', async () => {
    mockExists.mockResolvedValueOnce(true);
    mockCopy.mockResolvedValue(undefined);
    await expect(
      saveMangaImage('book', 'https://x/page.webp', 2),
    ).resolves.toMatch(/^\/docs\/LegadoManga\/.+-0003\.webp$/);
    expect(mockCopy).toHaveBeenCalledWith(
      expect.stringMatching(/^\/cache\/legado-manga\//),
      expect.stringMatching(/^\/docs\/LegadoManga\//),
    );
  });
  it('prunes images outside retained manga chapters', async () => {
    const kept = `/${stableCacheKey('https://x/keep.jpg')}.jpg`,
      removed = '/obsolete.jpg';
    mockExists.mockResolvedValueOnce(true);
    mockReadDir.mockResolvedValueOnce([
      { name: kept.slice(1), path: `/cache${kept}`, isFile: () => true },
      { name: removed.slice(1), path: `/cache${removed}`, isFile: () => true },
    ]);
    await expect(
      pruneMangaCache('book', ['https://x/keep.jpg']),
    ).resolves.toEqual({ removed: 1, retained: 1 });
    expect(mockUnlink).toHaveBeenCalledWith('/cache/obsolete.jpg');
  });
});
