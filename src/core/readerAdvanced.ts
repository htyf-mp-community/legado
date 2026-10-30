import type { Book } from '../types';
import { processChapterTitle } from './chapterTitle';

export function reverseContentLines(content: string) {
  return content.split(/\r?\n/).reverse().join('\n');
}

/** Remove only the native exact title line, including its optional book prefix. */
export function removeDuplicateChapterTitle(content: string, title: string, bookName = '') {
  return processChapterTitle(content, { title, bookName }).content;
}

export function simulatedChapterCount(
  book: Pick<Book, 'simulatedReading'>,
  total: number,
  now = new Date(),
) {
  const config = book.simulatedReading;
  if (!config?.enabled) return total;
  const start = new Date(`${config.startDate}T00:00:00`);
  if (!Number.isFinite(start.getTime())) return total;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()),
    days = Math.floor((today.getTime() - startDay.getTime()) / 86_400_000) + 1,
    unlocked =
      Math.max(0, Math.floor(config.startChapter)) +
      Math.max(0, days) * Math.max(0, Math.floor(config.dailyChapters));
  return Math.max(0, Math.min(total, unlocked));
}

export function normalizeSimulatedReading(
  value: Partial<NonNullable<Book['simulatedReading']>>,
  total: number,
): NonNullable<Book['simulatedReading']> {
  const start = Math.max(0, Math.min(total, Math.floor(Number(value.startChapter) || 0))),
    daily = Math.max(1, Math.min(total || 1, Math.floor(Number(value.dailyChapters) || 3))),
    date = String(value.startDate ?? '').trim();
  const parsed = new Date(`${date}T00:00:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.getTime() > new Date().setHours(23, 59, 59, 999)
  )
    throw new Error('INVALID_SIMULATED_DATE');
  return { enabled: value.enabled === true, startDate: date, startChapter: start, dailyChapters: daily };
}
