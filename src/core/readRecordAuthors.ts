import {
  compactGsonJson,
  parseGsonLegacyJson,
  quoteGsonString,
} from './gsonJson';

/** Native ReadRecordAuthors encoding; U+001E tags a JSON author set, U+001F joins device rows. */
export const READ_RECORD_AUTHOR_PREFIX = '\u001eauthors:';
export const READ_RECORD_AUTHOR_SEPARATOR = '\u001f';
/** Kotlin isBlank whitespace, shared by author identity and restore merge decisions. */
export const readRecordAuthorIsBlank = (value: string) =>
  /^[\u0009-\u000d\u001c-\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/.test(
    value,
  );
/** Decode one native author field; malformed/empty sets keep the source's unknown-author marker. */
export function decodeReadRecordAuthors(value: string): string[] {
  if (readRecordAuthorIsBlank(value)) return [''];
  if (!value.startsWith(READ_RECORD_AUTHOR_PREFIX)) return [value];
  try {
    const parsed = parseGsonLegacyJson(
      value.slice(READ_RECORD_AUTHOR_PREFIX.length),
    );
    if (
      parsed.kind !== 'array' ||
      parsed.values.some(
        item => item.kind === 'literal' && item.value === 'null',
      )
    )
      return [''];
    const authors = [
      ...new Set(
        parsed.values
          .map(item =>
            item.kind === 'string' ? item.value : compactGsonJson(item),
          )
          .filter(item => !readRecordAuthorIsBlank(item)),
      ),
    ];
    return authors.length ? authors : [''];
  } catch {
    return [''];
  }
}

/** Merge a device/name row's author set with Kotlin UTF-16 sorting; no whitespace trimming. */
export function mergeReadRecordAuthors(
  current: string,
  incoming: string,
): string {
  const authors = [
    ...new Set(
      [
        ...decodeReadRecordAuthors(current),
        ...decodeReadRecordAuthors(incoming),
      ].filter(item => !readRecordAuthorIsBlank(item)),
    ),
  ].sort();
  return authors.length === 0
    ? ''
    : authors.length === 1
      ? authors[0]
      : READ_RECORD_AUTHOR_PREFIX +
        `[${authors.map(quoteGsonString).join(',')}]`;
}

/** Display the raw DAO GROUP_CONCAT field as the source's sorted, distinct author list. */
export function displayReadRecordAuthors(value: string): string {
  if (readRecordAuthorIsBlank(value)) return '';
  return [
    ...new Set(
      value
        .split(READ_RECORD_AUTHOR_SEPARATOR)
        .flatMap(decodeReadRecordAuthors)
        .filter(item => !readRecordAuthorIsBlank(item)),
    ),
  ]
    .sort()
    .join('、');
}

/** Native search badge identity: exact title; blank authors on either side fall back to title only. */
export function hasReadRecord(
  records: Array<{ bookName: string; author: string }>,
  name: string,
  author: string,
): boolean {
  return records.some(
    record =>
      record.bookName === name &&
      (readRecordAuthorIsBlank(author) ||
        decodeReadRecordAuthors(record.author).some(
          item => readRecordAuthorIsBlank(item) || item === author,
        )),
  );
}
