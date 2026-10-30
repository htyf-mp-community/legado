jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn() },
}));
jest.mock('../src/core/sourceRequest', () => ({
  buildSourcePageRequest: jest.fn(),
  executeSourceRequest: async () => ({
    url: 'https://source.test/book',
    data: {
      name: 'New name',
      author: 'New author',
      kind: 'Fantasy',
      words: '20万',
      intro: 'Source intro',
    },
  }),
}));
import { loadBookInfo } from '../src/core/webBook';
import { displayBookIntro, editBookIntro } from '../src/core/bookMetadata';
import type { Book, BookSource, SearchBook } from '../src/types';
const source: BookSource = {
  bookSourceUrl: 'https://source.test',
  bookSourceName: 'S',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: false,
  ruleBookInfo: {
    name: '$.name',
    author: '$.author',
    kind: '$.kind',
    wordCount: '$.words',
    intro: '$.intro',
  },
};
const book: SearchBook = {
  origin: source.bookSourceUrl,
  originName: 'S',
  bookUrl: 'https://source.test/book',
  name: 'Existing',
  author: 'Author',
};
test('book info retains nonempty search identity by default and updates source metadata', async () => {
  expect(await loadBookInfo(source, book)).toMatchObject({
    name: 'Existing',
    author: 'Author',
    kind: 'Fantasy',
    wordCount: '20万',
    intro: 'Source intro',
  });
  expect(
    await loadBookInfo(source, { ...book, name: '', author: '' }),
  ).toMatchObject({ name: 'New name', author: 'New author' });
});
test.each(['true', 'false'])(
  'native nonblank canReName=%s permits renaming',
  async canReName => {
    expect(
      await loadBookInfo(
        {
          ...source,
          ruleBookInfo: { ...(source.ruleBookInfo as object), canReName },
        },
        book,
      ),
    ).toMatchObject({ name: 'New name', author: 'New author' });
  },
);
test('private introductions display and edit independently from refreshed source metadata without trimming', () => {
  const value: Book = {
    id: 'a',
    name: 'A',
    author: 'B',
    intro: 'Source',
    customIntro: '  Private\n',
    content: '',
    chapterTitle: '',
    progress: 0,
    updatedAt: 1,
  };
  expect(displayBookIntro(value)).toBe('  Private\n');
  expect(editBookIntro(value, '  Changed  ')).toMatchObject({
    intro: 'Source',
    customIntro: '  Changed  ',
  });
  expect(displayBookIntro(editBookIntro(value, ''))).toBe('Source');
  expect(editBookIntro(value, 'Source').customIntro).toBeUndefined();
});
