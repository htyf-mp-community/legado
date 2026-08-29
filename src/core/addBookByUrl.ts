import type { Book, BookChapter, BookSource, SearchBook } from '../types';
import { toLibraryBook, switchLibraryBookSource } from './onlineLibrary';
import { loadBookInfo, loadChapters } from './webBook';

export type BookUrlInput = { url: string; origin?: string };
export type AddBookUrlResult = {
  url: string;
  status: 'added' | 'existing' | 'failed';
  book?: Book;
  error?: string;
};

export function parseBookUrlInput(value: string): BookUrlInput[] {
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const optionAt = line.lastIndexOf(',{');
      if (optionAt < 0) return { url: line };
      try {
        const option = JSON.parse(line.slice(optionAt + 1)) as Record<
          string,
          unknown
        >;
        const origin = String(
          option.origin ?? option.bookSourceUrl ?? '',
        ).trim();
        return { url: line.slice(0, optionAt).trim(), origin: origin || undefined };
      } catch {
        return { url: line };
      }
    });
}

const site = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
};

export function matchBookUrlSource(
  input: BookUrlInput,
  sources: BookSource[],
): BookSource | undefined {
  const enabled = sources.filter(source => source.enabled);
  if (input.origin) {
    const explicit = enabled.find(
      source => source.bookSourceUrl === input.origin,
    );
    if (explicit) return explicit;
  }
  const inputSite = site(input.url);
  const sameSite = enabled.find(
    source => inputSite && site(source.bookSourceUrl) === inputSite,
  );
  if (sameSite) return sameSite;
  return enabled.find(source => {
    const pattern = String(source.bookUrlPattern ?? '').trim();
    if (!pattern) return false;
    try {
      return new RegExp(pattern).test(input.url);
    } catch {
      return false;
    }
  });
}

export async function addBooksByUrls(
  value: string,
  sources: BookSource[],
  current: Book[],
  loaders: {
    info?: (source: BookSource, book: SearchBook) => Promise<SearchBook>;
    chapters?: (
      source: BookSource,
      book: SearchBook,
    ) => Promise<BookChapter[]>;
  } = {},
) {
  const books = [...current],
    results: AddBookUrlResult[] = [],
    infoLoader = loaders.info ?? loadBookInfo,
    chapterLoader = loaders.chapters ?? loadChapters;
  for (const input of parseBookUrlInput(value)) {
    const exact = books.find(book => book.bookUrl === input.url);
    if (exact) {
      results.push({ url: input.url, status: 'existing', book: exact });
      continue;
    }
    try {
      new URL(input.url);
      const source = matchBookUrlSource(input, sources);
      if (!source) throw new Error('NO_MATCHING_BOOK_SOURCE');
      const seed: SearchBook = {
          bookUrl: input.url,
          origin: source.bookSourceUrl,
          originName: source.bookSourceName,
          name: '',
          author: '',
          sourceType: source.bookSourceType,
        },
        info = await infoLoader(source, seed),
        chapters = await chapterLoader(source, info);
      if (!info.name.trim()) throw new Error('EMPTY_BOOK_NAME');
      const sameBookIndex = books.findIndex(
          book => book.name === info.name && book.author === info.author,
        ),
        added =
          sameBookIndex >= 0
            ? switchLibraryBookSource(books[sameBookIndex], info, chapters)
            : toLibraryBook(info, chapters);
      if (sameBookIndex >= 0) books[sameBookIndex] = added;
      else books.push(added);
      results.push({ url: input.url, status: 'added', book: added });
    } catch (error) {
      results.push({
        url: input.url,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { books, results };
}
