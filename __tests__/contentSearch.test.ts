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
  test('uses native case-sensitive literal search', () =>
    expect(
      searchChapters([{ id: 'x', title: 'x', content: 'Aa aa AA' }], 'aa'),
    ).toHaveLength(1));
  test('does not truncate a book at 100 results', () => {
    expect(searchChapters([{ id: 'x', title: 'x', content: '甲'.repeat(125) }], '甲')).toHaveLength(125);
  });
  test('uses the native 20-unit excerpt without inserted ellipses', () => {
    const text = '前'.repeat(35) + '甲' + '后'.repeat(35);
    expect(searchChapters([{ id: 'x', title: 'x', content: text }], '甲')[0].excerpt).toBe('前'.repeat(20) + '甲' + '后'.repeat(20));
  });
  test('returns no results for blank query', () =>
    expect(searchChapters(chapters, '   ')).toEqual([]));
});
