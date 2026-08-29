import {
  addBooksByUrls,
  matchBookUrlSource,
  parseBookUrlInput,
} from '../src/core/addBookByUrl';
import type { Book, BookChapter, BookSource, SearchBook } from '../src/types';

jest.mock('../src/core/webBook', () => ({
  loadBookInfo: jest.fn(),
  loadChapters: jest.fn(),
}));

const source = (
  url: string,
  extra: Partial<BookSource> = {},
): BookSource => ({
  bookSourceUrl: url,
  bookSourceName: url,
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
  ...extra,
});

const chapters: BookChapter[] = [
  {
    url: 'https://books.test/chapter/1',
    title: '第一章',
    index: 0,
    bookUrl: 'https://books.test/book/1',
    baseUrl: 'https://books.test/book/1',
    isVolume: false,
    isVip: false,
    isPay: false,
  },
];

describe('add book by URL', () => {
  test('parses multiple lines and Legado attached source option', () => {
    expect(
      parseBookUrlInput(
        'https://a.test/book/1,{"origin":"https://source.test"}\nhttps://b.test/book/2',
      ),
    ).toEqual([
      { url: 'https://a.test/book/1', origin: 'https://source.test' },
      { url: 'https://b.test/book/2' },
    ]);
  });

  test('matches explicit source, same site, then URL pattern', () => {
    const sources = [
      source('https://explicit.test'),
      source('https://same.test/api'),
      source('https://other.test', { bookUrlPattern: 'pattern\\.test/book' }),
    ];
    expect(
      matchBookUrlSource(
        { url: 'https://same.test/book/1', origin: 'https://explicit.test' },
        sources,
      ),
    ).toBe(sources[0]);
    expect(
      matchBookUrlSource({ url: 'https://same.test/book/1' }, sources),
    ).toBe(sources[1]);
    expect(
      matchBookUrlSource({ url: 'https://pattern.test/book/1' }, sources),
    ).toBe(sources[2]);
  });

  test('isolates failures and preserves progress when the same book changes source', async () => {
    const old: Book = {
        id: 'kept-id',
        name: '同一本书',
        author: '作者',
        intro: '',
        chapterTitle: '第一章',
        content: '',
        chapters: [],
        progress: 0.5,
        groupIds: ['favorite'],
        updatedAt: 1,
        bookUrl: 'https://old.test/book/1',
      },
      goodSource = source('https://books.test'),
      result = await addBooksByUrls(
        'not a url\nhttps://books.test/book/1',
        [goodSource],
        [old],
        {
          info: async (_source, book): Promise<SearchBook> => ({
            ...book,
            name: '同一本书',
            author: '作者',
          }),
          chapters: async () => chapters,
        },
      );
    expect(result.results.map(item => item.status)).toEqual([
      'failed',
      'added',
    ]);
    expect(result.books).toHaveLength(1);
    expect(result.books[0]).toMatchObject({
      id: 'kept-id',
      progress: 0.5,
      groupIds: ['favorite'],
      bookUrl: 'https://books.test/book/1',
    });
  });

  test('does not fetch a URL already on the shelf', async () => {
    const existing = {
        id: 'existing',
        name: '已有',
        author: '',
        intro: '',
        chapterTitle: '',
        content: '',
        progress: 0,
        updatedAt: 1,
        bookUrl: 'https://books.test/book/1',
      },
      info = jest.fn();
    const result = await addBooksByUrls(
      'https://books.test/book/1',
      [source('https://books.test')],
      [existing],
      { info },
    );
    expect(result.results[0].status).toBe('existing');
    expect(info).not.toHaveBeenCalled();
  });
});
