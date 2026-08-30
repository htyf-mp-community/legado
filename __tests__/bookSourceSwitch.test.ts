jest.mock('../src/data/storage', () => ({ appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() } }));
import { autoSwitchSourceForChapter, discoverSourceSwitchCandidates, isSourceSwitchMatch, SourceSwitchError, applySourceSwitchCandidate } from '../src/core/bookSourceSwitch';
import type { Book, BookChapter, BookSource, SearchBook } from '../src/types';

const book: Book = { id: 'library-id', name: 'Demo Book', author: 'Author', intro: '', chapterTitle: 'Chapter 2', content: 'saved', bookUrl: 'old-book', origin: 'old-source', originName: 'Old', chapters: [{ id: 'old-1', title: 'Chapter 1', url: 'old-1', content: '' }, { id: 'old-2', title: 'Chapter 2', url: 'old-2', content: '' }], currentChapterIndex: 1, progress: 37, groupIds: ['g'], updatedAt: 1 };
const source = (url: string, enabled = true): BookSource => ({ bookSourceUrl: url, bookSourceName: url, bookSourceType: 0, customOrder: 0, enabled, enabledExplore: true, searchUrl: '/search' });
const candidate = (origin: string, url: string, name = 'Demo Book'): SearchBook => ({ name, author: 'Author', bookUrl: url, origin, originName: origin });

test('matches source titles case-insensitively while rejecting unrelated names', () => {
  expect(isSourceSwitchMatch(' Demo Book ', 'demo book')).toBe(true);
  expect(isSourceSwitchMatch('Demo Book', 'Demo')).toBe(true);
  expect(isSourceSwitchMatch('Demo Book', 'Other')).toBe(false);
});

test('isolates failed sources, ignores disabled sources and deduplicates candidates', async () => {
  const search = jest.fn(async (item: BookSource) => {
    if (item.bookSourceUrl === 'failed') throw new Error('offline');
    return [candidate(item.bookSourceUrl, 'new-book'), candidate(item.bookSourceUrl, 'new-book'), candidate(item.bookSourceUrl, 'unrelated', 'Other')];
  });
  const result = await discoverSourceSwitchCandidates(book, [source('good'), source('failed'), source('disabled', false)], search);
  expect(result).toMatchObject({ failedSources: 1, candidates: [expect.objectContaining({ origin: 'good', bookUrl: 'new-book' })] });
  expect(search).toHaveBeenCalledTimes(2);
});

test('keeps a candidate with the same relative book URL when it belongs to another source', async () => {
  const sameRelativeUrl = candidate('good', 'old-book');
  const result = await discoverSourceSwitchCandidates(
    book,
    [source('good')],
    jest.fn(async () => [sameRelativeUrl]),
  );
  expect(result.candidates).toEqual([sameRelativeUrl]);
});

test('returns a translatable error when the candidate source was removed', async () => {
  await expect(applySourceSwitchCandidate(book, candidate('missing', 'new'), [])).rejects.toEqual(new SourceSwitchError('sourceSwitchSourceRemoved'));
});

test('loads the candidate directory and preserves library identity, groups and matching progress', async () => {
  const next = candidate('good', 'new-book');
  const info = { ...next, intro: undefined, coverUrl: undefined, tocUrl: 'new-toc', latestChapterTitle: undefined };
  const chapters: BookChapter[] = [{ url: 'new-1', title: 'Chapter 1', index: 0, bookUrl: 'new-book', baseUrl: 'new-book', isVolume: false, isVip: false, isPay: false }, { url: 'new-2', title: 'Chapter 2', index: 1, bookUrl: 'new-book', baseUrl: 'new-book', isVolume: false, isVip: false, isPay: false }];
  const switched = await applySourceSwitchCandidate(book, next, [source('good')], async () => info, async () => chapters);
  expect(switched).toMatchObject({ id: 'library-id', groupIds: ['g'], origin: 'good', bookUrl: 'new-book', currentChapterIndex: 1, progress: 37 });
  await expect(applySourceSwitchCandidate(book, next, [source('good')], async () => info, async () => [])).rejects.toMatchObject({ code: 'sourceSwitchEmptyToc' });
});

test('automatic switching validates chapter content and isolates broken candidates', async () => {
  const bad = candidate('bad', 'bad-book'), good = candidate('good', 'good-book');
  const discover = jest.fn(async () => ({ candidates: [bad, good], failedSources: 0 }));
  const apply = jest.fn(async (_book: Book, item: SearchBook) => ({
    ...book,
    origin: item.origin,
    bookUrl: item.bookUrl,
    currentChapterIndex: 1,
    chapters: [
      { id: `${item.origin}-1`, title: 'Chapter 1', url: `${item.origin}-1`, content: '' },
      { id: `${item.origin}-2`, title: 'Chapter 2', url: `${item.origin}-2`, content: '' },
    ],
  }));
  const load = jest.fn(async (_source: BookSource, chapter: BookChapter) => {
    if (chapter.url === 'bad-2') throw new Error('broken');
    return 'working chapter';
  });
  const switched = await autoSwitchSourceForChapter(
    book,
    1,
    [source('bad'), source('good')],
    discover,
    apply,
    load,
  );
  expect(switched).toMatchObject({ origin: 'good', content: 'working chapter', currentChapterIndex: 1 });
  expect(switched.chapters?.[1].content).toBe('working chapter');
  expect(load).toHaveBeenCalledTimes(2);
});

test('automatic switching accepts equivalent decorated author names', async () => {
  const decorated = { ...candidate('good', 'good-book'), author: '作者： Author ' };
  const discover = jest.fn(async () => ({ candidates: [decorated], failedSources: 0 }));
  const apply = jest.fn(async () => ({
    ...book,
    origin: 'good',
    bookUrl: 'good-book',
    currentChapterIndex: 1,
    chapters: [
      { id: 'good-1', title: 'Chapter 1', url: 'good-1', content: '' },
      { id: 'good-2', title: 'Chapter 2', url: 'good-2', content: '' },
    ],
  }));
  const load = jest.fn(async () => 'working chapter');

  const switched = await autoSwitchSourceForChapter(
    book,
    1,
    [source('good')],
    discover,
    apply,
    load,
  );

  expect(switched.content).toBe('working chapter');
  expect(apply).toHaveBeenCalledWith(expect.anything(), decorated, expect.anything());
});
