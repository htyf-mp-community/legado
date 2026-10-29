import { unlink } from '@dr.pogodin/react-native-fs';
import { clearMangaCache } from '../core/mangaCache';
import { cleanupEpubAssets } from '../core/epubBook';
import { clearManagedTextCache } from '../core/bookshelfManagement';
import { isLocalBook } from '../core/bookKinds';
import { loadLibrary, updateLibrary } from '../data/library';
import { addAppLog } from '../data/appLog';
import { loadSources } from '../data/sources';
import { loadGeneralPreferences } from '../data/generalPreferences';
import { loadBookInfo, loadChapters } from '../core/webBook';
import { applyBookCatalogue, fetchBookCatalogue } from '../core/bookCatalogue';
import { allSettledLimited } from '../core/concurrency';
import { trackBookshelfRefresh } from './bookshelfRefreshRuntime';
export async function clearManagedBookCache(ids: ReadonlySet<string>) {
  const books = (await loadLibrary()).filter(book => ids.has(book.id));
  for (const book of books) await clearMangaCache(book.id);
  await updateLibrary(current =>
    current.map(book =>
      ids.has(book.id) ? clearManagedTextCache(book) : book,
    ),
  );
}
export async function deleteManagedBooks(
  ids: ReadonlySet<string>,
  deleteOriginal: boolean,
) {
  const books = (await loadLibrary()).filter(book => ids.has(book.id));
  await updateLibrary(current => current.filter(book => !ids.has(book.id)));
  for (const book of books) {
    try {
      await clearMangaCache(book.id);
      if (isLocalBook(book)) {
        await cleanupEpubAssets(book);
        if (deleteOriginal && book.localUri?.startsWith('file://'))
          await unlink(decodeURIComponent(book.localUri.slice(7)));
      }
    } catch (cause) {
      addAppLog(`Delete book files: ${book.name}`, cause);
    }
  }
}
export async function refreshManagedBooks(ids: ReadonlySet<string>) {
  const books = (await loadLibrary()).filter(
      book =>
        ids.has(book.id) && !isLocalBook(book) && book.canUpdate !== false,
    ),
    sources = new Map(
      (await loadSources()).map(source => [source.bookSourceUrl, source]),
    ),
    tracking = trackBookshelfRefresh(books.map(book => book.id));
  try {
    return await allSettledLimited(
      books.map(before => async () => {
        tracking.start(before.id);
        try {
          const source = sources.get(before.origin ?? '');
          if (!source) throw new Error('书源不存在');
          const { info, chapters } = await fetchBookCatalogue(
            before,
            source,
            loadBookInfo,
            loadChapters,
            undefined,
            true,
          );
          await updateLibrary(current =>
            current.map(book => {
              if (
                book.id !== before.id ||
                book.origin !== before.origin ||
                book.bookUrl !== before.bookUrl
              )
                return book;
              const ready = applyBookCatalogue(
                book,
                before,
                { ...info, name: before.name, author: before.author },
                chapters,
              );
              return {
                ...ready,
                updateError: false,
                nativeType:
                  book.nativeType === undefined
                    ? undefined
                    : book.nativeType & ~16,
                lastCheckCount: Math.max(
                  0,
                  chapters.length - (before.chapters?.length ?? 0),
                ),
                latestChapterTime:
                  chapters.length !== before.chapters?.length ||
                  chapters.at(-1)?.title !== before.chapters?.at(-1)?.title
                    ? Date.now()
                    : book.latestChapterTime,
              };
            }),
          );
        } catch (cause) {
          await updateLibrary(current =>
            current.map(book =>
              book.id === before.id &&
              book.origin === before.origin &&
              book.bookUrl === before.bookUrl
                ? { ...book, updateError: true }
                : book,
            ),
          );
          addAppLog(
            `Update book information and catalogue: ${before.name}`,
            cause,
          );
          throw cause;
        } finally {
          tracking.finish(before.id);
        }
      }),
      loadGeneralPreferences().threadCount,
    );
  } finally {
    tracking.dispose();
  }
}
