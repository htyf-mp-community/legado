import type { Book, BookSource, SearchBook } from '../types';
import { toLibraryBook } from './onlineLibrary';
import { allSettledLimited } from './concurrency';

export type BookListEntry = { name: string; author: string; intro?: string };
/** Native books.json is a discovery list. It does not contain URLs, progress, groups or cached text. */
export function exportBookList(books: Book[]) {
  return JSON.stringify(
    books.map(book => ({
      name: book.name,
      author: book.author,
      intro: book.customIntro || book.intro,
    })),
    null,
    2,
  );
}
export function parseBookList(input: string): BookListEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('格式不对');
  }
  if (!Array.isArray(parsed)) throw new Error('格式不对');
  return parsed.flatMap(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const text = (field: unknown) =>
      typeof field === 'string'
        ? field
        : typeof field === 'number' || typeof field === 'boolean'
          ? String(field)
          : '';
    const name = text(value.name);
    return name
      ? [
          {
            name,
            author: text(value.author),
            intro: text(value.intro) || undefined,
          },
        ]
      : [];
  });
}
export async function resolveBookListInput(
  input: string,
  fetchText: (url: string) => Promise<string>,
): Promise<BookListEntry[]> {
  let text = input.trim();
  const seen = new Set<string>();
  while (/^https?:\/\//i.test(text)) {
    if (seen.has(text) || seen.size >= 10) throw new Error('书单地址循环引用');
    seen.add(text);
    text = (await fetchText(text)).trim();
  }
  return parseBookList(text);
}
export type BookListImportResult = {
  added: number;
  skipped: number;
  failed: number;
};
export async function importBookList(
  entries: BookListEntry[],
  sources: BookSource[],
  options: {
    concurrency: number;
    groupId?: string;
    hasBook: (entry: BookListEntry) => boolean | Promise<boolean>;
    search: (source: BookSource, keyword: string) => Promise<SearchBook[]>;
    commit: (book: Book) => Promise<boolean>;
    onError?: (entry: BookListEntry, cause: unknown) => void;
    onNotFound?: (entry: BookListEntry, cause: Error) => void;
  },
): Promise<BookListImportResult> {
  const eligible = sources
    .filter(source => source.enabled)
    .sort((a, b) => a.customOrder - b.customOrder);
  const reserved = new Set<string>();
  const results = await allSettledLimited(
    entries.map(entry => async () => {
      const identity = JSON.stringify([entry.name, entry.author]);
      if ((await options.hasBook(entry)) || reserved.has(identity))
        return 'skipped' as const;
      reserved.add(identity);
      for (const source of eligible) {
        try {
          const candidates = await options.search(source, entry.name);
          const candidate = candidates.find(
            item => item.name === entry.name && item.author === entry.author,
          );
          if (!candidate) continue;
          const book = toLibraryBook(candidate, []);
          book.chapterTitle = '';
          book.latestChapterTitle = candidate.latestChapterTitle;
          book.kind = candidate.kind;
          book.pendingCatalog = true;
          book.latestChapterTime = book.updatedAt;
          book.durChapterTime = book.updatedAt;
          if (
            options.groupId &&
            /^\d+$/.test(options.groupId) &&
            BigInt(options.groupId) > 0n
          )
            book.groupIds = [options.groupId];
          return (await options.commit(book))
            ? ('added' as const)
            : ('skipped' as const);
        } catch (cause) {
          // Native tries each enabled source in its configured order, including sources whose search fails.
          options.onError?.(entry, cause);
        }
      }
      const error = new Error(`没有搜索到<${entry.name}>${entry.author}`);
      options.onError?.(entry, error);
      options.onNotFound?.(entry, error);
      throw error;
    }),
    options.concurrency,
  );
  return {
    added: results.filter(
      value => value.status === 'fulfilled' && value.value === 'added',
    ).length,
    skipped: results.filter(
      value => value.status === 'fulfilled' && value.value === 'skipped',
    ).length,
    failed: results.filter(value => value.status === 'rejected').length,
  };
}
