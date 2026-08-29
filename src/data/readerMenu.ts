import { appStorage } from './storage';

const KEY = 'reader.menu.config.v1';

export const READER_MENU_KEYS = [
  'bookmark',
  'highlightRule',
  'editContent',
  'pageAnim',
  'getProgress',
  'coverProgress',
  'reverseContent',
  'simulatedReading',
  'replace',
  'sameTitleRemoved',
  'reSegment',
  'delRubyTag',
  'delHTag',
  'imageStyle',
  'updateToc',
  'effectiveReplaces',
  'log',
  'help',
] as const;

export type ReaderMenuKey = (typeof READER_MENU_KEYS)[number];
export type ReaderMenuConfig = {
  primary: ReaderMenuKey[];
  more: ReaderMenuKey[];
};

const isReaderMenuKey = (value: unknown): value is ReaderMenuKey =>
  typeof value === 'string' &&
  (READER_MENU_KEYS as readonly string[]).includes(value);

export function normalizeReaderMenuConfig(value: unknown): ReaderMenuConfig {
  const raw =
      value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {},
    seen = new Set<ReaderMenuKey>(),
    take = (input: unknown) =>
      Array.isArray(input)
        ? input.filter(
            (item): item is ReaderMenuKey =>
              isReaderMenuKey(item) && !seen.has(item) && !!seen.add(item),
          )
        : [],
    primary = take(raw.primary),
    more = take(raw.more);
  READER_MENU_KEYS.forEach(key => {
    if (!seen.has(key)) primary.push(key);
  });
  return { primary, more };
}

export function loadReaderMenuConfig() {
  const raw = appStorage.getString(KEY);
  if (!raw) return normalizeReaderMenuConfig(undefined);
  try {
    return normalizeReaderMenuConfig(JSON.parse(raw));
  } catch {
    return normalizeReaderMenuConfig(undefined);
  }
}

export function saveReaderMenuConfig(value: ReaderMenuConfig) {
  const normalized = normalizeReaderMenuConfig(value);
  appStorage.set(KEY, JSON.stringify(normalized));
  return normalized;
}

export function moveReaderMenuItem(
  value: ReaderMenuConfig,
  key: ReaderMenuKey,
  direction: -1 | 1,
) {
  const config = normalizeReaderMenuConfig(value),
    section = config.primary.includes(key) ? 'primary' : 'more',
    list = [...config[section]],
    index = list.indexOf(key),
    target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return config;
  [list[index], list[target]] = [list[target], list[index]];
  return { ...config, [section]: list };
}

export function setReaderMenuSection(
  value: ReaderMenuConfig,
  key: ReaderMenuKey,
  section: 'primary' | 'more',
) {
  const config = normalizeReaderMenuConfig(value);
  if (config[section].includes(key)) return config;
  return normalizeReaderMenuConfig({
    primary: config.primary.filter(item => item !== key),
    more: config.more.filter(item => item !== key),
    [section]: [...config[section], key],
  });
}
