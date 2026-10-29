import {
  fetchBookCatalogue,
  applyBookCatalogue,
  needsBookCatalogue,
} from '../core/bookCatalogue';
import { loadLibrary, updateLibrary } from '../data/library';
import { loadSources } from '../data/sources';
import { loadBookInfo, loadChapters } from '../core/webBook';
export async function prepareBookCatalogue(
  bookId: string,
  signal: AbortSignal,
) {
  const check = () => {
    if (signal.aborted) {
      const error = new Error('Cancelled');
      error.name = 'AbortError';
      throw error;
    }
  };
  const book = (await loadLibrary()).find(value => value.id === bookId);
  if (!book || !needsBookCatalogue(book)) return;
  const source = (await loadSources()).find(
    value => value.bookSourceUrl === book.origin,
  );
  check();
  if (!source) throw new Error('书源不存在');
  const { info, chapters } = await fetchBookCatalogue(
    book,
    source,
    loadBookInfo,
    loadChapters,
    check,
  );
  check();
  await updateLibrary(current =>
    current.map(value =>
      value.id === book.id
        ? applyBookCatalogue(value, book, info, chapters)
        : value,
    ),
  );
}
