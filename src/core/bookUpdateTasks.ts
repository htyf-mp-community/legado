import { createHash } from 'react-native-quick-crypto';
import type { Book } from '../types';
import {
  DEFAULT_AUTO_TASK_CRON,
  normalizeAutoTaskScript,
  type AutoTaskRule,
} from '../data/autoTasks';
export const BOOK_UPDATE_GENERATOR = 'bookUpdate';
export function bookUpdateTaskId(bookUrl: string) {
  const hash = createHash('md5');
  hash.update(bookUrl, 'utf8');
  return `book_update:${hash.digest('hex').slice(8, 24)}`;
}
function generatedBookIdentity(task: AutoTaskRule) {
  if (!task.id.startsWith('book_update:')) return;
  const script = normalizeAutoTaskScript(task.script);
  if (!script.startsWith('(') || !script.endsWith(')')) return;
  try {
    const action = JSON.parse(script.slice(1, -1));
    if (
      action?.generatedBy !== BOOK_UPDATE_GENERATOR ||
      typeof action.bookName !== 'string'
    )
      return;
    return [
      action.bookName,
      typeof action.bookAuthor === 'string' ? action.bookAuthor : '',
    ];
  } catch {
    return;
  }
}
export function findBookUpdateTask(tasks: AutoTaskRule[], book: Book) {
  const exact = tasks.find(
    task => task.id === bookUpdateTaskId(book.bookUrl || book.id),
  );
  if (exact) return exact;
  const matching = tasks.filter(task => {
    const identity = generatedBookIdentity(task);
    return identity?.[0] === book.name && identity[1] === book.author;
  });
  return matching.length === 1 ? matching[0] : undefined;
}
export function buildBookUpdateTasks(
  books: Book[],
  existing: AutoTaskRule[],
  cron: string,
  nameOf: (book: Book) => string,
): AutoTaskRule[] {
  const generated = books.map(book => {
      const bookUrl = book.bookUrl || book.id;
      return {
        book,
        task: {
          id: bookUpdateTaskId(bookUrl),
          name: nameOf(book),
          enable: true,
          cron: DEFAULT_AUTO_TASK_CRON,
          script: `(${JSON.stringify({ type: 'refreshToc', bookUrl, bookName: book.name, bookAuthor: book.author, generatedBy: BOOK_UPDATE_GENERATOR, respectCanUpdate: true, notify: { enable: true, minCount: 1 }, cache: { enable: false } })})`,
          enabledCookieJar: true,
          customOrder: 0,
          lastRunAt: 0,
        },
      };
    }),
    byId = new Map(existing.map(task => [task.id, task])),
    generatedIds = new Set(generated.map(value => value.task.id)),
    moved = existing.filter(task => !generatedIds.has(task.id));
  return generated.map(({ book, task }) => {
    const old = byId.get(task.id) ?? findBookUpdateTask(moved, book);
    if (old) {
      const index = moved.indexOf(old);
      if (index >= 0) moved.splice(index, 1);
    }
    return {
      ...task,
      id: old?.id ?? task.id,
      enable: old?.enable ?? task.enable,
      cron,
    };
  });
}
