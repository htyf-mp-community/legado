jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
import native from './fixtures/readRecordImport.native.json';
import { convertLegacyBackup } from '../src/data/legacyBackup';
import { parseNativeReadRecords } from '../src/core/readRecordImport';
import { prepareRestoreEntries } from '../src/core/restoreBackupEntries';

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(123);
});
afterEach(() => jest.restoreAllMocks());

const convert = (raw: string) =>
  convertLegacyBackup(
    {
      'readRecord.json': raw,
      'bookSource.json':
        '[{"bookSourceUrl":"https://fixture.invalid","bookSourceName":"control"}]',
    },
    123,
  );

test('native list parsing rejects a null item instead of silently restoring only its neighbours', () => {
  const row = native.cases.find(item => item.raw === '[{},null]')!;
  expect(row.error).toBe('JsonSyntaxException');
  const result = convert(row.raw);
  expect(result.importedFiles).toEqual(['bookSource.json']);
  expect(result.payload.entries['reading.records.v1']).toBeUndefined();
  expect(result.warnings).toEqual([expect.stringContaining('readRecord.json')]);
});

test('native Long parse failure rejects the whole read-record file, without zeroing a fractional counter', () => {
  const row = native.cases.find(item => item.raw === '[{"readTime":1.25}]')!;
  expect(row.error).toBe('JsonSyntaxException');
  const result = convert(row.raw);
  expect(result.importedFiles).toEqual(['bookSource.json']);
  expect(result.payload.entries['reading.records.v1']).toBeUndefined();
});

test('native Gson InputStream decoding matches every frozen list, field and numeric case', () => {
  for (const row of native.cases) {
    if (row.error) {
      expect(() => parseNativeReadRecords(row.raw, () => 123)).toThrow();
    } else {
      const records = parseNativeReadRecords(row.raw, () => 123).map(
        record => ({
          ...record,
          readTime: String(record.readTime),
          lastRead: String(record.lastRead),
        }),
      );
      expect({ raw: row.raw, records }).toEqual({
        raw: row.raw,
        records: row.records!.map(record => ({
          ...record,
          lastRead: record.lastRead === '@now' ? '123' : record.lastRead,
        })),
      });
    }
  }
});

test('conversion retains native decoded fields, and skips an entire rejected record file while importing another category', () => {
  for (const row of native.cases) {
    const result = convert(row.raw);
    if (row.error) {
      expect({ raw: row.raw, files: result.importedFiles }).toEqual({
        raw: row.raw,
        files: ['bookSource.json'],
      });
      expect(result.payload.entries['reading.records.v1']).toBeUndefined();
      expect(result.warnings).toEqual([
        expect.stringContaining('readRecord.json'),
      ]);
    } else {
      expect(result.importedFiles).toEqual([
        'readRecord.json',
        'bookSource.json',
      ]);
      expect(result.warnings).toEqual([]);
      const records = JSON.parse(
        String(result.payload.entries['reading.records.v1'].value),
      );
      expect(records).toEqual(parseNativeReadRecords(row.raw, () => 123));
    }
  }
});

test('explicit null String fields stay observable until restore, which rejects them without inventing defaults', () => {
  for (const field of ['deviceId', 'bookName', 'author']) {
    const preview = convert(`[{"bookName":"valid-before"},{"${field}":null}]`);
    expect(
      JSON.parse(
        String(preview.payload.entries['reading.records.v1'].value),
      )[1][field],
    ).toBeNull();
    expect(() => prepareRestoreEntries({}, preview.payload.entries)).toThrow(
      '不能为 null',
    );
  }
});

test('missing lastRead takes each entity construction clock rather than the backup metadata timestamp', () => {
  const now = jest.mocked(Date.now);
  now.mockReturnValueOnce(1000).mockReturnValueOnce(1001);
  const result = convert('[{},{}]');
  const rows = JSON.parse(
    String(result.payload.entries['reading.records.v1'].value),
  );
  expect(rows.map((row: { lastRead: number }) => row.lastRead)).toEqual([
    1000, 1001,
  ]);
  expect(result.payload.createdAt).toBe(123);
});
