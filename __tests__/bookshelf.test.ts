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
  moveBookGroup,
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
  test('preserves source group names and allocates distinct IDs even for duplicate names', () => {
    const groups = createBookGroup('收藏', []);
    saveBookGroups(groups);
    expect(
      loadBookGroups().find(group => group.id === groups[0].id)?.name,
    ).toBe('收藏');
    const duplicate = createBookGroup('收藏', groups);
    expect(duplicate.map(group => group.id)).toEqual(['1', '2']);
    expect(() => createBookGroup('', groups)).toThrow('不能为空');
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
  test('moving a group across several rows preserves the order of the other groups', () => {
    const groups = ['a', 'b', 'c', 'd'].map((id, order) => ({
      id,
      name: id,
      order,
      show: true,
      enableRefresh: true,
    }));
    const moved = moveBookGroup(groups, 'a', 3);
    expect(moved.map(group => group.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveBookGroup(moved, 'a', -2).map(group => group.id)).toEqual([
      'b',
      'a',
      'c',
      'd',
    ]);
    expect(groups.map(group => group.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  test('persists an independent Android-compatible sort mode for each group', () => {
    expect(loadBookGroupSort('g')).toBe(0);
    saveBookGroupSort('g', 4);
    saveBookGroupSort('other', 2);
    expect(loadBookGroupSort('g')).toBe(4);
    expect(loadBookGroupSort('other')).toBe(2);
  });
});

test('sort inheritance, builtin edits and author sorting survive persistence', () => {
  saveBookGroups([
    {
      id: '-1',
      name: '我的全部',
      order: -10,
      show: false,
      enableRefresh: false,
      bookSort: -1,
    },
  ]);
  expect(loadBookGroups().find(group => group.id === '-1')).toMatchObject({
    name: '我的全部',
    show: false,
    enableRefresh: false,
  });
  saveBookGroupSort('all', 5);
  expect(loadBookGroupSort('-1')).toBe(5);
});
test('new custom IDs avoid occupied native bits beyond 32 bits and enforce the source 63-group limit', () => {
  const groups = Array.from({ length: 63 }, (_, index) => ({
    id: String(1n << BigInt(index)),
    name: String(index),
    order: index,
    show: true,
    enableRefresh: true,
  }));
  expect(createBookGroup('next', groups.slice(0, 40)).at(-1)?.id).toBe(
    String(1n << 40n),
  );
  expect(() => createBookGroup('full', groups)).toThrow('63');
});
