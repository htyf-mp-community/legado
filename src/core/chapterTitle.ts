import { compileSourceRegex } from './sourceRegex';

export type ChapterTitleRemoval = { content: string; removed: boolean };
export type ChapterTitleOptions = {
  bookName: string;
  title: string;
  displayTitle?: string;
  replaceEnabled?: boolean;
  skipRemoval?: boolean;
};

const quote = (value: string) => value.replace(/[{}()[\].+*?^$\\|]/g, '\\$&');

/**
 * ContentProcessor's exact leading-title line match. ASCII title whitespace is
 * optional; a replacement display title is matched literally on the fallback.
 * The source's literal "null" sentinel and per-chapter exclusion are preserved.
 * Returns unmodified stored content or the suffix after the matched title line.
 */
export function processChapterTitle(
  content: string,
  options: ChapterTitleOptions,
): ChapterTitleRemoval {
  if (options.skipRemoval || content === 'null') return { content, removed: false };
  const name = quote(options.bookName);
  const prefix = `(?:[\\t\\n\\x0B\\f\\r ]|\\p{P}${name ? `|${name}` : ''})*`;
  const suffix = '[\\t\\x0B\\f\\p{Zs}]*(?:(?:\\r\\n|\\r|\\n)[\\t\\n\\x0B\\f\\r ]*|$)';
  const candidates = [quote(options.title).replace(/[\t\n\v\f\r ]+/g, '[\\t\\n\\x0B\\f\\r ]*')];
  if (options.replaceEnabled) candidates.push(quote(options.displayTitle ?? options.title));
  for (const title of candidates) {
    const match = compileSourceRegex(`^${prefix}${title}${suffix}`, 'u').exec(content);
    if (match) return { content: content.slice(match[0].length), removed: true };
  }
  return { content, removed: false };
}
