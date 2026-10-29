import type { BookSource } from '../types';
const foldAscii = (value: string) =>
  value.replace(/[A-Z]/g, character => character.toLowerCase());
/** SourcePicker uses SQLite LIKE: ASCII case folding, % and _ wildcards, and untrimmed input. */
export function selectableBatchSources(sources: BookSource[], query: string) {
  const pattern = new RegExp(
    [...foldAscii(query)]
      .map(character =>
        character === '%'
          ? '.*'
          : character === '_'
            ? '.'
            : character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      )
      .join(''),
    'su',
  );
  return sources
    .filter(
      source =>
        source.enabled &&
        (!query ||
          [
            source.bookSourceName,
            source.bookSourceUrl,
            source.bookSourceGroup,
            source.bookSourceComment,
          ].some(
            value =>
              typeof value === 'string' && pattern.test(foldAscii(value)),
          )),
    )
    .sort((a, b) => a.customOrder - b.customOrder);
}
export const batchSourceDisplayName = (source: BookSource) =>
  source.bookSourceGroup?.trim()
    ? `${source.bookSourceName} (${source.bookSourceGroup})`
    : source.bookSourceName;
