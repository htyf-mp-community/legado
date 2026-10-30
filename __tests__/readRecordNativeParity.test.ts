import native from './fixtures/readRecords.native.json';
import {
  decodeReadRecordAuthors,
  displayReadRecordAuthors,
  mergeReadRecordAuthors,
  hasReadRecord,
} from '../src/core/readRecordAuthors';
import {
  formatNativeReadDuration,
  formatReadRecordDate,
  mergeReadRecordRows,
  selectReadRecords,
} from '../src/core/readRecord';

test('native author codec and cross-device display match unchanged Gson/Kotlin helpers', () => {
  for (const row of [...native.authors, ...native.display]) {
    expect({
      input: row.value,
      decoded: decodeReadRecordAuthors(row.value),
      display: displayReadRecordAuthors(row.value),
    }).toEqual({ input: row.value, ...row.expected });
  }
  for (const row of native.merge)
    expect({
      a: row.a,
      b: row.b,
      value: mergeReadRecordAuthors(row.a, row.b),
    }).toEqual({ a: row.a, b: row.b, value: row.expected });
});
test('read badge identities match the unchanged native ReadRecordIndex', () => {
  for (const row of native.index)
    expect({
      row,
      contains: hasReadRecord(row.rows, row.name, row.author),
    }).toEqual({ row, contains: row.expected });
});
test('all signed Long duration strings match unchanged formatDuring', () => {
  for (const row of native.duration)
    expect(formatNativeReadDuration(row.value)).toBe(row.expected);
});
test('finite collation pairs match the explicitly frozen ICU 77.1 profiles', () => {
  const chinese = new Intl.Collator('zh-Hans-CN'),
    localized = new Intl.Collator('en-US');
  for (const row of native.compare)
    expect({
      a: row.a,
      b: row.b,
      chinese: Math.sign(chinese.compare(row.a, row.b)),
      localized: Math.sign(localized.compare(row.a, row.b)),
    }).toEqual({ a: row.a, b: row.b, ...row.expected });
});
test('grouping, SQL LIKE HAVING and stable sorts match the original DAO SQL', () => {
  const chinese = new Intl.Collator('zh-Hans-CN'),
    localized = new Intl.Collator('en-US');
  for (const row of native.database) {
    const result = selectReadRecords(
      row.rows,
      row.query,
      row.sort as 'name' | 'duration' | 'recent',
      localized.compare,
      chinese.compare,
    ).map(({ displayAuthor: _, ...item }) => item);
    expect({
      rows: row.rows,
      query: row.query,
      sort: row.sort,
      result,
    }).toEqual({
      rows: row.rows,
      query: row.query,
      sort: row.sort,
      result: row.expected,
    });
    expect(row.rows.filter(item => item.bookName !== row.deleteName)).toEqual(
      row.remaining,
    );
  }
});
test('device-scoped restoration matches the unchanged Restore block and DAO insert method', () => {
  for (const row of native.restore)
    expect(
      mergeReadRecordRows(row.current, row.incoming, row.ownDeviceId),
    ).toEqual(row.expected);
});

test('local Gregorian dates retain exact Long days across the frozen timezone profiles', () => {
  const readers = new Map<string, (ms: number) => number>();
  for (const row of native.date) {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone: row.zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const offset = (ms: number) => {
      const parts = Object.fromEntries(
        formatter.formatToParts(ms).map(item => [item.type, item.value]),
      );
      const local = Date.UTC(
        +parts.year,
        +parts.month - 1,
        +parts.day,
        +parts.hour % 24,
        +parts.minute,
        +parts.second,
      );
      return (Math.floor(ms / 1000) * 1000 - local) / 60000;
    };
    if (!readers.has(row.zone)) readers.set(row.zone, offset);
    expect({
      row,
      value: formatReadRecordDate(row.value, readers.get(row.zone)!),
    }).toEqual({
      row,
      value: row.expected.value,
    });
  }
});

test('SQLite SUM overflow and exact integer aggregation retain signed Long behavior', () => {
  for (const row of native.sqlEdges) {
    if ('error' in row)
      expect(() => selectReadRecords(row.rows, '', 'name')).toThrow('overflow');
    else
      expect(
        selectReadRecords(row.rows, '', 'name').map(
          ({ displayAuthor: _, ...item }) => item,
        ),
      ).toEqual(row.expected);
  }
});
