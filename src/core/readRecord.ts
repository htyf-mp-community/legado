import { sqliteLike } from './sqliteLike';
import {
  displayReadRecordAuthors,
  mergeReadRecordAuthors,
  readRecordAuthorIsBlank,
  READ_RECORD_AUTHOR_SEPARATOR,
} from './readRecordAuthors';

/** Milliseconds stored as a number when safe, otherwise an exact decimal Android Long string. */
export type ReadRecordLong = number | string;
/** deviceId + exact bookName is the native key; bookId is an optional legacy target navigation hint. */
export type ReadRecord = {
  deviceId?: string;
  bookId?: string;
  bookName: string;
  author: string;
  readTime: ReadRecordLong;
  lastRead: ReadRecordLong;
};
export type ReadRecordShow = {
  bookName: string;
  author: string;
  displayAuthor: string;
  readTime: ReadRecordLong;
  lastRead: ReadRecordLong;
};
export type ReadRecordSort = 'name' | 'duration' | 'recent';
const MIN = -(1n << 63n),
  MAX = (1n << 63n) - 1n;
/** Parse a bounded native Long without coercing arbitrary JSON or losing decimal-string precision. */
export function readRecordLong(value: unknown, fallback = 0n): bigint {
  try {
    const number =
      typeof value === 'number' && Number.isInteger(value)
        ? BigInt(value)
        : typeof value === 'string' && /^-?\d+$/.test(value)
          ? BigInt(value)
          : fallback;
    return number >= MIN && number <= MAX ? number : fallback;
  } catch {
    return fallback;
  }
}
/** JSON-safe representation of an exact signed Long. */
export const storeReadRecordLong = (value: bigint): ReadRecordLong =>
  value >= BigInt(Number.MIN_SAFE_INTEGER) &&
  value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : value.toString();
const compareLong = (a: ReadRecordLong, b: ReadRecordLong) => {
  const x = readRecordLong(a),
    y = readRecordLong(b);
  return x < y ? -1 : x > y ? 1 : 0;
};
const sum = (a: bigint, b: bigint) => {
  const value = a + b;
  if (value < MIN || value > MAX)
    throw new RangeError('SQLite integer sum overflow');
  return value;
};
export const readRecordIdentity = (
  row: Pick<ReadRecord, 'deviceId' | 'bookName'>,
) => JSON.stringify([row.deviceId ?? '', row.bookName]);

/** Keep legacy target rows readable without rewriting persisted data merely by opening the page. */
export function normalizeReadRecord(value: unknown): ReadRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.bookName !== 'string' ||
    (row.deviceId !== undefined && typeof row.deviceId !== 'string')
  )
    return null;
  return {
    ...row,
    bookName: row.bookName,
    author: typeof row.author === 'string' ? row.author : '',
    readTime: storeReadRecordLong(readRecordLong(row.readTime)),
    lastRead: storeReadRecordLong(readRecordLong(row.lastRead)),
    ...(typeof row.bookId === 'string' ? { bookId: row.bookId } : {}),
    ...(typeof row.deviceId === 'string' ? { deviceId: row.deviceId } : {}),
  } as ReadRecord;
}

/** Aggregate all device rows BEFORE SQLite LIKE HAVING; stable sort ties inherit localized DAO order. */
export function selectReadRecords(
  records: ReadRecord[],
  query: string,
  sort: ReadRecordSort,
  localized: (a: string, b: string) => number = (a, b) => a.localeCompare(b),
  chinese: (a: string, b: string) => number = (a, b) =>
    a.localeCompare(b, 'zh-Hans-CN'),
): ReadRecordShow[] {
  const groups = new Map<
    string,
    { time: bigint; last: bigint; authors: string[] }
  >();
  for (const record of records) {
    const current = groups.get(record.bookName) ?? {
      time: 0n,
      last: readRecordLong(record.lastRead),
      authors: [],
    };
    current.time = sum(current.time, readRecordLong(record.readTime));
    const last = readRecordLong(record.lastRead);
    if (last > current.last) current.last = last;
    current.authors.push(record.author);
    groups.set(record.bookName, current);
  }
  const result = [...groups]
    .map(([bookName, row]) => {
      const author = row.authors.join(READ_RECORD_AUTHOR_SEPARATOR);
      return {
        bookName,
        author,
        displayAuthor: displayReadRecordAuthors(author),
        readTime: storeReadRecordLong(row.time),
        lastRead: storeReadRecordLong(row.last),
      };
    })
    .filter(
      row =>
        sqliteLike(row.bookName, `%${query}%`) ||
        sqliteLike(row.author, `%${query}%`),
    )
    .sort((a, b) => localized(a.bookName, b.bookName));
  return result.sort((a, b) =>
    sort === 'duration'
      ? compareLong(b.readTime, a.readTime)
      : sort === 'recent'
        ? compareLong(b.lastRead, a.lastRead)
        : chinese(a.bookName, b.bookName),
  );
}

/** SQL SUM across every row, independent of the search and displayed groups. */
export function totalReadRecordTime(records: ReadRecord[]): ReadRecordLong {
  return storeReadRecordLong(
    records.reduce(
      (value, row) => sum(value, readRecordLong(row.readTime)),
      0n,
    ),
  );
}

/** Source formatDuring uses total hours, omits zero units and formats negative durations as 0秒. */
export function formatNativeReadDuration(
  value: ReadRecordLong | bigint,
): string {
  const ms = typeof value === 'bigint' ? value : readRecordLong(value),
    h = ms / 3600000n,
    m = (ms % 3600000n) / 60000n,
    s = (ms % 60000n) / 1000n;
  return (
    `${h > 0n ? `${h}小时` : ''}${m > 0n ? `${m}分钟` : ''}${s > 0n ? `${s}秒` : ''}` ||
    '0秒'
  );
}

const DAY = 86400000n,
  GREGORIAN_CYCLE = 146097n * DAY;
const systemOffset = (epochMs: number) => new Date(epochMs).getTimezoneOffset();
type OffsetReader = (epochMs: number) => number;
type OffsetRules = {
  standard: number;
  saving: number;
  start?: number;
  end?: number;
};
const offsetRules = new WeakMap<OffsetReader, Map<string, OffsetRules>>();
function civilDate(epochMs: bigint) {
  let z = epochMs / DAY;
  if (epochMs < 0n && epochMs % DAY) z--;
  z += 719468n;
  const era = z / 146097n,
    day = z - era * 146097n;
  const yearInEra = (day - day / 1460n + day / 36524n - day / 146096n) / 365n;
  let year = yearInEra + era * 400n;
  const dayInYear =
    day - (365n * yearInEra + yearInEra / 4n - yearInEra / 100n);
  const monthIndex = (5n * dayInYear + 2n) / 153n;
  const date = dayInYear - (153n * monthIndex + 2n) / 5n + 1n;
  const month = monthIndex + (monthIndex < 10n ? 3n : -9n);
  if (month <= 2n) year++;
  return { year, month, date };
}
function futureRules(year: number, offset: OffsetReader): OffsetRules {
  // A 400-year future cycle is representable by Date and uses the host's final
  // recurring timezone rules. Measure transition instants rather than guessing DST months.
  const jan = offset(Date.UTC(year, 0, 1)),
    jul = offset(Date.UTC(year, 6, 1));
  const zone =
    offset === systemOffset
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : '';
  const key = `${zone}/${year}/${jan}/${jul}`;
  let cache = offsetRules.get(offset);
  if (!cache) {
    cache = new Map();
    offsetRules.set(offset, cache);
  }
  const found = cache.get(key);
  if (found) return found;
  const transitions: Array<{ at: number; before: number; after: number }> = [];
  let previous = Date.UTC(year - 1, 11, 30),
    before = offset(previous),
    standard = before,
    minimum = before;
  const end = Date.UTC(year + 1, 0, 2);
  while (previous < end) {
    const next = Math.min(end, previous + Number(DAY)),
      after = offset(next);
    standard = Math.max(standard, after);
    minimum = Math.min(minimum, after);
    if (after !== before) {
      let left = previous,
        right = next;
      while (right - left > 1) {
        const middle = Math.floor((left + right) / 2);
        if (offset(middle) === before) left = middle;
        else right = middle;
      }
      transitions.push({ at: right, before, after });
    }
    previous = next;
    before = after;
  }
  const own = transitions.filter(
    item => new Date(item.at - item.before * 60000).getUTCFullYear() === year,
  );
  const result = {
    standard,
    saving: standard - minimum,
    start: own.find(item => item.before > item.after)?.at,
    end: own.find(item => item.before < item.after)?.at,
  };
  cache.set(key, result);
  return result;
}
function longDateOffset(ms: bigint, offset: OffsetReader): number {
  if (ms < BigInt(Date.UTC(2400, 0, 1))) return offset(Number(ms));
  const utcYear = civilDate(ms).year;
  const initial = futureRules(2400 + Number(utcYear % 400n), offset);
  const localStandard = BigInt.asIntN(
    64,
    ms - BigInt(Math.round(initial.standard * 60000)),
  );
  if (localStandard < 0n) return initial.standard;
  const year = civilDate(localStandard).year,
    representativeYear = 2400 + Number(year % 400n);
  const rules = futureRules(representativeYear, offset);
  if (rules.start === undefined || rules.end === undefined || !rules.saving)
    return rules.standard;
  const delta = ((year - BigInt(representativeYear)) / 400n) * GREGORIAN_CYCLE;
  const project = (value: number | undefined) =>
    value === undefined ? undefined : BigInt.asIntN(64, BigInt(value) + delta);
  const start = project(rules.start)!,
    end = project(rules.end)!;
  // Signed Long transition boundaries can wrap in the final representable year.
  // Build the effective daylight intervals with those same boundaries, not unbounded dates.
  const intervals =
    start <= end
      ? [[start, end]]
      : [
          [project(futureRules(representativeYear - 1, offset).start), end],
          [start, project(futureRules(representativeYear + 1, offset).end)],
        ];
  const daylight = intervals.some(
    ([left, right]) =>
      left !== undefined && right !== undefined && ms >= left && ms < right,
  );
  return rules.standard - (daylight ? rules.saving : 0);
}
/**
 * Source yyyy-MM-dd in the local timezone; nonpositive timestamps have no date label.
 * Retains exact Long days and final-rule/Long-boundary behavior under the recorded JDK
 * Gregorian profiles. Other runtime timezone/calendar versions remain an acceptance boundary.
 * The optional adapter returns minutes west of UTC at representable Unix millisecond instants.
 */
export function formatReadRecordDate(
  value: ReadRecordLong,
  offsetMinutes: OffsetReader = systemOffset,
): string {
  const ms = readRecordLong(value);
  if (ms <= 0n) return '';
  const local =
    ms - BigInt(Math.round(longDateOffset(ms, offsetMinutes) * 60000));
  const { year, month, date } = civilDate(local);
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${date.toString().padStart(2, '0')}`;
}

/** Compact only old target duplicate IDs into the native key, preserving accumulated time/authors. */
export function coalesceReadRecordRows(records: ReadRecord[]): ReadRecord[] {
  const rows = new Map<string, ReadRecord>();
  for (const row of records) {
    const key = readRecordIdentity(row),
      previous = rows.get(key);
    rows.set(
      key,
      previous
        ? {
            ...previous,
            readTime: storeReadRecordLong(
              sum(
                readRecordLong(previous.readTime),
                readRecordLong(row.readTime),
              ),
            ),
            lastRead:
              compareLong(previous.lastRead, row.lastRead) >= 0
                ? previous.lastRead
                : row.lastRead,
            author: mergeReadRecordAuthors(previous.author, row.author),
          }
        : row,
    );
  }
  return [...rows.values()];
}

/** Restore DAO insert semantics: own counter never decreases; foreign counters replace; authors always merge. */
export function mergeReadRecordRows(
  current: ReadRecord[],
  incoming: ReadRecord[],
  ownDeviceId?: string,
): ReadRecord[] {
  const rows = new Map(
    coalesceReadRecordRows(current).map(row => [readRecordIdentity(row), row]),
  );
  for (const row of incoming) {
    const key = readRecordIdentity(row),
      previous = rows.get(key);
    const keep =
      previous &&
      ownDeviceId !== undefined &&
      (row.deviceId ?? '') === ownDeviceId &&
      compareLong(previous.readTime, row.readTime) >= 0;
    if (keep && readRecordAuthorIsBlank(row.author)) continue;
    const value = keep ? previous : { ...previous, ...row };
    rows.set(key, {
      ...value,
      author: mergeReadRecordAuthors(previous?.author ?? '', row.author),
    });
  }
  return [...rows.values()];
}
