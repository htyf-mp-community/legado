import { importBookList, resolveBookListInput } from '../core/bookList';
import { loadLibrary, updateLibrary } from '../data/library';
import { loadSources } from '../data/sources';
import { loadGeneralPreferences } from '../data/generalPreferences';
import { searchSource } from '../core/webBook';
import { addAppLog } from '../data/appLog';
export async function importBookListInput(
  input: string,
  groupId: string,
  onNotFound?: (cause: Error) => void,
) {
  const entries = await resolveBookListInput(input, async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  });
  return importBookList(entries, await loadSources(), {
    concurrency: loadGeneralPreferences().threadCount,
    groupId,
    search: searchSource,
    hasBook: async entry =>
      (await loadLibrary()).some(
        book => book.name === entry.name && book.author === entry.author,
      ),
    commit: async book => {
      let added = false;
      await updateLibrary(current => {
        if (
          current.some(
            value => value.name === book.name && value.author === book.author,
          )
        )
          return current;
        added = true;
        return [book, ...current.filter(value => value.id !== book.id)];
      });
      return added;
    },
    onError: (entry, error) =>
      addAppLog(`Book-list import: ${entry.name} (${entry.author})`, error),
    onNotFound: (_entry, cause) => onNotFound?.(cause),
  });
}
