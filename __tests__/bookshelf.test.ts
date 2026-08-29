const mockValues = new Map<string, string | number>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) =>
      typeof mockValues.get(key) === 'string' ? mockValues.get(key) : undefined,
    getNumber: (key: string) =>
      typeof mockValues.get(key) === 'number' ? mockValues.get(key) : undefined,
    set: (key: string, value: string | number) => mockValues.set(key, value),
  }),
}));
import {
  assignBooksToGroup,
  createBookGroup,
  loadBookGroups,
  loadBookGroupSort,
  removeGroup,
  saveBookGroups,
  saveBookGroupSort,
} from '../src/data/bookshelf';
import type { Book } from '../src/types';
const book = {
  id: 'b',
  name: 'B',
  author: 'A',
  intro: '',
  chapterTitle: 'C',
  content: '',
  progress: 0,
  updatedAt: 0,
} as Book;
describe('bookshelf groups', () => {
  beforeEach(() => mockValues.clear());
  test('creates unique groups and persists them', () => {
    const groups = createBookGroup('收藏', []);
    saveBookGroups(groups);
    expect(loadBookGroups()[0].name).toBe('收藏');
    expect(() => createBookGroup('收藏', groups)).toThrow('存在');
  });
  test('assigns multiple groups without duplicates', () => {
    const first = assignBooksToGroup([book], new Set(['b']), 'g'),
      second = assignBooksToGroup(first, new Set(['b']), 'g');
    expect(second[0].groupIds).toEqual(['g']);
  });
  test('removing a group clears book references', () => {
    const result = removeGroup(
      [{ ...book, groupIds: ['g', 'x'] }],
      [{ id: 'g', name: 'G', order: 0, show: true, enableRefresh: true }],
      'g',
    );
    expect(result.books[0].groupIds).toEqual(['x']);
    expect(result.groups).toEqual([]);
  });
  test('persists an independent Android-compatible sort mode for each group', () => {
    expect(loadBookGroupSort('g')).toBe(0);
    saveBookGroupSort('g', 4);
    saveBookGroupSort('other', 2);
    expect(loadBookGroupSort('g')).toBe(4);
    expect(loadBookGroupSort('other')).toBe(2);
  });
});
