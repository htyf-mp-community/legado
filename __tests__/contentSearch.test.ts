import { searchChapters } from '../src/core/contentSearch';
const chapters = [
  { id: '1', title: '一', content: '天地玄黄，宇宙洪荒。天地之间。' },
  { id: '2', title: '二', content: '没有匹配。' },
];
describe('book content search', () => {
  test('finds every occurrence with positions', () => {
    const results = searchChapters(chapters, '天地');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      chapterIndex: 0,
      chapterId: '1',
      start: 0,
      end: 2,
      match: '天地',
    });
  });
  test('is case insensitive and supports limits', () =>
    expect(
      searchChapters([{ id: 'x', title: 'x', content: 'Aa aa AA' }], 'aa', 2),
    ).toHaveLength(2));
  test('returns no results for blank query', () =>
    expect(searchChapters(chapters, '   ')).toEqual([]));
});
