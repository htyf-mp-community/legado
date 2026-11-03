import knownNames from '../data/sourceCharsetAvailability.json';

const names = new Set(knownNames);

/** Preserve the previously supported iconv-lite 0.7.3 charset name set. */
export function canEncodeSourceCharset(name: string): boolean {
  return names.has(name.toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g, ''));
}
