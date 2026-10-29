import type { AutoTaskRule } from '../data/autoTasks';
import type { Book, LocalChapter } from '../types';
import { loadLibrary, updateLibrary } from '../data/library';
import { loadSources } from '../data/sources';
import { addAppLog } from '../data/appLog';
import { loadAppPreferences } from '../data/appPreferences';
import { translator } from '../i18n';
import { isLocalBook } from '../core/bookKinds';
import { applyBookCatalogue, fetchBookCatalogue } from '../core/bookCatalogue';
import {
  loadBookInfo,
  loadChapterContent,
  loadChapters,
} from '../core/webBook';
import {
  cacheTaskChapters,
  countNewTaskChapters,
  newTaskChapters,
  taskBoolean,
  taskInteger,
  taskRecord,
  taskString,
  taskValue,
  type TaskAction,
} from '../core/autoTaskProtocol';
export type TaskNotification = {
  id: number;
  title: string;
  content: string;
  priority: 'high' | 'low' | 'default';
};
type Effects = {
  notify?: (notification: TaskNotification) => Promise<boolean>;
  pause?: (ms: number) => Promise<void>;
};
const hashCode = (text: string) => {
  let hash = 0;
  for (let index = 0; index < text.length; index++)
    hash = (Math.imul(31, hash) + text.charCodeAt(index)) | 0;
  return hash;
};
const notificationId = (base: number, value: number) =>
  base + ((value & 0x7fffffff) % 10000);
const time = () => {
  const date = new Date(),
    pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const format = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
async function notify(notification: TaskNotification, effects: Effects) {
  if (effects.notify) {
    try {
      return await effects.notify(notification);
    } catch (cause) {
      addAppLog('Automatic task notification failed', cause);
      return false;
    }
  }
  // TODO(htyf-native): connect a local-notification bridge; see docs/htyf-migration-gaps.md.
  // The pinned host/SDK has no local-notification bridge. Keep the source's skipped result, never claim delivery.
  addAppLog(
    'Automatic task notification skipped: local notification bridge is unavailable in the pinned HTYF host',
  );
  return false;
}
function unchanged(book: Book, before: Book) {
  return (
    book.id === before.id &&
    book.origin === before.origin &&
    book.bookUrl === before.bookUrl
  );
}
export async function executeAutoTaskProtocolAction(
  action: TaskAction,
  task: AutoTaskRule,
  effects: Effects = {},
) {
  const t = translator(loadAppPreferences().language),
    type = taskString(action, 'type')?.toLowerCase();
  if (type === 'notify') {
    const values = { task: task.name, time: time() },
      title = format(
        taskString(action, 'title') ?? t('taskNotificationTitle'),
        values,
      ).slice(0, 200),
      content = format(
        taskString(action, 'content') ??
          t('taskNotificationContent', { name: task.name }),
        values,
      ).slice(0, 4000),
      level = taskString(action, 'level')?.toLowerCase(),
      delivered = await notify(
        {
          id: notificationId(
            30000,
            taskInteger(action, 'id') ??
              hashCode(`${task.name}|${title}|${content}`),
          ),
          title,
          content,
          priority: ['high', 'error', 'fail', 'failed'].includes(level ?? '')
            ? 'high'
            : level === 'low'
              ? 'low'
              : 'default',
        },
        effects,
      );
    return `${delivered ? 'Notification' : 'Notification skipped'}: ${title}`;
  }
  if (type !== 'refreshtoc')
    throw new Error(`Unsupported automatic task action: ${type ?? ''}`);
  const url = taskString(action, 'bookUrl');
  if (!url) throw new Error('refreshToc requires bookUrl');
  const books = await loadLibrary(),
    before =
      books.find(book => book.bookUrl === url || book.id === url) ??
      (taskString(action, 'generatedBy') === 'bookUpdate'
        ? books.find(
            book =>
              book.name === taskString(action, 'bookName') &&
              book.author === (taskString(action, 'bookAuthor') ?? ''),
          )
        : undefined);
  if (!before) throw new Error('refreshToc book was not found');
  if (
    taskBoolean(action, 'respectCanUpdate', false) &&
    before.canUpdate === false
  )
    return t('taskBookUpdatesDisabled', {
      name: before.name || before.bookUrl || before.id,
    });
  // Generated bookshelf tasks exclude local books; local-file rescan stays on the local-book migration checklist.
  if (isLocalBook(before)) throw new Error('本地书籍的定时目录重建尚未迁移');
  const source = (await loadSources()).find(
    value => value.bookSourceUrl === before.origin,
  );
  if (!source) throw new Error('未找到对应书源，请换源');
  const { info, chapters } = await fetchBookCatalogue(
    before,
    source,
    loadBookInfo,
    loadChapters,
  );
  let ready: Book | undefined;
  await updateLibrary(current =>
    current.map(book => {
      if (!unchanged(book, before)) return book;
      ready = {
        ...applyBookCatalogue(book, before, info, chapters),
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
      return ready;
    }),
  );
  if (!ready) throw new Error('书籍在更新期间已删除或换源');
  const prepared = ready,
    after = prepared.chapters ?? [],
    old = before.chapters ?? [],
    newCount = countNewTaskChapters(old, after),
    latest =
      after.filter(chapter => !chapter.isVolume).at(-1)?.title ??
      after.at(-1)?.title ??
      '',
    notification = taskRecord(taskValue(action, 'notify')),
    cache = taskRecord(taskValue(action, 'cache'));
  let notified = false,
    cached = 0;
  if (
    notification &&
    taskBoolean(notification, 'enable', true) &&
    newCount > 0 &&
    newCount >= (taskInteger(notification, 'minCount') ?? 1)
  ) {
    const values = {
      book: prepared.name,
      author: prepared.author,
      newCount,
      chapter: latest,
      time: time(),
    };
    notified = await notify(
      {
        id: notificationId(50000, hashCode(prepared.bookUrl || prepared.id)),
        title: format(
          taskString(notification, 'title') ??
            t('taskBookUpdatedTitle', { name: prepared.name }),
          values,
        ).slice(0, 200),
        content: format(
          taskString(notification, 'content') ??
            t(latest ? 'taskBookUpdatedContent' : 'taskBookUpdatedCount', {
              count: newCount,
              chapter: latest,
            }),
          values,
        ).slice(0, 4000),
        priority: 'default',
      },
      effects,
    );
  }
  if (cache && taskBoolean(cache, 'enable', false)) {
    cached = await cacheTaskChapters(
      newTaskChapters(old, after),
      async (chapter: LocalChapter) => {
        const current = (await loadLibrary()).find(book =>
          unchanged(book, prepared),
        );
        if (!current) {
          const error = new Error('Book changed while caching');
          error.name = 'AbortError';
          throw error;
        }
        if (current.chapters?.find(value => value.url === chapter.url)?.content)
          return;
        const content = await loadChapterContent(source, {
          url: chapter.url!,
          title: chapter.title,
          index: after.indexOf(chapter),
          bookUrl: prepared.bookUrl ?? '',
          baseUrl: chapter.baseUrl ?? prepared.tocUrl ?? prepared.bookUrl ?? '',
          isVolume: false,
          isVip: !!chapter.isVip,
          isPay: !!chapter.isPay,
        });
        if (!content.trim())
          throw new Error(`Failed to cache ${prepared.name}: ${chapter.title}`);
        let committed = false;
        await updateLibrary(currentBooks =>
          currentBooks.map(book => {
            if (
              !unchanged(book, prepared) ||
              !book.chapters?.some(value => value.url === chapter.url)
            )
              return book;
            committed = true;
            const next = book.chapters?.map(value =>
              value.url === chapter.url ? { ...value, content } : value,
            );
            return {
              ...book,
              chapters: next,
              content:
                next?.[book.currentChapterIndex ?? 0]?.content ?? book.content,
            };
          }),
        );
        if (!committed) {
          const error = new Error('Book changed while caching');
          error.name = 'AbortError';
          throw error;
        }
      },
      (chapter, cause) =>
        addAppLog(
          `Automatic task cache failed: ${prepared.name} - ${chapter.title}`,
          cause,
        ),
      effects.pause,
    );
  }
  return `${prepared.name || prepared.bookUrl || prepared.id}: +${newCount}${notified ? ', notified' : ''}${cached > 0 ? `, cached ${cached}` : ''}`;
}
