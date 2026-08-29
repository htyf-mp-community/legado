jest.mock('react-native-localize', () => ({
  getLocales: () => [{ languageCode: 'zh' }],
}));
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
import {
  defaultAppPreferences,
  normalizeAppPreferences,
  resolvedLanguage,
} from '../src/data/appPreferences';
import { translator } from '../src/i18n';
test('normalizes appearance preferences', () =>
  expect(
    normalizeAppPreferences({
      themeMode: 'broken' as never,
      language: 'broken' as never,
      highContrast: true,
    }),
  ).toEqual({ ...defaultAppPreferences, highContrast: true }));
test('bounds Android-compatible shared bar elevation while preserving its default', () => {
  expect(normalizeAppPreferences({}).barElevation).toBe(4);
  expect(normalizeAppPreferences({ barElevation: -2 }).barElevation).toBe(0);
  expect(normalizeAppPreferences({ barElevation: 99 }).barElevation).toBe(32);
});
test('resolves system and explicit languages', () => {
  expect(resolvedLanguage('system', [{ languageCode: 'zh' }] as never)).toBe(
    'zh-CN',
  );
  expect(resolvedLanguage('system', [{ languageCode: 'fr' }] as never)).toBe(
    'en',
  );
  expect(resolvedLanguage('en')).toBe('en');
});
test('translates shared application labels', () => {
  expect(translator('zh-CN')('settings')).toBe('设置');
  expect(translator('en')('settings')).toBe('Settings');
});
test('translates primary navigation and interpolates counts', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect([
    en('bookshelf'),
    en('explore'),
    en('subscriptions'),
    en('mine'),
  ]).toEqual(['Bookshelf', 'Explore', 'Subscriptions', 'Mine']);
  expect(en('selectedBooks', { count: 3 })).toBe('3 selected');
  expect(zh('deleteBooksDescription', { count: 2 })).toBe(
    '将删除 2 本书及其书架记录。',
  );
});
test('translates reader controls, settings and accessibility actions', () => {
  const en = translator('en');
  expect([
    en('previousChapter'),
    en('toc'),
    en('reviews'),
    en('nextChapter'),
  ]).toEqual(['Previous', 'Contents', 'Reviews', 'Next']);
  expect(en('tocCount', { count: 12 })).toBe('Contents · 12 chapters');
  expect(en('decrease', { name: en('fontSize') })).toBe('Decrease Font size');
});
test('translates online detail, content search, annotation, reviews and video surfaces', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('chapterCount', { count: 12 })).toBe('Contents (12 chapters)');
  expect(en('searchResultCount', { count: 3 })).toBe('3 results');
  expect(en('bookmarksCount', { count: 2 })).toBe('Bookmarks (2)');
  expect(en('viewReplies', { count: 4 })).toBe('View 4 replies');
  expect(en('lineNumber', { number: 2 })).toBe('Line 2');
  expect(zh('deleteHighlight')).toBe('删除高亮');
});
test('translates cover, dictionary and highlight rule management', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('dictRuleTitle', { count: 3 })).toBe('Dictionary rules (3)');
  expect(en('highlightRuleTitle', { count: 2 })).toBe('Highlight rules (2)');
  expect(en('ruleItemsImported', { count: 4 })).toBe('Imported 4 rules');
  expect(zh('coverRuleSaved')).toBe('封面规则已保存');
});
test('translates replacement-rule management, editing and preview', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('replaceRuleTitle', { count: 5 })).toBe('Replacement rules (5)');
  expect(en('filterReplacePlaceholder')).toBe('Search name, group, or rule');
  expect(en('replacePreviewDefault')).toContain('preview');
  expect(zh('deleteReplaceRuleTitle')).toBe('删除替换规则？');
});
test('translates HTTP TTS and TXT TOC rule management', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('httpTtsRuleTitle', { count: 2 })).toBe('HTTP TTS (2)');
  expect(en('pauseDurationMs')).toContain('ms');
  expect(en('txtTocRuleTitle', { count: 3 })).toBe('TXT TOC rules (3)');
  expect(zh('deleteTocRuleTitle')).toBe('删除目录规则？');
});
test('translates local import and export workflows', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('unsupportedEbook', { name: 'a.pdf' })).toBe(
    'a.pdf: only TXT, EPUB, or MOBI is supported; skipped',
  );
  expect(en('chaptersRecognized', { name: 'book.epub', count: 8 })).toBe(
    'book.epub: 8 chapters found',
  );
  expect(zh('exportAndShare', { format: 'PDF' })).toBe('导出并分享 PDF');
});
test('translates backup and WebDAV workflows', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('backupSummary', { date: '2026-01-01', count: 12 })).toBe(
    '2026-01-01 · 12 data entries',
  );
  expect(en('actionFailed', { name: en('uploadBackup') })).toBe(
    'Upload backup failed',
  );
  expect(zh('recognizedFiles', { files: 'bookshelf.json' })).toBe(
    '已识别：bookshelf.json',
  );
});
test('translates management screen states and actions', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('downloadManagerTitle', { count: 4 })).toBe('Downloads (4)');
  expect(
    en('downloadProgress', { state: en('downloading'), percent: 35 }),
  ).toBe('Downloading · 35%');
  expect(en('deleteNamedItem', { name: 'Episode 1' })).toBe('Delete Episode 1');
  expect(en('cacheProgress', { completed: 7, total: 10, failed: 1 })).toBe(
    '7 / 10 · 1 failed',
  );
  expect(zh('launcherRefreshHint')).toBe('桌面可能需要几秒刷新');
});
test('translates book-source management, editor and debug states', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('sourceManagerTitle', { count: 4 })).toBe('Book sources (4)');
  expect(en('filterSourcesPlaceholder')).toBe('Filter by name, URL, or group');
  expect(en('loginNamedSource', { name: 'Demo' })).toBe('Log in to Demo');
  expect(en('advancedJsonInvalid')).toBe(
    'Advanced configuration is not valid JSON',
  );
  expect(en('sourceNameRequired')).toBe('Enter a book source name');
  expect(en('debugStageFailed', { stage: 'Search', error: 'HTTP 503' })).toBe(
    'Search failed: HTTP 503',
  );
  expect(en('debugNoChapter')).toContain('no chapter');
  expect(zh('sourcesImported', { count: 3 })).toBe('已导入 3 个书源');
});
test('translates source-switch progress, partial failure and candidate actions', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('sourceCandidateSummaryFailed', { count: 4, failed: 2 })).toBe(
    '4 candidates; 2 sources failed',
  );
  expect(en('chooseSourceCandidate', { name: 'Demo', source: 'Mirror' })).toBe(
    'Switch to Demo from Mirror',
  );
  expect(zh('switchingToSource', { name: '备用源' })).toBe(
    '正在切换到 备用源…',
  );
});
test('translates explore categories, pagination and isolated source failures', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('loadingExplorePage', { page: 3 })).toBe('Loading page 3…');
  expect(en('exploreBookCount', { count: 12 })).toBe('12 books');
  expect(en('exploreSourcesSkipped', { count: 2 })).toBe(
    '2 explore sources had invalid configuration and were skipped',
  );
  expect(zh('loadNextPage')).toBe('加载下一页');
});
test('translates RSS list, reader, source editor and login states', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('refreshingRss', { name: 'News' })).toBe('Refreshing News…');
  expect(en('rssArticlesFetched', { count: 9 })).toBe('Fetched 9 articles');
  expect(en('chooseRssCategory', { name: 'Tech' })).toBe(
    'Choose RSS category Tech',
  );
  expect(en('rssInvalidSort')).toContain('invalid');
  expect(en('rssContentRefreshed')).toBe('Article content refreshed');
  expect(en('showOriginalPage')).toBe('Show original page');
  expect(en('rssSourceManagerTitle', { count: 3 })).toBe('RSS sources (3)');
  expect(en('rssNextPageRule')).toBe('List next page');
  expect(en('customLoginJsBlocked')).toContain('QuickJS');
  expect(zh('loadMoreArticles')).toBe('加载更多文章');
});
test('translates rule-subscription preview and validation states', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('ruleSubscriptionTitle', { count: 3 })).toBe(
    'Rule subscriptions (3)',
  );
  expect(
    en('remoteRuleSummary', {
      total: 8,
      type: en('bookSourcesType'),
      changes: 2,
    }),
  ).toBe('Remote data contains 8 Book sources; 2 are new or changed.');
  expect(zh('ruleSubDuplicateUrl', { name: '常用订阅' })).toBe(
    '订阅地址已存在（常用订阅）',
  );
});
test('translates direct-link upload actions and typed errors', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('directLinkUploadTitle')).toBe('Direct-link upload');
  expect(en('directUploadHttp', { detail: 'HTTP 503 offline' })).toBe(
    'Upload failed: HTTP 503 offline',
  );
  expect(zh('builtInRuleNamed', { name: '网盘' })).toBe('选择内置规则：网盘');
});
test('translates media players and shared reading surfaces', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('audioSegmentsSummary', { chapter: 'Chapter 1', count: 3 })).toBe(
    'Chapter 1 · 3 audio segments',
  );
  expect(
    en('sourceSearchCompleteFailed', { success: 2, total: 3, failed: 1 }),
  ).toContain('1 rules are incompatible');
  expect(en('namedBookCover', { name: 'Demo' })).toBe('Cover for Demo');
  expect(zh('mangaPageFailed', { page: 4 })).toBe('第 4 页加载失败');
});
test('translates reading-record totals, sorting and confirmation', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('readDuration', { hours: 1, minutes: 2, seconds: 3 })).toBe(
    '1h 2m 3s',
  );
  expect(en('sortByDuration')).toBe('By duration');
  expect(zh('clearReadRecordsTitle')).toBe('清空全部阅读记录？');
});
test('translates QR permission, classification and import states', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('qrRulesSummary', { type: en('qrBookSource'), count: 2 })).toBe(
    'Book source JSON · 2 items',
  );
  expect(en('cameraPermissionMissing')).toContain('photo library');
  expect(zh('rulesImported', { count: 2, type: '书源' })).toBe(
    '已导入 2 个书源',
  );
});
test('translates scheduled-task management, editor, debug and login states', () => {
  const en = translator('en'),
    zh = translator('zh-CN');
  expect(en('autoTaskTitle', { count: 4 })).toBe('Scheduled tasks (4)');
  expect(en('nextSchedule', { date: '10:30' })).toBe('Next run: 10:30');
  expect(en('selectedTasks', { count: 3 })).toBe('3 tasks selected');
  expect(en('importFromFile')).toBe('Import from local file');
  expect(en('namedLogin', { name: 'Daily check' })).toBe('Daily check login');
  expect(en('syncedCookies', { count: 3 })).toBe('3 cookies synced');
  expect(en('autoTaskJsBlocked')).toContain('QuickJS');
  expect(zh('taskLoginJsBlocked')).toContain('QuickJS');
  expect(zh('deleteAutoTaskTitle', { name: '签到' })).toBe('删除任务“签到”？');
});
