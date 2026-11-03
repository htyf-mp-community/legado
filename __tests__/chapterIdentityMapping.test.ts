import { mapRemoteChapters } from '../src/core/chapterIdentity';
import { toLibraryBook } from '../src/core/onlineLibrary';
import { refreshReaderToc } from '../src/core/readerRefresh';
import { mergeRefreshedChapters as mergeShelf } from '../src/core/bookshelfRefresh';
import { mergeRefreshedChapters as mergeCache } from '../src/core/bookCache';
import { applyBookUpdate } from '../src/core/bookUpdate';
import type { BookChapter, BookSource, LocalChapter, SearchBook } from '../src/types';

jest.mock('../src/data/storage', () => ({ appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() } }));

const chapter = (sourceUrl: string, title: string): BookChapter => ({
  sourceUrl, url: 'https://example.com/1', title, index: 0,
  baseUrl: 'https://example.com/toc', bookUrl: 'https://example.com/book',
  isVolume: false, isVip: false, isPay: false,
});

test('preserves distinct source identities and their cached content after reorder', () => {
  const remote = [chapter('/1', '相对'), chapter('https://example.com/1', '绝对')];
  const first = mapRemoteChapters(remote, 'book').map((item, index) => ({ ...item, content: `缓存${index}` }));
  expect(new Set(first.map(item => item.id)).size).toBe(2);
  const reordered = mapRemoteChapters([...remote].reverse(), 'book', first);
  expect(reordered.map(item => item.content)).toEqual(['缓存1', '缓存0']);
  expect(reordered.map(item => item.id)).toEqual([first[1].id, first[0].id]);
});

test('retains a legacy cache once when two raw URLs resolve to the same old URL', () => {
  const old: LocalChapter[] = [{ id: 'https://example.com/1', url: 'https://example.com/1', title: '相对', content: '旧缓存' }];
  const next = mapRemoteChapters([chapter('/1', '相对'), chapter('https://example.com/1', '绝对')], 'book', old);
  expect(next.map(item => item.content)).toEqual(['旧缓存', '']);
});

test('library import and reader refresh retain separate chapter identities and reading position', async () => {
  const source: BookSource = { bookSourceUrl: 'https://example.com', bookSourceName: '源', bookSourceType: 0, customOrder: 0, enabled: true, enabledExplore: true };
  const search: SearchBook = { origin: source.bookSourceUrl, originName: source.bookSourceName, bookUrl: 'https://example.com/book', name: '书', author: '' };
  const remote = [chapter('/1', '相对'), chapter('https://example.com/1', '绝对')];
  const initial = toLibraryBook(search, remote);
  expect(new Set(initial.chapters!.map(item => item.id)).size).toBe(2);
  const old = { ...initial, chapters: initial.chapters!.map((item, i) => ({ ...item, content: `缓存${i}` })), currentChapterIndex: 1,
    chapterTitle: '绝对', content: '缓存1', readingPosition: { chapterId: initial.chapters![1].id, position: 12 } };
  const load = jest.fn(async (_source, selected: SearchBook) => {
    expect(selected.reverseToc).toBe(true);
    return [...remote].reverse();
  });
  const updated = await refreshReaderToc({ ...old, reverseToc: true }, source, load);
  expect(updated.chapters?.map(item => item.content)).toEqual(['缓存1', '缓存0']);
  expect(updated.currentChapterIndex).toBe(1);
  expect(updated.readingPosition).toEqual({ chapterId: updated.chapters?.[1].id, position: 12 });
});

test('shelf refresh, cache refresh and concurrent book updates retain distinct chapter content', () => {
  const search: SearchBook = { origin: 'https://example.com', originName: '源', bookUrl: 'https://example.com/book', name: '书', author: '' };
  const remote = [chapter('/1', '相对'), chapter('https://example.com/1', '绝对')];
  const initial = toLibraryBook(search, remote);
  const book = { ...initial, chapters: initial.chapters!.map((item, i) => ({ ...item, content: `缓存${i}` })) };
  expect(mergeShelf(book, [...remote].reverse()).chapters?.map(item => item.content)).toEqual(['缓存1', '缓存0']);
  expect(mergeCache(book, search, [...remote].reverse()).chapters?.map(item => item.content)).toEqual(['缓存1', '缓存0']);
  const edited = { ...book, chapters: book.chapters.map((item, i) => i === 1 ? { ...item, content: '新缓存' } : item) };
  expect(applyBookUpdate(book, book, edited).chapters?.map(item => item.content)).toEqual(['缓存0', '新缓存']);
});
