import {
  exportBookList,
  importBookList,
  parseBookList,
  resolveBookListInput,
} from '../src/core/bookList';
import type { Book, BookSource, SearchBook } from '../src/types';
const source = (
  id: string,
  customOrder: number,
  enabled = true,
): BookSource => ({
  bookSourceUrl: id,
  bookSourceName: id,
  customOrder,
  enabled,
  enabledExplore: true,
  bookSourceType: 0,
});
const candidate = (
  name: string,
  author: string,
  origin = 'second',
): SearchBook => ({
  name,
  author,
  origin,
  originName: origin,
  bookUrl: `https://example.com/${name}`,
  intro: 'Source description',
  latestChapterTitle: 'Latest',
});
test('native books.json only contains discovery fields and uses a custom introduction', () => {
  const book: Book = {
    id: 'private',
    name: 'Name',
    author: 'Author',
    intro: 'Original',
    customIntro: 'Custom',
    chapterTitle: 'Secret chapter',
    content: 'Cached body',
    currentChapterIndex: 20,
    groupIds: ['4'],
    progress: 0.5,
    updatedAt: 3,
    bookUrl: 'https://private.example',
  };
  expect(JSON.parse(exportBookList([book]))).toEqual([
    { name: 'Name', author: 'Author', intro: 'Custom' },
  ]);
  expect(exportBookList([book])).not.toContain('Cached body');
  expect(exportBookList([])).toBe('[]');
});
test('native input has no URL requirement, retains exact names/authors and ignores embedded private data', () => {
  expect(
    parseBookList(
      '[{"name":" Name ","author":"A","_htyf":{"name":"Wrong"}},{"name":123},null,{}]',
    ),
  ).toEqual([
    { name: ' Name ', author: 'A', intro: undefined },
    { name: '123', author: '', intro: undefined },
  ]);
  expect(() => parseBookList('{}')).toThrow('格式不对');
});
test('URL input resolves to JSON and detects repeated addresses', async () => {
  const fetchText = jest.fn().mockResolvedValue('[{"name":"Book"}]');
  await expect(
    resolveBookListInput(' https://example.com/books ', fetchText),
  ).resolves.toEqual([{ name: 'Book', author: '', intro: undefined }]);
  await expect(
    resolveBookListInput('https://example.com/loop', async url => url),
  ).rejects.toThrow('循环');
});
test('enabled sources are tried in configured order, with exact author/name matching and a pending catalogue', async () => {
  const search = jest.fn(async (value: BookSource, name: string) =>
    value.bookSourceUrl === 'first'
      ? [
          candidate(name.toLowerCase(), 'A', 'first'),
          candidate(name, 'Wrong author', 'first'),
        ]
      : [candidate(name, 'A')],
  );
  const committed: Book[] = [];
  const result = await importBookList(
    [{ name: 'Name', author: 'A', intro: 'Do not overwrite source info' }],
    [source('disabled', -1, false), source('second', 10), source('first', 0)],
    {
      concurrency: 2,
      groupId: '8',
      hasBook: () => false,
      search,
      commit: async book => {
        committed.push(book);
        return true;
      },
    },
  );
  expect(search.mock.calls.map(call => call[0].bookSourceUrl)).toEqual([
    'first',
    'second',
  ]);
  expect(result).toEqual({ added: 1, skipped: 0, failed: 0 });
  expect(committed[0]).toMatchObject({
    name: 'Name',
    author: 'A',
    intro: 'Source description',
    chapters: [],
    pendingCatalog: true,
    chapterTitle: '',
    latestChapterTitle: 'Latest',
    groupIds: ['8'],
  });
});
test('duplicates and existing books are skipped without searching; built-in groups are not assigned', async () => {
  const search = jest.fn(async (_source: BookSource, name: string) => [
      candidate(name, ''),
    ]),
    commit = jest.fn(async (_book: Book) => true);
  const result = await importBookList(
    [
      { name: 'Existing', author: '' },
      { name: 'New', author: '' },
      { name: 'New', author: '' },
    ],
    [source('second', 0)],
    {
      concurrency: 4,
      groupId: '-1',
      hasBook: async item => item.name === 'Existing',
      search,
      commit,
    },
  );
  expect(result).toEqual({ added: 1, skipped: 2, failed: 0 });
  expect(search).toHaveBeenCalledTimes(1);
  expect(commit.mock.calls[0][0].groupIds).toBeUndefined();
});
test('one failed source or book does not prevent later sources and books from importing', async () => {
  const onNotFound = jest.fn();
  const result = await importBookList(
    [
      { name: 'Missing', author: '' },
      { name: 'Found', author: '' },
    ],
    [source('broken', 0), source('working', 1)],
    {
      concurrency: 2,
      hasBook: () => false,
      search: async (value, name) => {
        if (value.bookSourceUrl === 'broken') throw new Error('Source error');
        return name === 'Found' ? [candidate(name, '')] : [];
      },
      commit: async () => true,
      onNotFound,
    },
  );
  expect(result).toEqual({ added: 1, skipped: 0, failed: 1 });
  expect(onNotFound).toHaveBeenCalledTimes(1);
  expect(onNotFound.mock.calls[0][0]).toEqual({ name: 'Missing', author: '' });
  expect(onNotFound.mock.calls[0][1].message).toBe('没有搜索到<Missing>');
});
