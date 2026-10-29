import type { BookSource } from '../types';
import { UnsupportedRuleError } from './errors';
import { buildSourceRequest } from './sourceRequest';
import { coverSourceOrigin, type BookCoverLayers } from './bookCover';
/** Image requests use GET, with the same source credentials and URL-option headers as the native loader. */
export function buildBookCoverRequest(
  uri: string,
  book: BookCoverLayers,
  sources: BookSource[],
  persisted = true,
) {
  const origin = coverSourceOrigin(book, persisted),
    source = sources.find(value => value.bookSourceUrl === origin);
  // TODO(htyf-native): coverDecodeJs needs the sandbox bridge recorded in docs/htyf-migration-gaps.md.
  if (typeof source?.coverDecodeJs === 'string' && source.coverDecodeJs.trim())
    throw new UnsupportedRuleError(
      'JavaScript 封面解密',
      source.bookSourceName,
    );
  const request = buildSourceRequest(
    source ?? {
      bookSourceUrl: uri,
      bookSourceName: '',
      bookSourceType: 0,
      customOrder: 0,
      enabled: true,
      enabledExplore: false,
    },
    uri,
    '',
    1,
    false,
  );
  return { uri: request.url, headers: request.headers };
}
