import type { Book } from '../types';
import { normalizeLegacyCover } from './bookCover';

type AndroidBook = Record<string, unknown> & { _htyf?: Book };

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const number = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

export function exportBookshelfJson(books: Book[]) {
  return JSON.stringify(
    books.map(book => ({
      bookUrl: book.bookUrl || book.id,
      name: book.name,
      author: book.author,
      intro: book.intro,
      origin: book.origin || 'local',
      originName: book.originName || '',
      coverUrl: book.coverUrl || '',
      customCoverUrl: book.customCoverUrl,
      persistedCoverUrl: book.persistedCoverUrl,
      durChapterTitle: book.chapterTitle,
      durChapterIndex: book.currentChapterIndex ?? 0,
      durChapterPos: book.progress,
      totalChapterNum: book.chapters?.length ?? 1,
      latestChapterTime: book.latestChapterTime ?? book.updatedAt,
      durChapterTime: book.durChapterTime ?? book.updatedAt,
      order: book.order ?? 0,
      group: (book.groupIds ?? []).join(','),
      _htyf: book,
    })),
    null,
    2,
  );
}

export function parseBookshelfJson(raw: string): Book[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed))
    throw new Error('bookshelf JSON must be an array');
  if (parsed.length > 10_000)
    throw new Error('bookshelf JSON contains too many books');
  const books: Book[] = [];
  const seen = new Set<string>();
  for (const value of parsed as AndroidBook[]) {
    if (!value || typeof value !== 'object') continue;
    const embedded =
        value._htyf && typeof value._htyf === 'object'
          ? value._htyf
          : undefined,
      id = text(embedded?.id) || text(value.bookUrl),
      name = text(embedded?.name) || text(value.name);
    if (!id || !name || seen.has(id)) continue;
    const chapterTitle =
        text(embedded?.chapterTitle) ||
        text(value.durChapterTitle) ||
        'Chapter 1',
      content = text(embedded?.content),
      chapters = embedded?.chapters?.length
        ? embedded.chapters
        : [{ id: `${id}-legacy`, title: chapterTitle, content }],
      currentChapterIndex = Math.max(
        0,
        Math.min(
          chapters.length - 1,
          Math.floor(
            number(
              embedded?.currentChapterIndex,
              number(value.durChapterIndex),
            ),
          ),
        ),
      );
    seen.add(id);
    books.push(
      normalizeLegacyCover({
        ...(embedded ?? {}),
        id,
        name,
        author: text(embedded?.author) || text(value.author),
        intro: text(embedded?.intro) || text(value.intro),
        chapterTitle: chapters[currentChapterIndex].title,
        content: chapters[currentChapterIndex].content,
        chapters,
        currentChapterIndex,
        progress: number(embedded?.progress, number(value.durChapterPos)),
        updatedAt: number(embedded?.updatedAt, Date.now()),
        ...(embedded
          ? {}
          : {
              latestChapterTime: number(value.latestChapterTime, Date.now()),
              durChapterTime: number(value.durChapterTime, Date.now()),
              order: number(value.order),
              origin: text(value.origin) || undefined,
              originName: text(value.originName) || undefined,
              bookUrl: text(value.bookUrl) || undefined,
              coverUrl: text(value.coverUrl) || undefined,
              customCoverUrl: text(value.customCoverUrl) || undefined,
              persistedCoverUrl: text(value.persistedCoverUrl) || undefined,
              groupIds: text(value.group)
                .split(',')
                .map(item => item.trim())
                .filter(Boolean),
            }),
      }),
    );
  }
  if (!books.length && parsed.length)
    throw new Error('bookshelf JSON contains no valid books');
  return books;
}

export function mergeBookshelf(
  existing: Book[],
  incoming: Book[],
  overwrite: boolean,
) {
  const byId = new Map(existing.map(book => [book.id, book]));
  let added = 0,
    replaced = 0,
    skipped = 0;
  for (const book of incoming) {
    if (!byId.has(book.id)) {
      byId.set(book.id, book);
      added += 1;
    } else if (overwrite) {
      byId.set(book.id, book);
      replaced += 1;
    } else skipped += 1;
  }
  return { books: [...byId.values()], added, replaced, skipped };
}
