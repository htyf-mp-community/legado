import {
  coverImageUri,
  coverSnapshotMatches,
  coverSourceOrigin,
  displayBookCover,
  editBookCover,
  editableBookCover,
  networkBookCover,
  normalizeLegacyCover,
} from '../src/core/bookCover';
import { applyBookUpdate } from '../src/core/bookUpdate';
import { switchLibraryBookSource } from '../src/core/onlineLibrary';
import type { Book } from '../src/types';
import {
  exportBookshelfJson,
  parseBookshelfJson,
} from '../src/core/bookshelfTransfer';
const book: Book = {
  id: 'b',
  name: 'Book',
  author: 'A',
  intro: '',
  chapterTitle: 'one',
  content: '',
  progress: 0.5,
  updatedAt: 1,
  origin: 'https://source.example/path',
  bookUrl: '/book',
  coverUrl: 'https://source.example/source.jpg',
  customCoverUrl: 'https://source.example/custom.jpg',
  persistedCoverUrl: '/docs/covers/a.cover',
};
test('native and HTYF bookshelf transfers retain the independent cover layers', () => {
  expect(parseBookshelfJson(exportBookshelfJson([book]))[0]).toMatchObject({
    coverUrl: book.coverUrl,
    customCoverUrl: book.customCoverUrl,
    persistedCoverUrl: book.persistedCoverUrl,
  });
  const imported = parseBookshelfJson(
    JSON.stringify([
      {
        bookUrl: '/book',
        name: 'B',
        coverUrl: book.coverUrl,
        customCoverUrl: book.customCoverUrl,
        persistedCoverUrl: book.persistedCoverUrl,
      },
    ]),
  )[0];
  expect(imported).toMatchObject({
    coverUrl: book.coverUrl,
    customCoverUrl: book.customCoverUrl,
    persistedCoverUrl: book.persistedCoverUrl,
  });
});
test('display, editor and persistence choose different native cover layers', () => {
  expect(displayBookCover(book)).toBe(book.persistedCoverUrl);
  expect(editableBookCover(book)).toBe(book.customCoverUrl);
  expect(networkBookCover(book)).toBe(book.customCoverUrl);
  expect(
    networkBookCover({ ...book, customCoverUrl: '/manual.jpg' }),
  ).toBeUndefined();
  expect(networkBookCover({ ...book, customCoverUrl: '' })).toBe(book.coverUrl);
  expect(
    displayBookCover({ ...book, persistedCoverUrl: '', customCoverUrl: '' }),
  ).toBe(book.coverUrl);
});
test('only same-origin custom images use source credentials, with strict scheme and explicit port identity', () => {
  expect(coverSourceOrigin(book)).toBeUndefined();
  expect(coverSourceOrigin(book, false)).toBe(book.origin);
  for (const customCoverUrl of [
    'http://source.example/a',
    'https://other.example/a',
    'https://source.example:443/a',
    '/a.jpg',
  ])
    expect(
      coverSourceOrigin({ ...book, customCoverUrl }, false),
    ).toBeUndefined();
  expect(coverSourceOrigin({ ...book, customCoverUrl: undefined }, false)).toBe(
    book.origin,
  );
  expect(
    coverSourceOrigin(
      { ...book, customCoverUrl: 'HTTPS://SOURCE.EXAMPLE/a' },
      false,
    ),
  ).toBe(book.origin);
});
test('editing the network layer clears persistence only when the actual editable value changes', () => {
  expect(editBookCover(book, book.customCoverUrl!)).toEqual(book);
  expect(editBookCover(book, book.coverUrl!)).toMatchObject({
    coverUrl: book.coverUrl,
    customCoverUrl: undefined,
    persistedCoverUrl: undefined,
  });
  const only = { ...book, customCoverUrl: undefined, coverUrl: undefined };
  expect(editBookCover(only, '').persistedCoverUrl).toBe(
    book.persistedCoverUrl,
  );
  expect(editBookCover(book, '').persistedCoverUrl).toBeUndefined();
});
test('legacy persistence classification is conservative and local image URLs escape real file names', () => {
  const path = '/old/covers/0123456789abcdef0123456789abcdef.cover';
  expect(
    normalizeLegacyCover({
      ...book,
      persistedCoverUrl: undefined,
      customCoverUrl: path,
    }),
  ).toMatchObject({ customCoverUrl: undefined, persistedCoverUrl: path });
  expect(
    normalizeLegacyCover({
      customCoverUrl: '/covers/0123456789abcdef0123456789abcdef.cover',
    }).persistedCoverUrl,
  ).toBe('/covers/0123456789abcdef0123456789abcdef.cover');
  for (const customCoverUrl of [
    '/old/covers/manual.cover',
    'https://x/covers/0123456789abcdef0123456789abcdef.cover',
    '/other/0123456789abcdef0123456789abcdef.cover',
  ])
    expect(
      normalizeLegacyCover({
        ...book,
        customCoverUrl,
        persistedCoverUrl: undefined,
      }).customCoverUrl,
    ).toBe(customCoverUrl);
  expect(coverImageUri('/docs/封面 #1?.cover')).toBe(
    'file:///docs/%E5%B0%81%E9%9D%A2%20%231%3F.cover',
  );
});
test('commit guards protect all three layers but do not reject unrelated progress changes', () => {
  expect(coverSnapshotMatches({ ...book, progress: 0.8 }, book)).toBe(true);
  for (const key of [
    'id',
    'origin',
    'bookUrl',
    'coverUrl',
    'customCoverUrl',
    'persistedCoverUrl',
  ])
    expect(coverSnapshotMatches({ ...book, [key]: 'changed' }, book)).toBe(
      false,
    );
});
test('source switching and delayed progress writes retain the latest overrides', () => {
  const current = {
      ...book,
      persistedCoverUrl: '/latest.cover',
      customCoverUrl: 'https://latest/a.jpg',
    },
    switched = switchLibraryBookSource(
      book,
      {
        name: 'Book',
        author: 'A',
        origin: 'new',
        originName: 'New',
        bookUrl: '/new',
      },
      [],
    );
  expect(switched).toMatchObject({
    customCoverUrl: book.customCoverUrl,
    persistedCoverUrl: book.persistedCoverUrl,
  });
  expect(applyBookUpdate(current, book, switched)).toMatchObject({
    customCoverUrl: current.customCoverUrl,
    persistedCoverUrl: current.persistedCoverUrl,
    origin: 'new',
  });
  expect(
    applyBookUpdate(current, book, { ...book, progress: 0.9 }),
  ).toMatchObject({
    persistedCoverUrl: current.persistedCoverUrl,
    progress: 0.9,
  });
  expect(
    applyBookUpdate({ ...current, origin: 'new', coverUrl: 'new.jpg' }, book, {
      ...book,
      coverUrl: 'late-old.jpg',
    }).coverUrl,
  ).toBe('new.jpg');
});
