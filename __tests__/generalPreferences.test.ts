jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
import { normalizeGeneralPreferences } from '../src/data/generalPreferences';

test('normalizes general preferences and limits user agent', () => {
  expect(
    normalizeGeneralPreferences({
      defaultHomePage: 'broken' as never,
      userAgent: `  ${'x'.repeat(600)}  `,
    }),
  ).toEqual({
    defaultHomePage: 'bookshelf',
    showExplore: true,
    showRss: true,
    userAgent: 'x'.repeat(512),
    threadCount: 4,
    preDownloadNum: 2,
    sourceEditMaxLine: 20,
    autoClearExpired: true,
    autoRefreshBookshelf: false,
    onlyUpdateRead: false,
    replaceEnableDefault: true,
    tocUiUseReplace: true,
    tocCountWords: false,
    defaultToRead: false,
    imageRetainNum: 0,
    showMangaUi: true,
    autoChangeSource: true,
  });
});

test('bounds concurrency and chapter prefetch settings', () => {
  expect(
    normalizeGeneralPreferences({ threadCount: 99, preDownloadNum: -2 }),
  ).toMatchObject({ threadCount: 16, preDownloadNum: 0 });
  expect(
    normalizeGeneralPreferences({ threadCount: 0, preDownloadNum: 99 }),
  ).toMatchObject({ threadCount: 1, preDownloadNum: 10 });
});

test('falls back when the selected home page is hidden', () => {
  expect(
    normalizeGeneralPreferences({ defaultHomePage: 'rss', showRss: false }),
  ).toMatchObject({ defaultHomePage: 'bookshelf', showRss: false });
  expect(
    normalizeGeneralPreferences({
      defaultHomePage: 'explore',
      showExplore: false,
    }),
  ).toMatchObject({ defaultHomePage: 'bookshelf', showExplore: false });
});
