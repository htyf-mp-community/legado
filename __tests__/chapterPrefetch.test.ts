import { prefetchUpcomingChapters } from '../src/core/chapterPrefetch';
import type { Book } from '../src/types';

const book = (): Book => ({
  id: 'book', name: 'Book', author: '', intro: '', sourceType: 0, chapterTitle: 'One', content: 'one', currentChapterIndex: 0, progress: 0, updatedAt: 1,
  chapters: [0, 1, 2, 3].map(index => ({ id: String(index), title: String(index), url: `https://example.com/${index}`, content: index === 0 ? 'zero' : '' })),
});

test('prefetches only the configured upcoming window', async () => {
  const loaded: number[] = [];
  const result = await prefetchUpcomingChapters(book(), 0, 2, 1, async (_chapter, index) => { loaded.push(index); return `content-${index}`; });
  expect(loaded).toEqual([1, 2]);
  expect(result.chapters?.map(chapter => chapter.content)).toEqual(['zero', 'content-1', 'content-2', '']);
});

test('keeps successful prefetches when another chapter fails', async () => {
  const result = await prefetchUpcomingChapters(book(), 0, 3, 2, async (_chapter, index) => {
    if (index === 2) throw new Error('failed');
    return `content-${index}`;
  });
  expect(result.chapters?.[1].content).toBe('content-1');
  expect(result.chapters?.[2].content).toBe('');
  expect(result.chapters?.[3].content).toBe('content-3');
});
