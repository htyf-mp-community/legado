import fixture from './fixtures/sourceResponse.native.json';
import { sourceCharsetMatches } from '../src/core/sourceCharset';
import { sourceHtmlCharset, decodeSourceResponse, sourceHeaderCharset } from '../src/core/sourceResponse';
const { Buffer } = require('buffer');

test('matches every candidate, confidence, language and tie order of the unchanged native ICU detector', () => {
  const failures: unknown[] = [];
  for (const row of fixture.cases) {
    const actual = sourceCharsetMatches(new Uint8Array(Buffer.from(row.base64, 'base64')));
    if (JSON.stringify(actual) !== JSON.stringify(row.matches) && failures.length < 8)
      failures.push({ label: row.label, actual, expected: row.matches });
  }
  expect(failures).toEqual([]);
});

test('matches native HTML declarations and fallback detection', () => {
  const failures: unknown[] = [];
  for (const row of fixture.cases) {
    const actual = sourceHtmlCharset(new Uint8Array(Buffer.from(row.base64, 'base64')));
    if (actual !== row.htmlCharset && failures.length < 8) failures.push({ label: row.label, actual, expected: row.htmlCharset });
  }
  expect(failures).toEqual([]);
});

test('matches the pinned ICU response decoder including malformed input and state changes', () => {
  const failures: unknown[] = [];
  for (const row of fixture.cases) {
    let actual: string | null = null, error = false;
    try { actual = decodeSourceResponse(new Uint8Array(Buffer.from(row.base64, 'base64')), row.contentType); }
    catch { error = true; }
    const digest = actual === null ? null : require('crypto').createHash('sha256').update(Buffer.from(actual, 'utf16le')).digest('hex');
    if ((row.icuError ? !error : error || digest !== row.icuDecodedSha256)) {
      let first = 0;
      while (actual && row.icuDecoded && first < actual.length && first < row.icuDecoded.length && actual[first] === row.icuDecoded[first]) first++;
      failures.push({ label: row.label, charset: row.selectedCharset, error, expectedError: row.icuError,
        first, actual: actual?.slice(Math.max(0, first - 4), first + 8), expected: row.icuDecoded?.slice(Math.max(0, first - 4), first + 8),
        actualCode: actual?.charCodeAt(first), expectedCode: row.icuDecoded?.charCodeAt(first), base64: row.base64 });
    }
  }
  expect(failures.slice(0, 8)).toEqual([]);
});

test('matches the unchanged source-pinned OkHttp MediaType parser and ICU charset support', () => {
  const failures: unknown[] = [];
  for (const row of fixture.cases) {
    const actual = sourceHeaderCharset(row.contentType) ?? null;
    if (actual !== row.headerCharset && failures.length < 8) failures.push({ label: row.label, actual, expected: row.headerCharset });
  }
  expect(failures).toEqual([]);
});
