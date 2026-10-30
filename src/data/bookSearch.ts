import type { Book, BookSource, SearchBook } from '../types';
import type { ReadRecord } from './readRecords';
import { hasReadRecord } from '../core/readRecordAuthors';
import { appStorage } from './storage';

const KEY = 'book-search.preferences.v1';

export type SearchHistoryItem = {
  word: string;
  usage: number;
  lastUseTime: number;
};

export type BookSearchPreferences = {
  precision: boolean;
  showReadRecord: boolean;
  filter: string;
  groups: string[];
  history: SearchHistoryItem[];
};

export const defaultBookSearchPreferences: BookSearchPreferences = {
  precision: false,
  showReadRecord: true,
  filter: '',
  groups: [],
  history: [],
};

const strings = (value: unknown) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .map(String)
            .map(item => item.trim())
            .filter(Boolean),
        ),
      ]
    : [];

export function normalizeBookSearchPreferences(
  value: unknown,
): BookSearchPreferences {
  const raw =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const history = Array.isArray(raw.history)
    ? raw.history
        .filter(item => item && typeof item === 'object')
        .map(item => {
          const entry = item as Record<string, unknown>;
          return {
            word: String(entry.word ?? '').trim(),
            usage: Math.max(1, Number(entry.usage) || 1),
            lastUseTime: Math.max(0, Number(entry.lastUseTime) || 0),
          };
        })
        .filter(item => item.word)
        .sort((a, b) => b.lastUseTime - a.lastUseTime)
        .slice(0, 100)
    : [];
  return {
    precision: raw.precision === true,
    showReadRecord: raw.showReadRecord !== false,
    filter: typeof raw.filter === 'string' ? raw.filter.trim() : '',
    groups: strings(raw.groups),
    history,
  };
}

export function loadBookSearchPreferences() {
  const raw = appStorage.getString(KEY);
  if (!raw) return defaultBookSearchPreferences;
  try {
    return normalizeBookSearchPreferences(JSON.parse(raw));
  } catch {
    return defaultBookSearchPreferences;
  }
}

export function saveBookSearchPreferences(value: BookSearchPreferences) {
  const normalized = normalizeBookSearchPreferences(value);
  appStorage.set(KEY, JSON.stringify(normalized));
  return normalized;
}

export function rememberSearchKeyword(
  preferences: BookSearchPreferences,
  word: string,
  now = Date.now(),
) {
  const key = word.trim();
  if (!key) return preferences;
  const current = preferences.history.find(item => item.word === key);
  return normalizeBookSearchPreferences({
    ...preferences,
    history: [
      { word: key, usage: (current?.usage ?? 0) + 1, lastUseTime: now },
      ...preferences.history.filter(item => item.word !== key),
    ],
  });
}

export function removeSearchKeyword(
  preferences: BookSearchPreferences,
  word: string,
) {
  return normalizeBookSearchPreferences({
    ...preferences,
    history: preferences.history.filter(item => item.word !== word),
  });
}

export function selectSearchSources(
  sources: BookSource[],
  groups: string[],
  sourceUrl?: string,
) {
  if (sourceUrl)
    return sources.filter(
      source => source.bookSourceUrl === sourceUrl && !!source.searchUrl,
    );
  const selected = new Set(groups);
  return sources.filter(
    source =>
      source.enabled &&
      !!source.searchUrl &&
      (!selected.size ||
        String(source.bookSourceGroup ?? '')
          .split(/[,，]/)
          .some(group => selected.has(group.trim()))),
  );
}

export function filterSearchResults(
  books: SearchBook[],
  key: string,
  precision: boolean,
  rawWords: string,
) {
  const words = [
    ...new Set(
      rawWords
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean),
    ),
  ];
  return books.filter(book => {
    const fields = [book.name, book.author, book.kind ?? ''];
    if (precision && !fields.some(field => field.includes(key))) return false;
    return !words.some(word =>
      fields.some(field =>
        field.toLocaleLowerCase().includes(word.toLocaleLowerCase()),
      ),
    );
  });
}

export function searchLocalBooks(books: Book[], query: string) {
  const key = query.trim().toLocaleLowerCase();
  if (!key) return [];
  return books.filter(book =>
    `${book.name}\n${book.author}`.toLocaleLowerCase().includes(key),
  );
}

export function searchBookIndicator(
  book: SearchBook,
  library: Book[],
  records: ReadRecord[],
  showReadRecord: boolean,
) {
  const inBookshelf = library.some(item => {
    if (item.bookUrl && item.bookUrl === book.bookUrl) return true;
    if (item.name !== book.name) return false;
    return !book.author || !item.author || item.author === book.author;
  });
  if (inBookshelf) return 'bookshelf' as const;
  if (showReadRecord && hasReadRecord(records, book.name, book.author))
    return 'read' as const;
  return 'none' as const;
}

export type GroupedSearchResult = {
  book: SearchBook;
  origins: SearchBook[];
  rank: 0 | 1 | 2 | 3;
  order: number;
};

export function groupSearchResults(books: SearchBook[], query: string) {
  const key = query.trim(),
    groups = new Map<string, GroupedSearchResult>();
  books.forEach((book, order) => {
    const identity = `${book.name}\0${book.author}`,
      rank: GroupedSearchResult['rank'] =
        book.name === key || book.author === key
          ? 0
          : book.kind?.includes(key)
            ? 1
            : book.name.includes(key) || book.author.includes(key)
              ? 2
              : 3,
      previous = groups.get(identity);
    if (!previous) {
      groups.set(identity, { book, origins: [book], rank, order });
      return;
    }
    if (
      !previous.origins.some(
        item => item.origin === book.origin && item.bookUrl === book.bookUrl,
      )
    )
      previous.origins.push(book);
    previous.rank = Math.min(
      previous.rank,
      rank,
    ) as GroupedSearchResult['rank'];
  });
  return [...groups.values()].sort(
    (a, b) =>
      a.rank - b.rank ||
      (a.rank < 3 ? b.origins.length - a.origins.length : 0) ||
      a.order - b.order,
  );
}
