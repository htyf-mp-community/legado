import type { BookChapter, LocalChapter } from '../types';

type ChapterIdentity = { sourceUrl?: string; url?: string; id?: string; title?: string };

/** Native URL identity is the source rule's value, before resolving it for transport. */
export function chapterIdentity(chapter: ChapterIdentity) {
  return chapter.sourceUrl !== undefined
    ? `source:${chapter.sourceUrl}`
    : `url:${chapter.url || chapter.id || ''}`;
}

/** Match each existing chapter at most once, including records from older target builds. */
export function createChapterMatcher(previous: LocalChapter[]) {
  const used = new Set<LocalChapter>();
  return (next: ChapterIdentity, fallbackTitle = false) => {
    const available = (item: LocalChapter) => !used.has(item);
    let match = next.sourceUrl !== undefined
      ? previous.find(item => available(item) && item.sourceUrl === next.sourceUrl)
      : undefined;
    if (!match && next.url)
      match = previous.find(item => available(item) && item.sourceUrl === undefined && item.url === next.url && item.title === next.title)
        ?? previous.find(item => available(item) && item.sourceUrl === undefined && item.url === next.url);
    if (!match && next.sourceUrl === undefined && next.url)
      match = previous.find(item => available(item) && item.url === next.url);
    if (!match && fallbackTitle)
      match = previous.find(item => available(item) && item.title === next.title);
    if (match) used.add(match);
    return match;
  };
}

export function mapRemoteChapters(remote: BookChapter[], fallbackId: string, previous: LocalChapter[] = [], fallbackTitle = false): LocalChapter[] {
  const counts = new Map<string, number>();
  remote.forEach(item => counts.set(item.url, (counts.get(item.url) ?? 0) + 1));
  const match = createChapterMatcher(previous), usedIds = new Set<string>();
  return remote.map(item => {
    const existing = match(item, fallbackTitle);
    let id = existing?.id || (counts.get(item.url)! > 1
      ? `htyf-source:${encodeURIComponent(item.url)}:${encodeURIComponent(item.sourceUrl ?? '')}`
      : item.url || `${fallbackId}:${item.index}`);
    if (usedIds.has(id)) id = `htyf-source:${encodeURIComponent(item.url)}:${encodeURIComponent(item.sourceUrl ?? String(item.index))}`;
    usedIds.add(id);
    return {
      id, title: item.title, content: existing?.content ?? '', url: item.url,
      sourceUrl: item.sourceUrl, baseUrl: item.baseUrl,
      ...(item.variable !== undefined ? { variable: item.variable } : {}),
      ...(item.nextChapterUrl ? { nextChapterUrl: item.nextChapterUrl } : {}),
      isVolume: item.isVolume, isVip: item.isVip, isPay: item.isPay,
      tag: item.tag, wordCount: item.wordCount,
      ...(existing?.danmaku !== undefined ? { danmaku: existing.danmaku } : {}),
      ...(existing?.lyric !== undefined ? { lyric: existing.lyric } : {}),
    };
  });
}
