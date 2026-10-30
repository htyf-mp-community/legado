import type { Book, ReplaceRule } from '../types';
import { runReplaceRules } from '../data/replaceRules';

export function automaticBookReplacementEnabled(book: Book, defaultEnabled: boolean) {
  return book.useReplaceRules ?? (book.sourceType !== 2 && !/\.epub$/i.test(book.localUri?.split(/[?#]/)[0] ?? '') && defaultEnabled);
}

/** The existing per-book manual mode supplies overrides even when its list is empty. */
export function readerReplacementPolicy(
  rules: ReplaceRule[],
  manualIds: number[] | undefined | null,
  automaticEnabled: boolean,
  preview: boolean,
) {
  const ids = Array.isArray(manualIds) ? manualIds : undefined;
  const manual = ids !== undefined;
  const selected = manual
    ? rules.filter(rule => ids.includes(rule.id) && (rule.scopeTitle || rule.scopeContent))
        .map(rule => ({ ...rule, isEnabled: true, scope: undefined, excludeScope: undefined }))
    : rules;
  const enabled = preview
    ? !manual && !automaticEnabled
    : manual ? selected.length > 0 : automaticEnabled;
  return {
    enabled,
    contentEnabled: enabled && (!manual || selected.some(rule => rule.scopeContent)),
    rules: enabled ? selected : [],
  };
}

/** ContentProcessor uses Kotlin lines()/trim() before any enabled body-rule loop. */
export function trimReplacementLines(value: string) {
  return value.split(/\r\n|[\r\n]/).map(line => line.replace(
    /^[\t-\r\x1C-\x20\p{Zs}\u2028\u2029]+|[\t-\r\x1C-\x20\p{Zs}\u2028\u2029]+$/gu, '',
  )).join('\n');
}

export function runReaderContentRules(
  value: string,
  rules: ReplaceRule[],
  context: { name: string; origin: string },
  enabled: boolean,
) {
  return enabled && value !== 'null'
    ? runReplaceRules(trimReplacementLines(value), rules, 'content', context)
    : { value, hits: [], issues: [] };
}
