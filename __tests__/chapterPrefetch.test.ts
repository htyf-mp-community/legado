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

test('retains variables produced while prefetching each chapter', async () => {
  const result = await prefetchUpcomingChapters(book(), 0, 2, 2, async (_chapter, index) =>
    ({ content: `正文${index}`, variable: JSON.stringify({index}) }));
  expect(result.chapters?.slice(1, 3).map(chapter => JSON.parse(chapter.variable!).index)).toEqual([1, 2]);
});

test('merges independent book-variable writes in chapter order despite concurrent completion', async () => {
  const initial = {...book(), variable:'{"shared":"original","keep":"yes"}'};
  const result = await prefetchUpcomingChapters(initial, 0, 2, 2, async (_chapter, index) => {
    if (index === 1) await new Promise(resolve => setTimeout(resolve, 20));
    return { content: `正文${index}`, bookVariable: index === 1
      ? '{"shared":"first","keep":"yes","first":"1"}'
      : '{"shared":"second","keep":"yes","second":"2"}' };
  });
  expect(JSON.parse(result.variable!)).toEqual({shared:'second',keep:'yes',first:'1',second:'2'});
  expect(JSON.parse(initial.variable)).toEqual({shared:'original',keep:'yes'});
});
