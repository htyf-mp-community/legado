const { readFileSync } = require('fs');
const { resolve } = require('path');

const screens = [
  'AnnotationManager',
  'AppearanceSettings',
  'AppLogs',
  'AudioPlayer',
  'ReadRecords',
  'ReaderHelp',
  'RemoteBooks',
  'AutoTaskDebug',
  'AutoTaskEditor',
  'AutoTaskManager',
  'BookCache',
  'BookshelfTransfer',
  'BulkBookCache',
  'BookSourceSwitch',
  'ChapterReviews',
  'CoverRuleSettings',
  'DictRuleManager',
  'DirectLinkUpload',
  'DownloadManager',
  'Explore',
  'HighlightRuleManager',
  'LauncherIconSettings',
  'OnlineBookDetail',
  'QrImport',
  'ReplaceRuleEditor',
  'ReplaceRuleManager',
  'Rss',
  'RssReader',
  'RssSourceManager',
  'RuleSubscriptions',
  'SourceDebug',
  'SourceEditor',
  'SourceLogin',
  'SourceManager',
  'TxtTocRuleManager',
  'VideoBookPlayer',
  'VideoPlayer',
];

test.each(screens)('%s keeps user-facing copy in the translator', screen => {
  const source = readFileSync(
    resolve(__dirname, `../src/screens/${screen}.tsx`),
    'utf8',
  );
  expect(source).toContain('useAppTheme');
  expect(source).not.toMatch(/[\u3400-\u9fff]/);
});

test.each(['BookCover', 'InTreeSheet', 'MangaImage'])(
  '%s keeps shared overlay copy in the translator',
  component => {
    const source = readFileSync(
      resolve(__dirname, `../src/components/${component}.tsx`),
      'utf8',
    );
    expect(source).toContain('useAppTheme');
    expect(source).not.toMatch(/[\u3400-\u9fff]/);
  },
);

test('root navigation surfaces keep user-facing copy in the translator', () => {
  const source = readFileSync(resolve(__dirname, '../src/index.tsx'), 'utf8');
  expect(source).toContain('useAppTheme');
  expect(source).not.toMatch(/[\u3400-\u9fff]/);
});
