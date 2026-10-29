import type { Book, BookChapter, BookSource, SearchBook } from '../types';
import { isLocalBook } from '../core/bookKinds';
import { applyBatchSourceChange } from '../core/batchSourceChange';
import { abortableDelay, checkCancelled } from '../core/cancellation';
import { searchSource, loadBookInfo, loadChapters } from '../core/webBook';
import { updateLibrary } from '../data/library';
import { addAppLog } from '../data/appLog';
import { loadBatchSourceDelay } from '../data/batchSourcePreferences';
type Effects = {
  search?: typeof searchSource;
  info?: typeof loadBookInfo;
  toc?: typeof loadChapters;
  pause?: typeof abortableDelay;
};
export type BatchSourceResult = {
  updated: number;
  skipped: number;
  failed: number;
};
let active: AbortController | undefined;
export function startBatchSourceChange(
  books: Book[],
  source: BookSource,
  onProgress: (current: number, total: number) => void = () => undefined,
  effects: Effects = {},
) {
  active?.abort();
  const controller = new AbortController(),
    signal = controller.signal,
    selected = books.map(book => ({ ...book })),
    delay = loadBatchSourceDelay() * 1000,
    search = effects.search ?? searchSource,
    info = effects.info ?? loadBookInfo,
    toc = effects.toc ?? loadChapters,
    pause = effects.pause ?? abortableDelay;
  active = controller;
  const log = (stage: string, cause: unknown) => {
    checkCancelled(signal);
    addAppLog(
      `${stage}\n${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    );
  };
  const promise = Promise.resolve().then(async () => {
    const result: BatchSourceResult = { updated: 0, skipped: 0, failed: 0 };
    for (let index = 0; index < selected.length; index++) {
      checkCancelled(signal);
      const book = selected[index];
      onProgress(index + 1, selected.length);
      if (isLocalBook(book) || book.origin === source.bookSourceUrl) {
        result.skipped++;
        continue;
      }
      let candidate: SearchBook | undefined;
      try {
        candidate = (await search(source, book.name, 1, signal)).find(
          value => value.name === book.name && value.author === book.author,
        );
        checkCancelled(signal);
        if (!candidate)
          throw new Error(`未搜索到 ${book.name}(${book.author}) 书籍`);
      } catch (cause) {
        log('搜索书籍出错', cause);
        result.failed++;
        continue;
      }
      let ready = candidate;
      if (!candidate.tocUrl) {
        try {
          ready = await info(source, candidate, signal);
          checkCancelled(signal);
        } catch (cause) {
          log('获取书籍详情出错', cause);
          result.failed++;
          continue;
        }
      }
      let chapters: BookChapter[];
      try {
        chapters = await toc(source, ready, signal);
        checkCancelled(signal);
        if (!chapters.length) throw new Error('目录为空');
      } catch (cause) {
        log('获取目录出错', cause);
        result.failed++;
        await pause(delay, signal);
        checkCancelled(signal);
        continue;
      }
      let saved = false;
      checkCancelled(signal);
      await updateLibrary(current => {
        checkCancelled(signal);
        const updated = applyBatchSourceChange(
          current,
          book,
          { ...ready, sourceType: source.bookSourceType },
          chapters,
        );
        saved = updated.saved;
        return updated.books;
      });
      if (saved) result.updated++;
      else result.skipped++;
      // Native waits after every TOC attempt, including the final item, but not after search/info failures or skipped books.
      await pause(delay, signal);
    }
    checkCancelled(signal);
    return result;
  });
  void promise
    .finally(() => {
      if (active === controller) active = undefined;
    })
    .catch(() => undefined);
  return { promise, cancel: () => controller.abort() };
}
