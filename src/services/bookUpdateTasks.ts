import type { Book } from '../types';
import { buildBookUpdateTasks } from '../core/bookUpdateTasks';
import { isLocalBook } from '../core/bookKinds';
import { CronSchedule } from '../core/cronSchedule';
import { mergeAutoTasks, updateAutoTasks } from '../data/autoTasks';
export function createBookUpdateTasks(
  books: Book[],
  cron: string,
  nameOf: (book: Book) => string,
) {
  const value = cron.trim();
  if (!CronSchedule.parse(value)) throw new Error('请输入有效的五段 Cron 计划');
  const eligible = books.filter(
    book => !isLocalBook(book) && book.canUpdate !== false,
  );
  if (!eligible.length)
    throw new Error('没有可更新的已选书籍（已过滤本地书籍和禁止更新的书籍）');
  updateAutoTasks(current =>
    mergeAutoTasks(
      current,
      buildBookUpdateTasks(eligible, current, value, nameOf),
    ),
  );
  return eligible.length;
}
