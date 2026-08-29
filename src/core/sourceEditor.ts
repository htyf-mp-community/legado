import { parseBookSources } from '../data/sources';
import type { BookSource } from '../types';

export type SourceEditorErrorCode = 'advancedJsonInvalid' | 'advancedJsonObject' | 'sourceNameRequired' | 'sourceUrlRequired';

export class SourceEditorError extends Error {
  constructor(readonly code: SourceEditorErrorCode) {
    super(code);
  }
}

export function buildEditedBookSource(source: BookSource, advancedJson: string) {
  if (!source.bookSourceName.trim()) throw new SourceEditorError('sourceNameRequired');
  if (!source.bookSourceUrl.trim()) throw new SourceEditorError('sourceUrlRequired');
  let extra: unknown;
  try {
    extra = JSON.parse(advancedJson);
  } catch {
    throw new SourceEditorError('advancedJsonInvalid');
  }
  if (!extra || Array.isArray(extra) || typeof extra !== 'object') throw new SourceEditorError('advancedJsonObject');
  return parseBookSources(JSON.stringify({
    ...source,
    ...(extra as object),
    bookSourceName: source.bookSourceName,
    bookSourceUrl: source.bookSourceUrl,
    bookSourceGroup: source.bookSourceGroup,
    searchUrl: source.searchUrl,
    exploreUrl: source.exploreUrl,
    loginUrl: source.loginUrl,
    bookSourceComment: source.bookSourceComment,
    enabled: source.enabled,
    enabledExplore: source.enabledExplore,
    enabledCookieJar: source.enabledCookieJar === true,
  }))[0];
}
