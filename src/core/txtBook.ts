import type { Book, LocalChapter, TxtTocRule } from '../types';

export function splitTxtChapters(
  raw: string,
  rules: TxtTocRule[],
): LocalChapter[] {
  const content = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const enabled = rules
    .filter(rule => rule.enable)
    .sort((a, b) => a.serialNumber - b.serialNumber);
  for (const tocRule of enabled) {
    const regex = new RegExp(tocRule.rule, 'gmu');
    const matches = [...content.matchAll(regex)].filter(
      match => match.index !== undefined,
    );
    if (!matches.length) continue;
    const chapters: LocalChapter[] = [];
    const firstIndex = matches[0].index ?? 0;
    if (firstIndex > 0 && content.slice(0, firstIndex).trim())
      chapters.push({
        id: 'chapter-preamble',
        title: '正文开始',
        content: content.slice(0, firstIndex).trim(),
      });
    matches.forEach((match, index) => {
      const start = match.index ?? 0;
      const end = matches[index + 1]?.index ?? content.length;
      const title =
        match[0].replace(regex, tocRule.replacement).trim() || match[0].trim();
      const bodyStart = start + match[0].length;
      chapters.push({
        id: `chapter-${start}`,
        title,
        content: content.slice(bodyStart, end).trim(),
      });
    });
    return chapters;
  }
  return [{ id: 'chapter-0', title: '正文', content: content.trim() }];
}

export function createTxtBook(
  uri: string,
  fileName: string,
  content: string,
  rules: TxtTocRule[],
): Book {
  const chapters = splitTxtChapters(content, rules);
  const name = fileName.replace(/\.[^.]+$/, '').trim() || '本地书籍';
  return {
    id: `local:${encodeURIComponent(uri)}`,
    name,
    author: '本地导入',
    intro: `本地 TXT · ${chapters.length} 章`,
    chapterTitle: chapters[0].title,
    content: chapters[0].content,
    chapters,
    currentChapterIndex: 0,
    progress: 0,
    updatedAt: Date.now(),
  };
}
