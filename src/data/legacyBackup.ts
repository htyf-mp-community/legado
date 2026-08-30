import type {
  Book,
  BookGroup,
  Bookmark,
  Highlight,
  RssArticle,
} from '../types';
import { APP_STORAGE_ID } from './storage';
import type { BackupPayload } from './backup';
import { parseBookSources } from './sources';
import { parseRssSources } from './rss';
import { parseReplaceRules } from './replaceRules';
import { parseTxtTocRules } from './txtTocRules';
import { parseDictRules } from './dictRules';
import { parseHighlightRules } from './highlightRules';
import { parseKeyboardAssists } from './keyboardAssists';
import { parseRuleSubscriptions } from './ruleSubscriptions';
import { parseAutoTasks } from './autoTasks';
import {
  normalizeReaderPreferences,
  type ReaderPreferences,
} from './readerPreferences';
import { legacyReaderInfoTemplate } from '../core/readerInfoTemplate';

type Entry = { type: 'string'; value: string };
type ObjectValue = Record<string, unknown>;
const array = (raw: string, name: string): ObjectValue[] => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`${name} 不是有效的 JSON`);
  }
  if (!Array.isArray(value)) throw new Error(`${name} 必须是数组`);
  return value.filter(
    item => item && typeof item === 'object',
  ) as ObjectValue[];
};
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const number = (value: unknown, fallback = 0) =>
  Number.isFinite(value) ? Number(value) : fallback;
const entry = (value: unknown): Entry => ({
  type: 'string',
  value: JSON.stringify(value),
});
const stableId = (value: string, fallback: string) => value.trim() || fallback;
function cookies(raw: string): Record<string, Entry> {
  const result: Record<string, Entry> = {};
  for (const value of array(raw, 'cookies.json')) {
    const source = text(value.url),
      header = text(value.cookie),
      pairs: Record<string, string> = {};
    for (const pair of header.split(';')) {
      const separator = pair.indexOf('=');
      if (separator > 0)
        pairs[pair.slice(0, separator).trim()] = pair
          .slice(separator + 1)
          .trim();
    }
    if (source && Object.keys(pairs).length)
      result[`source-cookie.v1.${encodeURIComponent(source)}`] = {
        type: 'string',
        value: JSON.stringify(pairs),
      };
  }
  return result;
}
export type LegacyMediaMapping = {
  coverRoot?: string;
  coverFiles?: Record<string, string>;
  bgRoot?: string;
  bgFiles?: Record<string, string>;
};
const baseName = (value: string) =>
  value.replace(/\\/g, '/').split('/').pop() ?? '';
export function convertLegacyReaderPreferences(
  raw: string,
  media?: LegacyMediaMapping,
): ReaderPreferences {
  const values = array(raw, 'readConfig.json'),
    value = values[0] ?? {},
    textSize = number(value.textSize, 19),
    extra = number(value.lineSpacingExtra, 12),
    animation = number(value.pageAnim, 1),
    left = number(value.paddingLeft, 26),
    right = number(value.paddingRight, left),
    top = number(value.paddingTop, 6),
    bottom = number(value.paddingBottom, top),
    background = (path: unknown) => {
      const relative = media?.bgFiles?.[baseName(text(path))];
      return relative && media?.bgRoot
        ? `file://${media.bgRoot}/${relative}`
        : '';
    },
    template = (key: string, legacyKey: string, fallback: number) =>
      typeof value[key] === 'string'
        ? text(value[key])
        : legacyReaderInfoTemplate(value[legacyKey] ?? fallback);
  return normalizeReaderPreferences({
    fontSize: textSize,
    lineHeight: textSize + extra,
    mode: animation === 3 ? 'scroll' : 'page',
    pageAnimation:
      animation === 0 || animation === 2
        ? 'cover'
        : animation === 4
          ? 'none'
          : 'slide',
    letterSpacing: number(value.letterSpacing, 0.1),
    paragraphSpacing: number(value.paragraphSpacing, 2),
    paragraphIndent:
      typeof value.paragraphIndent === 'string'
        ? value.paragraphIndent
        : '　　',
    textBold: number(value.textBold) === 1,
    contentInsetHorizontal: (left + right) / 2,
    contentInsetVertical: (top + bottom) / 2,
    paperBackground: text(value.bgStr),
    paperForeground: text(value.textColor),
    nightBackground: text(value.bgStrNight),
    nightForeground: text(value.textColorNight),
    epaperBackground: text(value.bgStrEInk),
    epaperForeground: text(value.textColorEInk),
    paperBackgroundImage:
      number(value.bgType) > 0 ? background(value.bgStr) : '',
    nightBackgroundImage:
      number(value.bgTypeNight) > 0 ? background(value.bgStrNight) : '',
    epaperBackgroundImage:
      number(value.bgTypeEInk) > 0 ? background(value.bgStrEInk) : '',
    showReaderHeader: number(value.headerMode) === 1,
    showReaderFooter: number(value.footerMode) !== 1,
    readerInfoTextSize: number(value.tipTextSize, 12),
    headerLeftTemplate: template('tipHeaderLeftTemplate', 'tipHeaderLeft', 2),
    headerMiddleTemplate: template(
      'tipHeaderMiddleTemplate',
      'tipHeaderMiddle',
      0,
    ),
    headerRightTemplate: template(
      'tipHeaderRightTemplate',
      'tipHeaderRight',
      3,
    ),
    footerLeftTemplate: template('tipFooterLeftTemplate', 'tipFooterLeft', 1),
    footerMiddleTemplate: template(
      'tipFooterMiddleTemplate',
      'tipFooterMiddle',
      0,
    ),
    footerRightTemplate: template(
      'tipFooterRightTemplate',
      'tipFooterRight',
      6,
    ),
  });
}

function books(raw: string, media?: LegacyMediaMapping): Book[] {
  return array(raw, 'bookshelf.json').map((value, index) => {
    const id = stableId(text(value.bookUrl), `legacy-book-${index}`),
      chapterIndex = Math.max(0, number(value.durChapterIndex)),
      chapterTitle =
        text(value.durChapterTitle) || text(value.latestChapterTitle) || '正文',
      legacyCover = text(value.persistedCoverUrl) || text(value.customCoverUrl),
      relative = legacyCover && media?.coverFiles?.[baseName(legacyCover)],
      coverUrl =
        relative && media?.coverRoot
          ? `file://${media.coverRoot}/${relative}`
          : legacyCover || text(value.coverUrl) || undefined,
      durChapterTime = number(value.durChapterTime, Date.now());
    return {
      id,
      name: text(value.name) || '未命名书籍',
      author: text(value.author),
      intro: text(value.customIntro) || text(value.intro),
      chapterTitle,
      content: '',
      chapters: [
        {
          id: `${id}#${chapterIndex}`,
          title: chapterTitle,
          content: '',
          url: text(value.durChapterUrl) || undefined,
        },
      ],
      currentChapterIndex: 0,
      progress: Math.max(0, number(value.durChapterPos)),
      updatedAt: durChapterTime,
      durChapterTime,
      latestChapterTime: number(value.latestChapterTime, durChapterTime),
      order: number(value.order, index),
      origin: text(value.origin) || undefined,
      originName: text(value.originName) || undefined,
      bookUrl: text(value.bookUrl) || undefined,
      tocUrl: text(value.tocUrl) || undefined,
      coverUrl,
      sourceType: number(value.type),
    };
  });
}
function groups(raw: string): BookGroup[] {
  return array(raw, 'bookGroup.json')
    .filter(value => number(value.groupId) > 0)
    .map((value, index) => ({
      id: String(value.groupId),
      name: text(value.groupName) || `分组 ${index + 1}`,
      order: number(value.order, index),
      show: value.show !== false,
      enableRefresh: value.enableRefresh !== false,
    }));
}
const groupIds = (mask: number, items: BookGroup[]) =>
  items
    .filter(item => {
      const id = Number(item.id);
      return Number.isSafeInteger(id) && id > 0 && (mask & id) === id;
    })
    .map(item => item.id);
function marks(raw: string, library: Book[]): Bookmark[] {
  return array(raw, 'bookmark.json').map((value, index) => {
    const book = library.find(
        item =>
          item.name === text(value.bookName) &&
          item.author === text(value.bookAuthor),
      ),
      createdAt = number(value.time, Date.now() + index),
      chapterIndex = Math.max(0, number(value.chapterIndex));
    return {
      id: String(createdAt),
      bookId:
        book?.id ?? `legacy:${text(value.bookName)}:${text(value.bookAuthor)}`,
      chapterId: `${book?.id ?? 'legacy'}#${chapterIndex}`,
      chapterTitle: text(value.chapterName),
      position: Math.max(0, number(value.chapterPos)),
      excerpt: text(value.bookText) || text(value.content),
      createdAt,
    };
  });
}
function highlights(raw: string): Highlight[] {
  return array(raw, 'highlight.json').map((value, index) => {
    const start = Math.max(0, number(value.chapterPos)),
      end = Math.max(
        start + 1,
        number(value.chapterPosEnd, start + text(value.bookText).length || 1),
      );
    let color = '#f2cc60';
    try {
      const style = JSON.parse(text(value.style)) as {
        color?: unknown;
        backgroundColor?: unknown;
      };
      color = text(style.backgroundColor) || text(style.color) || color;
    } catch {}
    return {
      id: String(number(value.time, Date.now() + index)),
      bookId: text(value.bookUrl) || `legacy:${text(value.bookName)}`,
      chapterId:
        text(value.chapterUrl) ||
        `${text(value.bookUrl)}#${number(value.chapterIndex)}`,
      start,
      end,
      text: text(value.bookText),
      color,
      note: text(value.note) || undefined,
      createdAt: number(value.time, Date.now() + index),
    };
  });
}
function rssStars(raw: string): RssArticle[] {
  return array(raw, 'rssStar.json').map((value, index) => ({
    id: text(value.origin) + ':' + stableId(text(value.link), String(index)),
    origin: text(value.origin),
    sort: text(value.sort),
    title: text(value.title) || '未命名文章',
    link: text(value.link),
    pubDate: text(value.pubDate) || undefined,
    description: text(value.description) || undefined,
    content: text(value.content) || undefined,
    image: text(value.image) || undefined,
    read: true,
    starred: true,
    readTime: number(value.readTime) || undefined,
  }));
}

export type LegacyBackupPreview = {
  payload: BackupPayload;
  importedFiles: string[];
  warnings: string[];
};
export function convertLegacyBackup(
  files: Record<string, string>,
  createdAt = Date.now(),
  media?: LegacyMediaMapping,
): LegacyBackupPreview {
  const entries: Record<string, Entry> = {},
    importedFiles: string[] = [],
    warnings: string[] = [];
  let library: Book[] = [],
    bookGroups: BookGroup[] = [];
  const add = (file: string, key: string, parse: (raw: string) => unknown) => {
    const raw = files[file];
    if (raw === undefined) return;
    try {
      entries[key] = entry(parse(raw));
      importedFiles.push(file);
    } catch (error) {
      warnings.push(
        `${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  if (files['bookGroup.json']) {
    try {
      bookGroups = groups(files['bookGroup.json']);
      entries['bookshelf.groups.v1'] = entry(bookGroups);
      importedFiles.push('bookGroup.json');
    } catch (error) {
      warnings.push(
        `bookGroup.json: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (files['bookshelf.json']) {
    try {
      library = books(files['bookshelf.json'], media);
      const originals = array(files['bookshelf.json'], 'bookshelf.json');
      library = library.map((book, index) => ({
        ...book,
        groupIds: groupIds(number(originals[index]?.group), bookGroups),
      }));
      entries['library.v1'] = entry(library);
      importedFiles.push('bookshelf.json');
    } catch (error) {
      warnings.push(
        `bookshelf.json: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (files['bookmark.json'])
    add('bookmark.json', 'annotations.bookmarks.v1', raw =>
      marks(raw, library),
    );
  if (files['highlight.json'])
    add('highlight.json', 'annotations.highlights.v1', highlights);
  add('bookSource.json', 'sources.v1', raw => parseBookSources(raw));
  add('rssSources.json', 'rss.sources.v1', raw => parseRssSources(raw));
  add('rssStar.json', 'rss.articles.v1', rssStars);
  add('replaceRule.json', 'replace.rules.v1', raw => parseReplaceRules(raw));
  add('txtTocRule.json', 'txt.toc.rules.v1', raw => parseTxtTocRules(raw));
  add('dictRule.json', 'dictionary.rules.v1', raw => parseDictRules(raw));
  add('highlightRule.json', 'highlight.rules.v1', raw =>
    parseHighlightRules(raw),
  );
  add('keyboardAssists.json', 'keyboard-assists.v1', raw =>
    parseKeyboardAssists(raw),
  );
  add('sourceSub.json', 'rule.subscriptions.v1', raw =>
    parseRuleSubscriptions(raw),
  );
  add('autoTask.json', 'auto.tasks.v1', raw => parseAutoTasks(raw));
  add('runtimeSourceCache.json', 'legacy.runtime-source-cache.v1', raw =>
    array(raw, 'runtimeSourceCache.json'),
  );
  add('servers.json', 'legacy.servers.v1', raw => array(raw, 'servers.json'));
  if (files['cookies.json']) {
    try {
      Object.assign(entries, cookies(files['cookies.json']));
      importedFiles.push('cookies.json');
    } catch (error) {
      warnings.push(
        `cookies.json: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (files['readConfig.json']) {
    try {
      entries['reader.preferences.v1'] = entry(
        convertLegacyReaderPreferences(files['readConfig.json'], media),
      );
      entries['legacy.read-config.v1'] = {
        type: 'string',
        value: files['readConfig.json'],
      };
      importedFiles.push('readConfig.json');
    } catch (error) {
      warnings.push(
        `readConfig.json: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (!importedFiles.length)
    throw new Error(
      warnings.length
        ? `备份中没有可导入的数据：${warnings.join('；')}`
        : '未识别到 Legado Android 备份文件',
    );
  return {
    payload: {
      format: 'legado-htyf-backup',
      version: 1,
      createdAt,
      storageId: APP_STORAGE_ID,
      entries,
    },
    importedFiles,
    warnings,
  };
}
