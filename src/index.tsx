import { ReaderProgressSlider } from './components/ReaderProgressSlider';
import { CoverThumbnailRenderer } from './components/CoverThumbnailRenderer';
import { inspectWebDavBackupEntry } from './core/remoteBackupArchive';
import { restoreBackupPreview } from './core/restoreBackupPreview';
import { displayBookIntro } from './core/bookMetadata';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import jssdk from '@htyf-mp/js-sdk';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  Switch,
  AppState,
  Linking,
  Share,
  View,
  useWindowDimensions,
} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import Svg, { Circle, Path } from 'react-native-svg';
import Clipboard from '@react-native-clipboard/clipboard';
import Slider from '@react-native-community/slider';
import { VolumeManager } from 'react-native-volume-manager';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, useIsFocused } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { PageHeader } from './components/PageHeader';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { MineScreen } from './screens/MineScreen';
import { AppHelp } from './screens/AppHelp';
import { SourceIcon } from './components/SourceIcon';
import { InTreeSheet } from './components/InTreeSheet';
import { BookCover } from './components/BookCover';
import { MangaImage } from './components/MangaImage';
import { parseMangaImages } from './core/manga';
import { pruneMangaCache } from './core/mangaCache';
import { loadLibrary, saveLibrary, updateLibrary } from './data/library';
import { useLibrary } from './hooks/useLibrary';
import { useBookVisit } from './hooks/useBookVisit';
import { useBookCatalogue } from './hooks/useBookCatalogue';
import {
  ReaderPositionBridge,
  type ReaderPositionHandle,
} from './components/ReaderPositionBridge';
import { readerContentSegments } from './core/readerImages';
import { BookCatalogueStatus } from './components/BookCatalogueStatus';
import { applyBookUpdate } from './core/bookUpdate';
import { loadBookGroups } from './data/bookshelf';
import { applyBookshelfRefresh } from './core/bookshelfRefresh';
import { bookReadingScreen } from './core/bookKinds';
import {
  listBookmarks,
  listHighlights,
  removeBookmark,
  removeHighlight,
  saveBookmark,
  saveHighlight,
} from './data/annotations';
import type { Book, Bookmark, Highlight, RootTab, SearchBook } from './types';
import { SourceManager } from './screens/SourceManager';
import { SourceEditor } from './screens/SourceEditor';
import { ContentSearchSheet } from './components/ContentSearchSheet';
import { ReaderMenuConfigSheet } from './components/ReaderMenuConfigSheet';
import { BookshelfView } from './components/BookshelfView';
import { useBookshelfPreferences } from './hooks/useBookshelfPreferences';
import { useBookshelfRefresh } from './hooks/useBookshelfRefresh';
import { AnnotationManager } from './screens/AnnotationManager';
import { BackupRestore } from './screens/BackupRestore';
import { Explore } from './screens/Explore';
import { Rss } from './screens/Rss';
import { RssReader } from './screens/RssReader';
import { ReplaceRuleManager } from './screens/ReplaceRuleManager';
import { ReplaceRuleEditor } from './screens/ReplaceRuleEditor';
import { LocalBookImport } from './screens/LocalBookImport';
import { TxtTocRuleManager } from './screens/TxtTocRuleManager';
import { DirectLinkUpload } from './screens/DirectLinkUpload';
import { OnlineBookDetail } from './screens/OnlineBookDetail';
import { SourceLogin } from './screens/SourceLogin';
import { SourceDebug } from './screens/SourceDebug';
import { BookSourceSwitch } from './screens/BookSourceSwitch';
import { BookCache } from './screens/BookCache';
import { AudioPlayer } from './screens/AudioPlayer';
import { HttpTtsManager } from './screens/HttpTtsManager';
import { ReadAloudSheet } from './components/ReadAloudSheet';
import { ReadAloudIcon } from './components/ReadAloudIcon';
import { DictRuleManager } from './screens/DictRuleManager';
import { RuleHighlightedText } from './components/RuleHighlightedText';
import { ReaderRichContent } from './components/ReaderRichContent';
import {
  applyReaderTagPreferences,
  applyReaderSpecialStylePreference,
  protectReaderHtmlMarkers,
  type ReaderImage,
} from './core/readerImages';
import {
  previewReplacementRules,
  shouldCancelTwoFingerPreview,
} from './core/readerReplacePreview';
import { shouldBlockReaderHardwareBack } from './core/readerBack';
import { loadHighlightRules, saveHighlightRules } from './data/highlightRules';
import {
  loadReaderMenuConfig,
  saveReaderMenuConfig,
  type ReaderMenuKey,
} from './data/readerMenu';
import { reSegmentText } from './core/txtEncoding';
import { HighlightRuleManager } from './screens/HighlightRuleManager';
import { RssSourceManager } from './screens/RssSourceManager';
import { RssSourceDebug } from './screens/RssSourceDebug';
import { CoverRuleSettings } from './screens/CoverRuleSettings';
import { CoverSettings } from './screens/CoverSettings';
import { WelcomeSettings } from './screens/WelcomeSettings';
import { WelcomeOverlay } from './components/WelcomeOverlay';
import { loadWelcomePreferences } from './data/welcomePreferences';
import {
  findNewRemoteBackup,
  runDueAutomaticBackup,
} from './core/automaticBackup';
import {
  loadBackupPreferences,
  saveBackupPreferences,
} from './data/backupPreferences';
import { restoreRemoteLocalBook } from './core/remoteLocalBookRestore';
import { clearExpiredApplicationCache } from './core/cacheMaintenance';
import { BookExport } from './screens/BookExport';
import { QrImport } from './screens/QrImport';
import { AutoTaskManager } from './screens/AutoTaskManager';
import { AutoTaskEditor } from './screens/AutoTaskEditor';
import { AutoTaskDebug } from './screens/AutoTaskDebug';
import { AppearanceSettings } from './screens/AppearanceSettings';
import { BottomBarSkins } from './screens/BottomBarSkins';
import { KeyboardAssists } from './screens/KeyboardAssists';
import { loadActiveBottomBarSkin } from './data/bottomBarSkins';
import { AppLogs } from './screens/AppLogs';
import { ReadRecords } from './screens/ReadRecords';
import { RemoteBooks } from './screens/RemoteBooks';
import { AddBookByUrl } from './screens/AddBookByUrl';
import { BookEditor } from './screens/BookEditor';
import {
  loadReadRecords,
  recordReadTime,
  selectLastReadBookId,
} from './data/readRecords';
import { AppThemeProvider, useAppTheme } from './theme/AppTheme';
import { runStorageMigrations } from './data/migrations';
import { RuleSubscriptions } from './screens/RuleSubscriptions';
import { VideoPlayer } from './screens/VideoPlayer';
import { DownloadManager } from './screens/DownloadManager';
import { LauncherIconSettings } from './screens/LauncherIconSettings';
import { VideoBookPlayer } from './screens/VideoBookPlayer';
import { ChapterReviews } from './screens/ChapterReviews';
import { Browser } from './screens/Browser';
import { LocalWebService } from './screens/LocalWebService';
import { GeneralSettings } from './screens/GeneralSettings';
import { ReaderSettings } from './screens/ReaderSettings';
import { ReaderHelp } from './screens/ReaderHelp';
import { BookshelfTransfer } from './screens/BookshelfTransfer';
import { BookshelfManage } from './screens/BookshelfManage';
import { BulkBookCache } from './screens/BulkBookCache';
import { About } from './screens/About';
import { AppFileManager } from './screens/AppFileManager';
import { refreshBookshelf } from './core/bookshelfRefresh';
import {
  loadGeneralPreferences,
  saveGeneralPreferences,
  type GeneralPreferences,
} from './data/generalPreferences';
import {
  chapterWordCount,
  collapsedVolumeIds as defaultCollapsedVolumeIds,
  filterReaderBookmarks,
  filterReaderHighlights,
  readableChapterIndex,
  readerBookmarkTarget,
  readerHighlightTarget,
  readerTocEntries,
  reverseBookToc,
} from './core/readerToc';
import { prefetchUpcomingChapters } from './core/chapterPrefetch';
import { volumePageDirection } from './core/volumePaging';
import { loadReviewSummaries } from './core/chapterReviews';
import { createDownload } from './core/mediaDownload';
import { loadDownloads, saveDownloads } from './data/downloads';
import { runDueRuleSubscriptions } from './core/ruleSubscription';
import { loadCoverRule } from './data/coverRule';
import { searchBookCover } from './core/coverRule';
import { displayBookCover } from './core/bookCover';
import { pickReaderBackground } from './core/readerBackground';
import {
  renderReaderInfoTemplate,
  type ReaderInfoValues,
} from './core/readerInfoTemplate';
import {
  defaultReaderPreferences,
  loadReaderPreferences,
  normalizeReaderPreferences,
  readerPalette,
  readerPreferencesForAppTheme,
  saveReaderPreferences,
  type ReaderPreferences,
  type ReaderTheme,
  type PageAnimation,
} from './data/readerPreferences';
import {
  estimatePageCapacity,
  paginateText,
  paginateTextRanges,
  stripSpecialPageBreaks,
} from './core/pagination';
import {
  pullBookmarkGesture,
  pullBookmarkOffset,
  readerTouchAction,
  type PullBookmarkState,
} from './core/readerTouch';
import {
  readerMenuTitle,
  readerMenuTitleDetails,
} from './core/readerMenuTitle';
import {
  normalizeReaderProgressTarget,
  readerProgressState,
} from './core/readerProgress';
import { readerChromeColors } from './core/readerChrome';
import { readerSafeLayout } from './core/readerSafeLayout';
import { useCapsule } from './hooks/useCapsule';
import {
  readerPageColumns,
  reflowPageIndex,
  spreadStart,
} from './core/readerSpread';
import {
  applyReplaceRules,
  effectiveReplaceRuleHits,
  loadReplaceRules,
} from './data/replaceRules';
import { loadSources } from './data/sources';
import { addAppLog } from './data/appLog';
import { loadChapterContent } from './core/webBook';
import { BookSearch } from './screens/BookSearch';
import { autoSwitchSourceForChapter } from './core/bookSourceSwitch';
import {
  clearReaderChapterCache,
  refreshBookMetadata,
  refreshReaderChapter,
  refreshReaderToc,
} from './core/readerRefresh';
import { buildSourceRequest } from './core/sourceRequest';
import { startAutoTaskScheduler } from './services/autoTaskScheduler';
import {
  normalizeSimulatedReading,
  removeDuplicateChapterTitle,
  reverseContentLines,
  simulatedChapterCount,
} from './core/readerAdvanced';
import {
  downloadWebDavBookProgress,
  loadWebDavConfig,
  uploadWebDavBookProgress,
  type RemoteBackupEntry,
  type RemoteBookProgress,
} from './data/remoteBackup';
const tabKeys: RootTab[] = ['bookshelf', 'explore', 'rss', 'mine'];
type RootStackParamList = {
  Home: undefined;
  Book: { bookId: string };
  BookEditor: { bookId: string };
  Reader: { bookId: string; chapterIndex?: number };
  Search: { query?: string; sourceUrl?: string } | undefined;
  Settings: undefined;
  Sources: undefined;
  SourceEditor: { sourceUrl?: string };
  Annotations: undefined;
  Backup: undefined;
  RssReader: { articleId: string };
  ReplaceRules: undefined;
  ReplaceRuleEditor: { ruleId?: number };
  LocalBookImport: { uri?: string } | undefined;
  AddBookByUrl: undefined;
  TxtTocRules: undefined;
  DirectLinkUpload: undefined;
  OnlineBook: { book: SearchBook };
  SourceLogin: {
    sourceUrl?: string;
    rssSourceUrl?: string;
    autoTaskId?: string;
  };
  SourceDebug: { sourceUrl: string };
  BookSourceSwitch: { bookId: string };
  BookCache: { bookId: string };
  AudioPlayer: { bookId: string };
  HttpTts: undefined;
  DictRules: undefined;
  HighlightRules: { ruleId?: number } | undefined;
  RssSources: undefined;
  RssSourceDebug: { sourceUrl: string };
  CoverRule: undefined;
  CoverSettings: undefined;
  WelcomeSettings: undefined;
  BookExport: { bookId: string };
  QrImport:
    | { value?: string; expectedKind?: 'bookSource' | 'rssSource' }
    | undefined;
  AutoTasks: undefined;
  AutoTaskEditor: { taskId?: string } | undefined;
  AutoTaskDebug: { taskId: string };
  Appearance: undefined;
  BottomBarSkins: undefined;
  KeyboardAssists: undefined;
  AppLogs: undefined;
  ReadRecords: undefined;
  RemoteBooks: undefined;
  RuleSubscriptions: undefined;
  VideoPlayer: { url: string; title: string; headers?: Record<string, string> };
  Downloads: undefined;
  LauncherIcon: undefined;
  VideoBook: { bookId: string };
  ChapterReviews: {
    bookId: string;
    chapterIndex: number;
    paragraphIndex?: number;
  };
  Browser: { url?: string } | undefined;
  LocalWebService: undefined;
  FileManager: undefined;
  GeneralSettings: undefined;
  ReaderSettings: undefined;
  ReaderHelp: undefined;
  AppHelp: undefined;
  BookshelfTransfer: undefined;
  BookshelfManage: { groupId: string };
  BulkBookCache: undefined;
  About: undefined;
};
const Stack = createStackNavigator<RootStackParamList>();
function Shell() {
  const { colors, t } = useAppTheme();
  const { books, error: storageError } = useLibrary();
  const [generalPreferences, setGeneralPreferences] = useState(
      loadGeneralPreferences,
    ),
    [tab, setTab] = useState<RootTab>(
      () => loadGeneralPreferences().defaultHomePage,
    ),
    [loading, setLoading] = useState(true),
    [readError, setLibraryError] = useState(''),
    [skinRevision, setSkinRevision] = useState(0),
    translation = useRef(t),
    startupRedirected = useRef(false);
  const libraryError = storageError?.message ?? readError;
  useEffect(() => {
    if (!storageError) setLibraryError('');
  }, [storageError]);
  translation.current = t;
  const readShelf = useCallback(async () => {
    setLoading(true);
    setLibraryError('');
    try {
      const value = await loadLibrary();
      const preferences = loadGeneralPreferences();
      if (preferences.autoRefreshBookshelf) {
        try {
          await refreshBookshelf(value, await loadSources(), {
            concurrency: preferences.threadCount,
            onlyUpdateRead: preferences.onlyUpdateRead,
            onBookUpdated: (before, next) =>
              updateLibrary(current =>
                applyBookshelfRefresh(current, [before], [next]),
              ).then(() => undefined),
          });
        } catch (error) {
          void jssdk.showToast({
            type: 'error',
            title: translation.current('refreshBookshelf'),
            description: String(error),
          });
        }
      }
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (loadGeneralPreferences().autoClearExpired)
      void clearExpiredApplicationCache().catch(() => undefined);
    void readShelf();
  }, [readShelf]);
  useEffect(() => {
    const stopAutoTasks = startAutoTaskScheduler();
    void runDueRuleSubscriptions();
    void runDueAutomaticBackup().catch(() => undefined);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void runDueRuleSubscriptions();
        void runDueAutomaticBackup().catch(() => undefined);
      }
    });
    return () => {
      subscription.remove();
      stopAutoTasks();
    };
  }, []);
  const update = useCallback((book: Book, before?: Book) => {
    void updateLibrary(current =>
      current.map(item =>
        item.id === book.id ? applyBookUpdate(item, before, book) : item,
      ),
    ).catch(error => setLibraryError(String(error)));
  }, []);
  const replaceBooks = useCallback((next: Book[]) => {
    void saveLibrary(next).catch(error => setLibraryError(String(error)));
  }, []);
  const upsertBook = useCallback((book: Book) => {
    void updateLibrary(current => [
      ...current.filter(item => item.id !== book.id),
      book,
    ]).catch(error => setLibraryError(String(error)));
  }, []);
  if (loading)
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text style={s.muted}>{t('loadingBookshelf')}</Text>
      </View>
    );
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false, gestureEnabled: true }}
    >
      <Stack.Screen name="Home">
        {({ navigation }) =>
          libraryError ? (
            <View style={s.center}>
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                {libraryError}
              </Text>
              <Pressable
                accessibilityRole="button"
                style={s.headerAction}
                onPress={() => void readShelf()}
              >
                <Text>{t('retry')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.headerAction}
                onPress={() => navigation.navigate('Backup')}
              >
                <Text>{t('backupRestore')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.flex}>
              <StartupReaderRedirect
                books={books}
                enabled={generalPreferences.defaultToRead}
                redirected={startupRedirected}
                open={bookId => navigation.navigate('Reader', { bookId })}
              />
              {tab !== 'bookshelf' ? (
                <PageHeader
                  sourceTone
                  title={t(
                    tab === 'explore'
                      ? 'explore'
                      : tab === 'rss'
                        ? 'subscriptions'
                        : 'mine',
                  )}
                  action={
                    tab === 'mine' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('mineHelpTitle')}
                        style={s.headerAction}
                        onPress={() => navigation.navigate('AppHelp')}
                      >
                        <SourceIcon name="ic_help" color={colors.toolbarText} />
                      </Pressable>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('search')}
                        style={s.headerAction}
                        onPress={() => navigation.navigate('Search')}
                      >
                        <Svg width={24} height={24} viewBox="0 0 24 24">
                          <Circle
                            cx={10.5}
                            cy={10.5}
                            r={6.5}
                            fill="none"
                            stroke={colors.toolbarText}
                            strokeWidth={2}
                          />
                          <Path
                            d="M15.5 15.5L21 21"
                            fill="none"
                            stroke={colors.toolbarText}
                            strokeWidth={2}
                            strokeLinecap="round"
                          />
                        </Svg>
                      </Pressable>
                    )
                  }
                />
              ) : null}
              <View style={s.flex}>
                {tab === 'bookshelf' ? (
                  <BookshelfView
                    books={books}
                    open={bookId => {
                      const book = books.find(item => item.id === bookId);
                      if (!book) return;
                      void restoreRemoteLocalBook(book)
                        .then(restored => {
                          if (restored) update(restored);
                          navigation.navigate(
                            bookReadingScreen(restored ?? book),
                            { bookId },
                          );
                        })
                        .catch(() =>
                          navigation.navigate(bookReadingScreen(book), {
                            bookId,
                          }),
                        );
                    }}
                    openDetails={bookId =>
                      navigation.navigate('Book', { bookId })
                    }
                    search={() => navigation.navigate('Search')}
                    onChange={replaceBooks}
                    importBooks={() => navigation.navigate('LocalBookImport')}
                    addByUrl={() => navigation.navigate('AddBookByUrl')}
                    refresh={async group => {
                      const result = await refreshBookshelf(
                        books,
                        await loadSources(),
                        {
                          concurrency: generalPreferences.threadCount,
                          onlyUpdateRead: group.onlyUpdateRead === true,
                          groupId: group.id,
                          groups: loadBookGroups(),
                          onBookUpdated: (before, next) =>
                            updateLibrary(current =>
                              applyBookshelfRefresh(current, [before], [next]),
                            ).then(() => undefined),
                        },
                      );
                      void jssdk.showToast({
                        type: result.failed ? 'error' : 'success',
                        title: t('bookshelfRefreshComplete'),
                        description: t('bookshelfRefreshSummary', {
                          attempted: result.attempted,
                          updated: result.updated,
                          failed: result.failed,
                        }),
                      });
                    }}
                    openRemote={() => navigation.navigate('RemoteBooks')}
                    openLogs={() => navigation.navigate('AppLogs')}
                    openBulkCache={() => navigation.navigate('BulkBookCache')}
                    openManage={groupId =>
                      navigation.navigate('BookshelfManage', { groupId })
                    }
                  />
                ) : tab === 'explore' ? (
                  <Explore
                    open={book => navigation.navigate('OnlineBook', { book })}
                  />
                ) : tab === 'rss' ? (
                  <Rss
                    open={articleId =>
                      navigation.navigate('RssReader', { articleId })
                    }
                    manage={() => navigation.navigate('RssSources')}
                  />
                ) : (
                  <MineScreen
                    navigate={screen => navigation.navigate(screen)}
                  />
                )}
              </View>
              <TabBar
                active={tab}
                select={setTab}
                preferences={generalPreferences}
                skinRevision={skinRevision}
              />
            </View>
          )
        }
      </Stack.Screen>
      <Stack.Screen name="Book">
        {({ navigation, route }) => (
          <BookDetail
            book={books.find(x => x.id === route.params.bookId)}
            back={() => navigation.goBack()}
            read={() => {
              const current = books.find(
                item => item.id === route.params.bookId,
              );
              if (!current) {
                return;
              }
              void restoreRemoteLocalBook(current)
                .then(restored => {
                  if (restored) update(restored);
                  navigation.navigate(bookReadingScreen(restored ?? current), {
                    bookId: route.params.bookId,
                  });
                })
                .catch(() =>
                  navigation.navigate(bookReadingScreen(current), {
                    bookId: route.params.bookId,
                  }),
                );
            }}
            changeSource={() =>
              navigation.navigate('BookSourceSwitch', {
                bookId: route.params.bookId,
              })
            }
            cache={() =>
              navigation.navigate('BookCache', { bookId: route.params.bookId })
            }
            playAudio={() =>
              navigation.navigate('AudioPlayer', {
                bookId: route.params.bookId,
              })
            }
            playVideo={() =>
              navigation.navigate('VideoBook', { bookId: route.params.bookId })
            }
            update={update}
            exportBook={() =>
              navigation.navigate('BookExport', { bookId: route.params.bookId })
            }
            edit={() =>
              navigation.navigate('BookEditor', { bookId: route.params.bookId })
            }
            refresh={async () => {
              const current = books.find(
                  item => item.id === route.params.bookId,
                ),
                source = (await loadSources()).find(
                  item => item.bookSourceUrl === current?.origin,
                );
              if (!current || !source) throw new Error(t('sourceMissing'));
              update(await refreshBookMetadata(current, source));
            }}
            top={() => {
              const current = books.find(
                item => item.id === route.params.bookId,
              );
              if (current)
                replaceBooks([
                  current,
                  ...books.filter(item => item.id !== current.id),
                ]);
            }}
            openLogs={() => navigation.navigate('AppLogs')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="BookshelfTransfer">
        {({ navigation }) => (
          <BookshelfTransfer
            books={books}
            back={() => navigation.goBack()}
            imported={replaceBooks}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="BookshelfManage">
        {({ navigation, route }) => (
          <BookshelfManage
            initialGroupId={route.params.groupId}
            back={() => navigation.goBack()}
            open={bookId => navigation.navigate('Book', { bookId })}
            onBooksChange={replaceBooks}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="BulkBookCache">
        {({ navigation }) => (
          <BulkBookCache
            books={books}
            back={() => navigation.goBack()}
            update={update}
            replace={replaceBooks}
            openLogs={() => navigation.navigate('AppLogs')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="BookEditor">
        {({ navigation, route }) => (
          <BookEditor
            book={books.find(item => item.id === route.params.bookId)}
            back={() => navigation.goBack()}
            saved={book => {
              update(book);
              navigation.goBack();
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Reader">
        {({ navigation, route }) => (
          <Reader
            book={books.find(x => x.id === route.params.bookId)}
            initialChapterIndex={route.params.chapterIndex}
            back={() => navigation.goBack()}
            update={update}
            openReviews={(chapterIndex, paragraphIndex) =>
              navigation.navigate('ChapterReviews', {
                bookId: route.params.bookId,
                chapterIndex,
                paragraphIndex,
              })
            }
            openEditor={() =>
              navigation.navigate('BookEditor', { bookId: route.params.bookId })
            }
            openSourceSwitch={() =>
              navigation.navigate('BookSourceSwitch', {
                bookId: route.params.bookId,
              })
            }
            openOfflineCache={() =>
              navigation.navigate('BookCache', { bookId: route.params.bookId })
            }
            openHighlightRules={ruleId =>
              navigation.navigate('HighlightRules', { ruleId })
            }
            openReplaceRule={ruleId =>
              navigation.navigate('ReplaceRuleEditor', { ruleId })
            }
            openTxtTocRules={() => navigation.navigate('TxtTocRules')}
            openLogs={() => navigation.navigate('AppLogs')}
            openReaderSettings={() => navigation.navigate('ReaderSettings')}
            openHelp={() => navigation.navigate('ReaderHelp')}
            openSpeechEngines={() => navigation.navigate('HttpTts')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="BookSourceSwitch">
        {({ navigation, route }) => (
          <BookSourceSwitch
            book={books.find(item => item.id === route.params.bookId)}
            back={() => navigation.goBack()}
            changed={book => {
              update(book);
              navigation.goBack();
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="BookCache">
        {({ navigation, route }) => (
          <BookCache
            book={books.find(item => item.id === route.params.bookId)}
            back={() => navigation.goBack()}
            changed={update}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AudioPlayer">
        {({ navigation, route }) => (
          <AudioPlayer
            book={books.find(item => item.id === route.params.bookId)}
            back={() => navigation.goBack()}
            update={update}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="HttpTts">
        {({ navigation }) => (
          <HttpTtsManager back={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Search">
        {({ navigation, route }) => (
          <BookSearch
            initialQuery={route.params?.query}
            initialSourceUrl={route.params?.sourceUrl}
            back={() => navigation.goBack()}
            open={book => navigation.navigate('OnlineBook', { book })}
            login={sourceUrl =>
              navigation.navigate('SourceLogin', { sourceUrl })
            }
            library={books}
            openLocal={bookId => navigation.navigate('Book', { bookId })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="OnlineBook">
        {({ navigation, route }) => (
          <OnlineBookDetail
            initialBook={route.params.book}
            back={() => navigation.goBack()}
            added={book => {
              upsertBook(book);
              navigation.replace('Book', { bookId: book.id });
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Settings">
        {({ navigation }) => (
          <Settings
            back={() => navigation.goBack()}
            openSources={() => navigation.navigate('Sources')}
            openAnnotations={() => navigation.navigate('Annotations')}
            openBackup={() => navigation.navigate('Backup')}
            openReplaceRules={() => navigation.navigate('ReplaceRules')}
            openTxtTocRules={() => navigation.navigate('TxtTocRules')}
            openDictRules={() => navigation.navigate('DictRules')}
            openHighlightRules={() => navigation.navigate('HighlightRules')}
            openCoverRule={() => navigation.navigate('CoverRule')}
            openCoverSettings={() => navigation.navigate('CoverSettings')}
            openWelcomeSettings={() => navigation.navigate('WelcomeSettings')}
            openQr={() => navigation.navigate('QrImport')}
            openAutoTasks={() => navigation.navigate('AutoTasks')}
            openAppearance={() => navigation.navigate('Appearance')}
            openLogs={() => navigation.navigate('AppLogs')}
            openSubscriptions={() => navigation.navigate('RuleSubscriptions')}
            openGeneralSettings={() => navigation.navigate('GeneralSettings')}
            openReaderSettings={() => navigation.navigate('ReaderSettings')}
            openAbout={() => navigation.navigate('About')}
            openKeyboardAssists={() => navigation.navigate('KeyboardAssists')}
            openSpeechEngines={() => navigation.navigate('HttpTts')}
            extraEntries={[
              {
                label: t('bookListLegacyBackup'),
                open: () => navigation.navigate('BookshelfTransfer'),
              },
              {
                label: t('rssSources'),
                open: () => navigation.navigate('RssSources'),
              },
              {
                label: t('downloads'),
                open: () => navigation.navigate('Downloads'),
              },
              {
                label: t('browser'),
                open: () => navigation.navigate('Browser'),
              },
              {
                label: t('localWebService'),
                open: () => navigation.navigate('LocalWebService'),
              },
              {
                label: t('remoteBooks'),
                open: () => navigation.navigate('RemoteBooks'),
              },
              {
                label: t('launcherIcon'),
                open: () => navigation.navigate('LauncherIcon'),
              },
            ]}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Sources">
        {({ navigation }) => (
          <SourceManager
            back={() => navigation.goBack()}
            edit={sourceUrl =>
              navigation.navigate('SourceEditor', { sourceUrl })
            }
            login={sourceUrl =>
              navigation.navigate('SourceLogin', { sourceUrl })
            }
            debug={sourceUrl =>
              navigation.navigate('SourceDebug', { sourceUrl })
            }
            search={sourceUrl => navigation.navigate('Search', { sourceUrl })}
            openQr={() =>
              navigation.navigate('QrImport', { expectedKind: 'bookSource' })
            }
            openSubscriptions={() => navigation.navigate('RuleSubscriptions')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SourceEditor">
        {({ navigation, route }) => (
          <SourceEditor
            sourceUrl={route.params.sourceUrl}
            back={() => navigation.goBack()}
            saved={() => navigation.goBack()}
            search={sourceUrl => navigation.replace('Search', { sourceUrl })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SourceLogin">
        {({ navigation, route }) => (
          <SourceLogin
            sourceUrl={route.params.sourceUrl}
            rssSourceUrl={route.params.rssSourceUrl}
            autoTaskId={route.params.autoTaskId}
            back={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SourceDebug">
        {({ navigation, route }) => (
          <SourceDebug
            sourceUrl={route.params.sourceUrl}
            back={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Annotations">
        {({ navigation }) => (
          <AnnotationManager
            books={books}
            back={() => navigation.goBack()}
            open={(bookId, chapterId) => {
              const book = books.find(x => x.id === bookId);
              const chapterIndex = book?.chapters?.findIndex(
                x => x.id === chapterId,
              );
              navigation.navigate('Reader', {
                bookId,
                chapterIndex:
                  chapterIndex !== undefined && chapterIndex >= 0
                    ? chapterIndex
                    : undefined,
              });
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Backup">
        {({ navigation }) => (
          <BackupRestore
            back={() => navigation.goBack()}
            onRestored={async () => {
              await loadLibrary();
              setLibraryError('');
            }}
            openDirectLink={() => navigation.navigate('DirectLinkUpload')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="RssReader">
        {({ navigation, route }) => (
          <RssReader
            articleId={route.params.articleId}
            back={() => navigation.goBack()}
            play={(url, title) =>
              navigation.navigate('VideoPlayer', { url, title })
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ReplaceRules">
        {({ navigation }) => (
          <ReplaceRuleManager
            back={() => navigation.goBack()}
            edit={ruleId =>
              navigation.navigate('ReplaceRuleEditor', { ruleId })
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ReplaceRuleEditor">
        {({ navigation, route }) => (
          <ReplaceRuleEditor
            ruleId={route.params.ruleId}
            back={() => navigation.goBack()}
            saved={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="LocalBookImport">
        {({ navigation, route }) => (
          <LocalBookImport
            back={() => navigation.goBack()}
            initialUri={route.params?.uri}
            imported={incoming => {
              const byId = new Map(books.map(book => [book.id, book]));
              incoming.forEach(book => byId.set(book.id, book));
              replaceBooks([...byId.values()]);
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AddBookByUrl">
        {({ navigation }) => (
          <AddBookByUrl
            back={() => navigation.goBack()}
            books={books}
            completed={replaceBooks}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="TxtTocRules">
        {({ navigation }) => (
          <TxtTocRuleManager back={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="DictRules">
        {({ navigation }) => (
          <DictRuleManager back={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="HighlightRules">
        {({ navigation, route }) => (
          <HighlightRuleManager
            back={() => navigation.goBack()}
            initialRuleId={route.params?.ruleId}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="RssSources">
        {({ navigation }) => (
          <RssSourceManager
            back={() => navigation.goBack()}
            login={rssSourceUrl =>
              navigation.navigate('SourceLogin', { rssSourceUrl })
            }
            debug={sourceUrl =>
              navigation.navigate('RssSourceDebug', { sourceUrl })
            }
            openQr={() =>
              navigation.navigate('QrImport', { expectedKind: 'rssSource' })
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="RssSourceDebug">
        {({ navigation, route }) => (
          <RssSourceDebug
            sourceUrl={route.params.sourceUrl}
            back={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="CoverRule">
        {({ navigation }) => (
          <CoverRuleSettings back={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="CoverSettings">
        {({ navigation }) => <CoverSettings back={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="WelcomeSettings">
        {({ navigation }) => (
          <WelcomeSettings back={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="BookExport">
        {({ navigation, route }) => (
          <BookExport
            book={books.find(item => item.id === route.params.bookId)}
            back={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="QrImport">
        {({ navigation, route }) => (
          <QrImport
            initialValue={route.params?.value}
            expectedKind={route.params?.expectedKind}
            back={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AutoTasks">
        {({ navigation }) => (
          <AutoTaskManager
            back={() => navigation.goBack()}
            edit={taskId =>
              navigation.navigate(
                'AutoTaskEditor',
                taskId ? { taskId } : undefined,
              )
            }
            debug={taskId => navigation.navigate('AutoTaskDebug', { taskId })}
            login={taskId =>
              navigation.navigate('SourceLogin', { autoTaskId: taskId })
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AutoTaskEditor">
        {({ navigation, route }) => (
          <AutoTaskEditor
            taskId={route.params?.taskId}
            back={() => navigation.goBack()}
            saved={() => navigation.goBack()}
            debug={taskId => navigation.replace('AutoTaskDebug', { taskId })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AutoTaskDebug">
        {({ navigation, route }) => (
          <AutoTaskDebug
            taskId={route.params.taskId}
            back={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Appearance">
        {({ navigation }) => (
          <AppearanceSettings
            back={() => navigation.goBack()}
            openBottomBarSkins={() => navigation.navigate('BottomBarSkins')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="BottomBarSkins">
        {({ navigation }) => (
          <BottomBarSkins
            back={() => navigation.goBack()}
            changed={() => setSkinRevision(value => value + 1)}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="KeyboardAssists">
        {({ navigation }) => (
          <KeyboardAssists back={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="AppLogs">
        {({ navigation }) => <AppLogs back={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="ReadRecords">
        {({ navigation }) => (
          <ReadRecords
            back={() => navigation.goBack()}
            open={record => {
              const book = books.find(item => item.id === record.bookId);
              if (book) navigation.navigate('Book', { bookId: book.id });
              else navigation.navigate('Search', { query: record.bookName });
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="RemoteBooks">
        {({ navigation }) => (
          <RemoteBooks
            back={() => navigation.goBack()}
            configure={() => navigation.navigate('Backup')}
            imported={incoming => {
              const byId = new Map(books.map(book => [book.id, book]));
              incoming.forEach(book => byId.set(book.id, book));
              replaceBooks([...byId.values()]);
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="RuleSubscriptions">
        {({ navigation }) => (
          <RuleSubscriptions back={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="VideoPlayer">
        {({ navigation, route }) => (
          <VideoPlayer
            {...route.params}
            back={() => navigation.goBack()}
            download={(url, title, headers) => {
              saveDownloads([
                createDownload(url, title, headers),
                ...loadDownloads(),
              ]);
              navigation.navigate('Downloads');
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="VideoBook">
        {({ navigation, route }) => (
          <VideoBookPlayer
            book={books.find(item => item.id === route.params.bookId)}
            back={() => navigation.goBack()}
            update={update}
            download={(url, title, headers) => {
              saveDownloads([
                createDownload(url, title, headers),
                ...loadDownloads(),
              ]);
              navigation.navigate('Downloads');
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ChapterReviews">
        {({ navigation, route }) => (
          <ChapterReviews
            book={books.find(item => item.id === route.params.bookId)}
            chapterIndex={route.params.chapterIndex}
            initialParagraphIndex={route.params.paragraphIndex}
            back={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Downloads">
        {({ navigation }) => (
          <DownloadManager back={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="LauncherIcon">
        {({ navigation }) => (
          <LauncherIconSettings back={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="DirectLinkUpload">
        {({ navigation }) => (
          <DirectLinkUpload back={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Browser">
        {({ navigation, route }) => (
          <Browser
            initialUrl={route.params?.url}
            back={() => navigation.goBack()}
            download={(url, title) => {
              saveDownloads([createDownload(url, title), ...loadDownloads()]);
              navigation.navigate('Downloads');
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="LocalWebService">
        {({ navigation }) => (
          <LocalWebService
            back={() => navigation.goBack()}
            openBrowser={url => navigation.navigate('Browser', { url })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="FileManager">
        {({ navigation }) => (
          <AppFileManager back={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="GeneralSettings">
        {({ navigation }) => (
          <GeneralSettings
            openMore={() => navigation.navigate('Settings')}
            openServices={() => navigation.navigate('LocalWebService')}
            back={() => navigation.goBack()}
            changed={value => {
              setGeneralPreferences(value);
              if (
                (tab === 'explore' && !value.showExplore) ||
                (tab === 'rss' && !value.showRss)
              )
                setTab('bookshelf');
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ReaderSettings">
        {({ navigation }) => (
          <ReaderSettings back={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="AppHelp">
        {({ navigation }) => (
          <AppHelp
            back={() => navigation.goBack()}
            open={url => navigation.navigate('Browser', { url })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ReaderHelp">
        {({ navigation }) => <ReaderHelp back={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="About">
        {({ navigation }) => (
          <About
            back={() => navigation.goBack()}
            openLogs={() => navigation.navigate('AppLogs')}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
function StartupReaderRedirect({
  books,
  enabled,
  redirected,
  open,
}: {
  books: Book[];
  enabled: boolean;
  redirected: MutableRefObject<boolean>;
  open: (bookId: string) => void;
}) {
  useEffect(() => {
    if (!enabled || redirected.current) return;
    redirected.current = true;
    const bookId = selectLastReadBookId(loadReadRecords(), books);
    if (bookId) open(bookId);
  }, [books, enabled, open, redirected]);
  return null;
}
function Bookshelf({
  books,
  open,
}: {
  books: Book[];
  open: (id: string) => void;
}) {
  const { colors, t } = useAppTheme();
  if (!books.length)
    return (
      <View style={s.center}>
        <Text style={[s.emptyTitle, { color: colors.text }]}>
          {t('emptyBookshelfTitle')}
        </Text>
        <Text style={[s.muted, { color: colors.muted }]}>
          {t('emptyBookshelfHelp')}
        </Text>
      </View>
    );
  return (
    <ScrollView contentContainerStyle={s.list}>
      {books.map(book => (
        <Pressable
          accessibilityRole="button"
          key={book.id}
          style={s.book}
          onPress={() => open(book.id)}
        >
          <BookCover
            name={book.name}
            author={book.author}
            book={book}
            style={s.cover}
          />
          <View style={s.bookText}>
            <Text style={s.bookName}>{book.name}</Text>
            <Text style={s.muted}>
              {book.author} · {book.chapterTitle}
            </Text>
            <Text numberOfLines={2} style={s.intro}>
              {displayBookIntro(book)}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
function BookDetail({
  book,
  back,
  read,
  changeSource,
  cache,
  playAudio,
  playVideo,
  update: commitBook,
  exportBook,
  edit,
  refresh,
  top,
  openLogs,
}: {
  book?: Book;
  back: () => void;
  read: () => void;
  changeSource: () => void;
  cache: () => void;
  playAudio: () => void;
  playVideo: () => void;
  update: (book: Book, before?: Book) => void;
  exportBook: () => void;
  edit: () => void;
  refresh: () => Promise<void>;
  top: () => void;
  openLogs: () => void;
}) {
  const update = useCallback(
    (next: Book) => commitBook(next, book),
    [commitBook, book],
  );
  const { t, colors } = useAppTheme();
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverMessage, setCoverMessage] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState('');
  const [confirmClearCache, setConfirmClearCache] = useState(false);
  const refreshCover = useCallback(async () => {
    if (!book || coverLoading) return;
    setCoverLoading(true);
    setCoverMessage('');
    try {
      const coverUrl = await searchBookCover(book, loadCoverRule());
      if (coverUrl && coverUrl !== displayBookCover(book))
        update({
          ...book,
          customCoverUrl: coverUrl,
          persistedCoverUrl: undefined,
          updatedAt: Date.now(),
        });
      else if (!coverUrl) setCoverMessage(t('coverRuleNoImage'));
    } catch (error) {
      setCoverMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setCoverLoading(false);
    }
  }, [book, coverLoading, t, update]);
  useEffect(() => {
    if (book && !displayBookCover(book)?.trim() && loadCoverRule().enable)
      void refreshCover();
  }, [book?.id]);
  if (!book)
    return (
      <View style={s.flex}>
        <PageHeader title={t('bookNotFound')} onBack={back} />
        <View style={s.center}>
          <Text>{t('bookRemoved')}</Text>
        </View>
      </View>
    );
  const runRefresh = async () => {
      if (detailsLoading) return;
      setDetailsLoading(true);
      setDetailsMessage('');
      try {
        await refresh();
        setDetailsMessage(t('bookRefreshComplete'));
      } catch (error) {
        setDetailsMessage(
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setDetailsLoading(false);
      }
    },
    copy = (value: string | undefined, label: string) => {
      if (!value) return;
      Clipboard.setString(value);
      setDetailsMessage(t('copiedNamedValue', { name: label }));
    };
  return (
    <View style={s.flex}>
      <PageHeader
        title={t('bookDetails')}
        onBack={back}
        action={
          book.bookUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('switchSource')}
              style={s.headerTextButton}
              onPress={changeSource}
            >
              <Text style={s.headerTextAction}>{t('switchSource')}</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={s.detail}>
        <Pressable
          accessibilityRole="button"
          style={s.coverRefresh}
          onPress={edit}
        >
          <Text style={s.headerTextAction}>{t('editBook')}</Text>
        </Pressable>
        <Text style={s.sectionTitle}>{t('bookActions')}</Text>
        <View style={s.wrapRow}>
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={() =>
              void Share.share({
                title: book.name,
                message: book.bookUrl
                  ? `${book.bookUrl}#${JSON.stringify({
                      ...book,
                      content: '',
                      chapters: undefined,
                    })}`
                  : [book.name, book.author].filter(Boolean).join('\n'),
                url: book.bookUrl,
              })
            }
          >
            <Text>{t('share')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={() => copy(book.bookUrl, t('bookUrl'))}
          >
            <Text>{t('copyBookUrl')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!book.tocUrl}
            accessibilityState={{ disabled: !book.tocUrl }}
            style={[s.settingAction, !book.tocUrl && { opacity: 0.45 }]}
            onPress={() => copy(book.tocUrl, t('tocUrl'))}
          >
            <Text>{t('copyTocUrl')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={top}
          >
            <Text>{t('moveBookToTop')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={
              detailsLoading ||
              !book.origin ||
              book.origin === 'local' ||
              !book.bookUrl
            }
            accessibilityState={{
              disabled:
                detailsLoading ||
                !book.origin ||
                book.origin === 'local' ||
                !book.bookUrl,
            }}
            style={s.settingAction}
            onPress={() => void runRefresh()}
          >
            <Text>
              {detailsLoading
                ? `${t('refreshBookData')}…`
                : t('refreshBookData')}
            </Text>
          </Pressable>
          {book.origin && book.origin !== 'local' ? (
            <Pressable
              accessibilityRole="button"
              style={s.settingAction}
              onPress={() => setConfirmClearCache(true)}
            >
              <Text>{t('clearBookCache')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={openLogs}
          >
            <Text>{t('logs')}</Text>
          </Pressable>
        </View>
        {book.origin && book.origin !== 'local' ? (
          <View style={s.readerSwitch}>
            <Text>{t('allowBookUpdate')}</Text>
            <Switch
              accessibilityLabel={t('allowBookUpdate')}
              value={book.canUpdate !== false}
              onValueChange={canUpdate =>
                update({ ...book, canUpdate, updatedAt: Date.now() })
              }
            />
          </View>
        ) : null}
        {detailsMessage ? (
          <Text accessibilityLiveRegion="polite" style={s.coverMessage}>
            {detailsMessage}
          </Text>
        ) : null}
        <View style={s.hero}>
          <BookCover
            name={book.name}
            author={book.author}
            book={book}
            style={[s.cover, s.largeCover]}
          />
          <View style={s.bookText}>
            <Text style={s.detailName}>{book.name}</Text>
            <Text style={s.muted}>{book.author}</Text>
            <Text style={s.muted}>
              {t('readPercent', { percent: Math.round(book.progress * 100) })}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: coverLoading }}
          disabled={coverLoading}
          style={s.coverRefresh}
          onPress={() => void refreshCover()}
        >
          <Text style={s.headerTextAction}>
            {coverLoading ? t('searchingCover') : t('refreshCoverRule')}
          </Text>
        </Pressable>
        {coverMessage ? (
          <Text accessibilityLiveRegion="polite" style={s.coverMessage}>
            {coverMessage}
          </Text>
        ) : null}
        <Text style={s.sectionTitle}>{t('introduction')}</Text>
        <Text style={s.body}>{displayBookIntro(book)}</Text>
        <Text style={s.sectionTitle}>{t('latestChapter')}</Text>
        <Text style={s.body}>{book.chapterTitle}</Text>
        {book.bookUrl ? (
          <Pressable
            accessibilityRole="button"
            style={s.cacheButton}
            onPress={cache}
          >
            <Text style={s.cacheButtonText}>{t('offlineCache')}</Text>
          </Pressable>
        ) : null}
        {book.sourceType === 1 ? (
          <Pressable
            accessibilityRole="button"
            style={s.audioButton}
            onPress={playAudio}
          >
            <Text style={s.audioButtonText}>{t('audioPlayback')}</Text>
          </Pressable>
        ) : null}
        {book.sourceType === 4 ? (
          <Pressable
            accessibilityRole="button"
            style={s.audioButton}
            onPress={playVideo}
          >
            <Text style={s.audioButtonText}>{t('videoPlayback')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={s.cacheButton}
          onPress={exportBook}
        >
          <Text style={s.cacheButtonText}>{t('exportBook')}</Text>
        </Pressable>
      </ScrollView>
      <Pressable accessibilityRole="button" style={s.primary} onPress={read}>
        <Text style={s.primaryText}>
          {book.progress ? t('continueReading') : t('startReading')}
        </Text>
      </Pressable>
      <InTreeSheet
        visible={confirmClearCache}
        onDismiss={() => setConfirmClearCache(false)}
      >
        <Text style={s.sectionTitle}>{t('clearBookCacheTitle')}</Text>
        <Text style={s.body}>{t('clearBookCacheDescription')}</Text>
        <View style={s.sheetActions}>
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={() => setConfirmClearCache(false)}
          >
            <Text>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={() => {
              update(
                clearReaderChapterCache(
                  book,
                  book.currentChapterIndex ?? 0,
                  'all',
                ),
              );
              setConfirmClearCache(false);
              setDetailsMessage(t('bookCacheCleared'));
            }}
          >
            <Text style={{ color: colors.danger }}>{t('confirm')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
    </View>
  );
}
function Reader({
  book,
  initialChapterIndex,
  back,
  update: commitBook,
  openReviews,
  openEditor,
  openSourceSwitch,
  openOfflineCache,
  openHighlightRules,
  openReplaceRule,
  openTxtTocRules,
  openLogs,
  openReaderSettings,
  openHelp,
  openSpeechEngines,
}: {
  book?: Book;
  initialChapterIndex?: number;
  back: () => void;
  update: (b: Book, before?: Book) => void;
  openReviews: (chapterIndex: number, paragraphIndex?: number) => void;
  openEditor: () => void;
  openSourceSwitch: () => void;
  openOfflineCache: () => void;
  openHighlightRules: (ruleId?: number) => void;
  openReplaceRule: (ruleId: number) => void;
  openTxtTocRules: () => void;
  openLogs: () => void;
  openReaderSettings: () => void;
  openHelp: () => void;
  openSpeechEngines: () => void;
}) {
  const update = useCallback(
    (next: Book) => commitBook(next, book),
    [commitBook, book],
  );
  const { t, colors, preferences: appPreferences } = useAppTheme();
  const focused = useIsFocused();
  useBookVisit(book?.id);
  const [controls, setControls] = useState(true),
    [readAloudVisible, setReadAloudVisible] = useState(false),
    [readerToolsVisible, setReaderToolsVisible] = useState(false),
    [quickStyleVisible, setQuickStyleVisible] = useState(false),
    [config, setConfig] = useState(false),
    [toc, setToc] = useState(false),
    [tocTab, setTocTab] = useState<'toc' | 'bookmarks' | 'highlights'>('toc'),
    [tocQuery, setTocQuery] = useState(''),
    [tocUseReplace, setTocUseReplace] = useState(
      () => loadGeneralPreferences().tocUiUseReplace,
    ),
    [tocCountWords, setTocCountWords] = useState(
      () => loadGeneralPreferences().tocCountWords,
    ),
    [collapsedTocVolumes, setCollapsedTocVolumes] = useState<Set<string>>(() =>
      defaultCollapsedVolumeIds(
        book?.chapters ?? [],
        initialChapterIndex ?? book?.currentChapterIndex ?? 0,
        book?.tocExpanded !== false,
        book?.reverseToc === true,
      ),
    ),
    [contentSearch, setContentSearch] = useState(false),
    [advanced, setAdvanced] = useState(false),
    [effectiveReplaces, setEffectiveReplaces] = useState(false),
    [readerMenuConfigOpen, setReaderMenuConfigOpen] = useState(false),
    [readerMenuTier, setReaderMenuTier] = useState<'primary' | 'more'>(
      'primary',
    ),
    [readerMenuConfig, setReaderMenuConfig] = useState(loadReaderMenuConfig),
    [refreshScopeConfirm, setRefreshScopeConfirm] = useState<'after' | 'all'>(),
    [index, setIndex] = useState(
      initialChapterIndex ?? book?.currentChapterIndex ?? 0,
    ),
    [bookmarks, setBookmarks] = useState<Bookmark[]>(
      book ? listBookmarks(book.id) : [],
    ),
    [highlights, setHighlights] = useState<Highlight[]>(
      book ? listHighlights(book.id) : [],
    ),
    [replaceRules, setReplaceRules] = useState(loadReplaceRules),
    [highlightRules, setHighlightRules] = useState(loadHighlightRules),
    [storedPrefs, setPrefs] = useState<ReaderPreferences>(
      defaultReaderPreferences,
    ),
    [backgroundMessage, setBackgroundMessage] = useState(''),
    [clock, setClock] = useState(Date.now()),
    [pageIndex, setPageIndex] = useState(0),
    [remoteLoading, setRemoteLoading] = useState(''),
    [remoteError, setRemoteError] = useState(''),
    [remoteRetry, setRemoteRetry] = useState(0),
    [reviewCounts, setReviewCounts] = useState<Record<number, number>>({}),
    [mangaHeaders, setMangaHeaders] = useState<Record<string, string>>({}),
    [advancedMessage, setAdvancedMessage] = useState(''),
    [pendingProgress, setPendingProgress] = useState<RemoteBookProgress>(),
    [pendingChapterJump, setPendingChapterJump] = useState<number>(),
    [chapterTransition, setChapterTransition] = useState<{
      targetIndex: number;
      title: string;
      error?: string;
    }>(),
    [chapterJumpConfirmed, setChapterJumpConfirmed] = useState(false),
    [simulationDate, setSimulationDate] = useState(
      book?.simulatedReading?.startDate ??
        new Date().toISOString().slice(0, 10),
    ),
    [simulationStart, setSimulationStart] = useState(
      String(
        book?.simulatedReading?.startChapter ?? book?.currentChapterIndex ?? 0,
      ),
    ),
    [simulationDaily, setSimulationDaily] = useState(
      String(book?.simulatedReading?.dailyChapters ?? 3),
    ),
    [simulationEnabled, setSimulationEnabled] = useState(
      book?.simulatedReading?.enabled === true,
    ),
    [pullBookmarkState, setPullBookmarkState] =
      useState<PullBookmarkState>('none'),
    [pullBookmarkPageOffset, setPullBookmarkPageOffset] = useState(0),
    [previewReaderImage, setPreviewReaderImage] = useState<ReaderImage>(),
    [pendingReaderLink, setPendingReaderLink] = useState(''),
    [activeHighlightRule, setActiveHighlightRule] = useState<{
      ruleId: number;
      text: string;
    }>(),
    [editingBookmark, setEditingBookmark] = useState<Bookmark>(),
    [bookmarkExcerptDraft, setBookmarkExcerptDraft] = useState(''),
    [editingHighlight, setEditingHighlight] = useState<Highlight>(),
    [highlightNoteDraft, setHighlightNoteDraft] = useState(''),
    [highlightColorDraft, setHighlightColorDraft] = useState(''),
    [replacePreviewActive, setReplacePreviewActive] = useState(false),
    capsuleLayout = useCapsule(),
    insets = capsuleLayout.insets,
    window = capsuleLayout.window,
    touchStart = useRef({ x: 0, y: 0 }),
    pullBookmarkCandidate = useRef(false),
    replacePreviewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    ),
    replacePreviewGesture = useRef(false),
    replacePreviewTouches = useRef<Array<{ x: number; y: number }>>([]),
    chapterSwitchingRef = useRef(false),
    chapterSwitchRequest = useRef(0),
    readerScrollAtTop = useRef(true),
    mangaScroll = useRef<ScrollView>(null),
    textScroll = useRef<ScrollView>(null),
    readingPosition = useRef<ReaderPositionHandle>(null),
    mangaOffset = useRef(0),
    mangaExtent = useRef(0),
    mangaViewport = useRef(0),
    mangaAutoAdvanced = useRef(false),
    advanceMangaRef = useRef<() => void>(() => undefined),
    previousPageRef = useRef<() => void>(() => undefined),
    nextPageRef = useRef<() => void>(() => undefined),
    pageMotion = useRef(new Animated.Value(1)).current,
    pageDirection = useRef<1 | -1>(1),
    prefs = readerPreferencesForAppTheme(storedPrefs, appPreferences.themeMode),
    pageColumns =
      prefs.mode === 'page'
        ? readerPageColumns(prefs.doublePageMode, window.width, window.height)
        : 1,
    pageCapacity = estimatePageCapacity(
      Math.max(1, window.width - insets.left - insets.right) / pageColumns,
      Math.max(1, window.height - insets.top - insets.bottom),
      prefs.fontSize,
      prefs.lineHeight,
    ),
    previousPageCapacity = useRef(pageCapacity),
    safeLayout = readerSafeLayout(insets, capsuleLayout.capsule, window.width);
  const catalogue = useBookCatalogue(book, setIndex);
  const mangaSpecialUi =
      book?.sourceType === 2 && loadGeneralPreferences().showMangaUi,
    mangaHorizontal = mangaSpecialUi ? prefs.mangaHorizontal : true;
  const progressSyncRef = useRef({ book, index });
  progressSyncRef.current = { book, index };
  useEffect(() => {
    if (focused) setReplaceRules(loadReplaceRules());
  }, [focused]);
  useEffect(
    () => () => {
      chapterSwitchRequest.current++;
      chapterSwitchingRef.current = false;
    },
    [],
  );
  useEffect(() => {
    const previous = previousPageCapacity.current;
    previousPageCapacity.current = pageCapacity;
    if (readingPosition.current) return;
    setPageIndex(value =>
      reflowPageIndex(value, previous, pageCapacity, pageColumns),
    );
  }, [pageCapacity, pageColumns, book?.sourceType]);
  useEffect(() => {
    if (!book?.origin) {
      setMangaHeaders({});
      return;
    }
    let active = true;
    void loadSources()
      .then(sources => {
        const source = sources.find(item => item.bookSourceUrl === book.origin),
          chapter =
            book.chapters?.[
              Math.max(0, Math.min(index, (book.chapters?.length ?? 1) - 1))
            ];
        if (active && source)
          setMangaHeaders(
            buildSourceRequest(source, chapter?.url ?? source.bookSourceUrl)
              .headers,
          );
      })
      .catch(() => {
        if (active) setMangaHeaders({});
      });
    return () => {
      active = false;
    };
  }, [book?.id, book?.origin, index]);
  useEffect(() => {
    if (!book || book.sourceType !== 2) return;
    const preferences = loadGeneralPreferences();
    if (!preferences.imageRetainNum) return;
    const chapters = book.chapters ?? [];
    if (!chapters[index]?.content) return;
    const start = Math.max(0, index - preferences.imageRetainNum),
      end = Math.min(chapters.length - 1, index + preferences.preDownloadNum),
      retained = chapters
        .slice(start, end + 1)
        .flatMap(chapter =>
          parseMangaImages(
            chapter.content,
            chapter.baseUrl ?? book.tocUrl ?? book.bookUrl ?? '',
          ),
        );
    void pruneMangaCache(book.id, retained).catch(() => undefined);
  }, [book, index]);
  useEffect(() => {
    if (!book?.origin) {
      setReviewCounts({});
      return;
    }
    const chapter = book.chapters?.[index];
    if (!chapter) return;
    let active = true;
    void loadSources()
      .then(sources => {
        const source = sources.find(item => item.bookSourceUrl === book.origin);
        return source
          ? loadReviewSummaries(
              source,
              { ...book, currentChapterIndex: index },
              chapter,
            )
          : [];
      })
      .then(items => {
        if (active)
          setReviewCounts(
            Object.fromEntries(
              items.map(item => [item.paragraphIndex, item.count]),
            ),
          );
      })
      .catch(() => {
        if (active) setReviewCounts({});
      });
    return () => {
      active = false;
    };
  }, [book?.id, book?.origin, index]);
  useEffect(() => {
    void loadReaderPreferences().then(setPrefs);
  }, []);
  useEffect(() => {
    if (!focused) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () =>
      shouldBlockReaderHardwareBack(prefs.disableReturnKey, controls),
    );
    return () => subscription.remove();
  }, [controls, focused, prefs.disableReturnKey]);
  useEffect(
    () => () => {
      if (replacePreviewTimer.current)
        clearTimeout(replacePreviewTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!book) return;
    let active = true;
    const preferences = loadBackupPreferences();
    if (preferences.syncBookProgressPlus)
      void downloadWebDavBookProgress(loadWebDavConfig(), book)
        .then(progress => {
          if (
            active &&
            progress &&
            progress.durChapterTime > (book.updatedAt ?? 0)
          ) {
            setPendingProgress(progress);
            setAdvancedMessage(t('remoteProgressFound'));
            setAdvanced(true);
          }
        })
        .catch(() => undefined);
    return () => {
      active = false;
      const current = progressSyncRef.current;
      if (preferences.syncBookProgress && current.book)
        void uploadWebDavBookProgress(loadWebDavConfig(), {
          ...current.book,
          currentChapterIndex: current.index,
          chapterTitle:
            current.book.chapters?.[current.index]?.title ??
            current.book.chapterTitle,
        }).catch(() => undefined);
    };
  }, [book?.id, t]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!book) return;
    let activeSince = Date.now();
    const subscription = AppState.addEventListener('change', state => {
      const now = Date.now();
      if (state === 'active') activeSince = now;
      else if (activeSince) {
        recordReadTime(book, now - activeSince, now);
        activeSince = 0;
      }
    });
    return () => {
      subscription.remove();
      if (activeSince) recordReadTime(book, Date.now() - activeSince);
    };
  }, [book?.author, book?.id, book?.name]);
  useEffect(() => {
    mangaOffset.current = 0;
    mangaAutoAdvanced.current = false;
    mangaScroll.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, [index, mangaHorizontal]);
  useEffect(() => {
    if (!mangaSpecialUi || !prefs.mangaAutoScroll) return;
    const timer = setInterval(() => {
      const max = Math.max(0, mangaExtent.current - mangaViewport.current);
      if (mangaOffset.current >= max) {
        if (prefs.mangaAutoNext && !mangaAutoAdvanced.current) {
          mangaAutoAdvanced.current = true;
          advanceMangaRef.current();
        }
        return;
      }
      mangaOffset.current = Math.min(
        max,
        mangaOffset.current + prefs.mangaAutoScrollSpeed / 20,
      );
      mangaScroll.current?.scrollTo(
        mangaHorizontal
          ? { x: mangaOffset.current, y: 0, animated: false }
          : { x: 0, y: mangaOffset.current, animated: false },
      );
    }, 50);
    return () => clearInterval(timer);
  }, [
    mangaSpecialUi,
    prefs.mangaAutoScroll,
    prefs.mangaAutoScrollSpeed,
    mangaHorizontal,
    prefs.mangaAutoNext,
  ]);
  useEffect(() => {
    if (prefs.mode !== 'page' || prefs.pageAnimation === 'none') {
      pageMotion.setValue(1);
      return;
    }
    pageMotion.setValue(0);
    Animated.timing(pageMotion, {
      toValue: 1,
      duration: prefs.pageAnimation === 'fade' ? 180 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, pageIndex, prefs.mode, prefs.pageAnimation, pageMotion]);
  useEffect(() => {
    if (prefs.orientation === 'portrait') Orientation.lockToPortrait();
    else if (prefs.orientation === 'landscape') Orientation.lockToLandscape();
    else Orientation.unlockAllOrientations();
    return () => Orientation.unlockAllOrientations();
  }, [prefs.orientation]);
  useEffect(() => {
    if (!prefs.volumeKeyPage || !focused) return;
    let active = true;
    let previous: number | undefined;
    let restoring = false;
    let reset: ReturnType<typeof setTimeout> | undefined;
    void VolumeManager.getVolume()
      .then(value => {
        if (active) previous = value.volume;
      })
      .catch(() => undefined);
    const subscription = VolumeManager.addVolumeListener(value => {
      if (!active) return;
      if (previous === undefined) {
        previous = value.volume;
        return;
      }
      if (restoring) {
        restoring = false;
        if (reset) clearTimeout(reset);
        return;
      }
      const restore = previous;
      const direction = volumePageDirection(previous, value.volume);
      if (direction > 0) nextPageRef.current();
      else if (direction < 0) previousPageRef.current();
      else return;
      restoring = true;
      void VolumeManager.setVolume(restore, { showUI: false }).catch(() => {
        restoring = false;
      });
      reset = setTimeout(() => {
        restoring = false;
      }, 300);
    });
    return () => {
      active = false;
      if (reset) clearTimeout(reset);
      subscription.remove();
    };
  }, [focused, prefs.volumeKeyPage]);
  useEffect(() => {
    if (!book || catalogue.needed) return;
    const chapters = book.chapters ?? [],
      safeIndex = Math.max(0, Math.min(index, chapters.length - 1)),
      chapter = chapters[safeIndex];
    if (!chapter?.url || chapter.content || chapter.isVolume) return;
    let active = true;
    setRemoteLoading(chapter.id);
    setRemoteError('');
    void loadSources()
      .then(sources => {
        const source = sources.find(item => item.bookSourceUrl === book.origin);
        if (!source) throw new Error(t('sourceMissing'));
        return loadChapterContent(source, {
          url: chapter.url!,
          title: chapter.title,
          index: safeIndex,
          bookUrl: book.bookUrl ?? '',
          baseUrl: chapter.baseUrl ?? book.tocUrl ?? book.bookUrl ?? '',
          isVolume: !!chapter.isVolume,
          isVip: !!chapter.isVip,
          isPay: !!chapter.isPay,
        });
      })
      .then(content => {
        if (!active || chapterSwitchingRef.current) return;
        const nextChapters = chapters.map((item, chapterIndex) =>
          chapterIndex === safeIndex ? { ...item, content } : item,
        );
        update({
          ...book,
          chapters: nextChapters,
          chapterTitle: chapter.title,
          content,
          updatedAt: Date.now(),
        });
      })
      .catch(async reason => {
        if (!active || chapterSwitchingRef.current) return;
        addAppLog(
          `[reader-content] primary load failed book=${JSON.stringify(book.name)} chapterIndex=${safeIndex} chapter=${JSON.stringify(chapter.title)} origin=${book.origin ?? ''} bookUrl=${book.bookUrl ?? ''} chapterUrl=${chapter.url ?? ''}`,
          reason,
        );
        if (loadGeneralPreferences().autoChangeSource && book.origin) {
          setRemoteLoading(chapter.id);
          setRemoteError(t('autoChangingSource'));
          try {
            const switched = await autoSwitchSourceForChapter(
              book,
              safeIndex,
              await loadSources(),
            );
            if (!active) return;
            setIndex(switched.currentChapterIndex ?? 0);
            update(switched);
            setRemoteError('');
            return;
          } catch (switchError) {
            if (!active) return;
            addAppLog(
              `[reader-content] automatic source switch failed book=${JSON.stringify(book.name)} chapter=${JSON.stringify(chapter.title)}`,
              switchError,
            );
            setRemoteError(
              t('autoChangeSourceFailed', {
                error:
                  switchError instanceof Error
                    ? switchError.message
                    : String(switchError),
              }),
            );
            return;
          }
        }
        setRemoteError(
          reason instanceof Error ? reason.message : String(reason),
        );
      })
      .finally(() => {
        if (active) setRemoteLoading('');
      });
    return () => {
      active = false;
    };
  }, [book, index, remoteRetry, update, catalogue.needed]);
  useEffect(() => {
    if (
      chapterSwitchingRef.current ||
      !book?.origin ||
      !book.chapters?.[index]?.content
    )
      return;
    const preferences = loadGeneralPreferences();
    if (!preferences.preDownloadNum) return;
    let active = true;
    void loadSources()
      .then(sources => {
        const source = sources.find(item => item.bookSourceUrl === book.origin);
        if (!source) return book;
        return prefetchUpcomingChapters(
          book,
          index,
          preferences.preDownloadNum,
          preferences.threadCount,
          (chapter, chapterIndex) =>
            loadChapterContent(source, {
              url: chapter.url!,
              title: chapter.title,
              index: chapterIndex,
              bookUrl: book.bookUrl ?? '',
              baseUrl: chapter.baseUrl ?? book.tocUrl ?? book.bookUrl ?? '',
              isVolume: !!chapter.isVolume,
              isVip: !!chapter.isVip,
              isPay: !!chapter.isPay,
            }),
        );
      })
      .then(next => {
        if (active && !chapterSwitchingRef.current && next !== book)
          update(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [book, index, update]);
  if (!book)
    return (
      <View style={s.center}>
        <Text>{t('cannotReadBook')}</Text>
      </View>
    );
  const allChapters = book.chapters?.length
      ? book.chapters
      : [
          {
            id: `${book.id}-legacy`,
            title: book.chapterTitle,
            content: book.content,
          },
        ],
    chapters = allChapters.slice(
      0,
      Math.max(1, simulatedChapterCount(book, allChapters.length)),
    ),
    chapter = chapters[Math.max(0, Math.min(index, chapters.length - 1))],
    palette = readerPalette(prefs.theme, prefs),
    backgroundImage =
      prefs.theme === 'night'
        ? prefs.nightBackgroundImage
        : prefs.theme === 'epaper'
          ? prefs.epaperBackgroundImage
          : prefs.theme === 'paper'
            ? prefs.paperBackgroundImage
            : '',
    automaticReplaceEnabled =
      book.useReplaceRules ??
      (book.sourceType !== 2 &&
        !/\.epub$/i.test(book.localUri?.split(/[?#]/)[0] ?? '') &&
        loadGeneralPreferences().replaceEnableDefault),
    configuredReplaceRules = book.manualReplaceRuleIds
      ? replaceRules
          .filter(rule => book.manualReplaceRuleIds?.includes(rule.id))
          .map(rule => ({
            ...rule,
            isEnabled: true,
            scope: undefined,
            excludeScope: undefined,
          }))
      : automaticReplaceEnabled
        ? replaceRules
        : [],
    effectiveReplaceRules = previewReplacementRules(
      configuredReplaceRules,
      replaceRules,
      replacePreviewActive,
    ),
    replaceContext = { name: book.name, origin: book.id },
    contentBeforeSegment =
      book.removeDuplicateTitle ||
      book.removeDuplicateTitleChapterIds?.includes(chapter.id)
        ? removeDuplicateChapterTitle(chapter.content, chapter.title)
        : chapter.content,
    contentBeforeSpecialStyle = book.reSegment
      ? reSegmentText(contentBeforeSegment, chapter.title)
      : contentBeforeSegment,
    contentBeforeReplace = applyReaderSpecialStylePreference(
      contentBeforeSpecialStyle,
      prefs.adaptSpecialStyle,
    ),
    protectedReplaceContent = protectReaderHtmlMarkers(contentBeforeReplace),
    effectiveTitleRules = effectiveReplaceRuleHits(
      chapter.title,
      effectiveReplaceRules,
      'title',
      replaceContext,
    ),
    effectiveContentRules = effectiveReplaceRuleHits(
      protectedReplaceContent.text,
      effectiveReplaceRules,
      'content',
      replaceContext,
    ),
    effectiveRuleRows = [
      ...new Map(
        [...effectiveTitleRules, ...effectiveContentRules].map(rule => [
          rule.id,
          {
            rule,
            title: effectiveTitleRules.some(item => item.id === rule.id),
            content: effectiveContentRules.some(item => item.id === rule.id),
          },
        ]),
      ).values(),
    ],
    tocEntries = readerTocEntries(
      chapters,
      tocQuery,
      item =>
        tocUseReplace
          ? applyReplaceRules(
              item.title,
              effectiveReplaceRules,
              'title',
              replaceContext,
            )
          : item.title,
      {
        collapsedVolumeIds: collapsedTocVolumes,
        reverseOrder: book.reverseToc === true,
      },
    ),
    visibleBookmarks = filterReaderBookmarks(bookmarks, tocQuery),
    visibleHighlights = filterReaderHighlights(highlights, tocQuery),
    replacedTitle = applyReplaceRules(
      chapter.title,
      effectiveReplaceRules,
      'title',
      replaceContext,
    ),
    replacedContent = protectedReplaceContent.restore(
      applyReplaceRules(
        protectedReplaceContent.text,
        effectiveReplaceRules,
        'content',
        replaceContext,
      ),
    ),
    displayContent = applyReaderTagPreferences(
      replacedContent,
      book.deleteRubyTag,
      book.deleteHeadingTag,
    )
      .split(/\n{2,}/)
      .map(paragraph => `${prefs.paragraphIndent}${paragraph}`)
      .join('\n\n'),
    scrollDisplayContent = prefs.adaptSpecialStyle
      ? stripSpecialPageBreaks(displayContent)
      : displayContent,
    pageRanges = paginateTextRanges(
      displayContent,
      pageCapacity,
      prefs.adaptSpecialStyle,
    ),
    pages = pageRanges.map(page => page.text),
    readerInfoValues: ReaderInfoValues = {
      bookName: book.name,
      chapterTitle: replacedTitle,
      time: new Date(clock).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      page: Math.min(pageIndex, pages.length - 1) + 1,
      totalPages: pages.length,
      readProgress: `${Math.round(((index + (Math.min(pageIndex, pages.length - 1) + 1) / pages.length) / chapters.length) * 100)}%`,
      chapter: index + 1,
      totalChapters: chapters.length,
    },
    mangaImages =
      book.sourceType === 2
        ? parseMangaImages(
            chapter.content,
            chapter.baseUrl ?? book.tocUrl ?? book.bookUrl ?? '',
          )
        : [],
    menuTitle = readerMenuTitle(
      book.name,
      replacedTitle,
      chapter.url,
      prefs.showReaderTitleAddition,
      prefs.showReaderTitleChapterNameOnly,
    ),
    menuTitleDetails = readerMenuTitleDetails(menuTitle.addition),
    progressState = readerProgressState(
      prefs.progressBarBehavior,
      pageIndex,
      pages.length,
      index,
      chapters.length,
    ),
    readerChrome = readerChromeColors(
      prefs.readerChromeFollowsPage,
      { background: palette.chrome, foreground: palette.foreground },
      { background: colors.surface, foreground: colors.text },
    ),
    change = (next: Partial<ReaderPreferences>) => {
      const value = normalizeReaderPreferences({
        ...storedPrefs,
        ...next,
        ...(appPreferences.themeMode === 'eink'
          ? {
              theme: storedPrefs.theme,
              pageAnimation: storedPrefs.pageAnimation,
              epaperPageAnimation:
                next.pageAnimation ?? storedPrefs.epaperPageAnimation,
            }
          : {}),
      });
      setPrefs(value);
      void saveReaderPreferences(value);
    },
    chooseBackground = async () => {
      try {
        const uri = await pickReaderBackground();
        if (prefs.theme === 'night') change({ nightBackgroundImage: uri });
        else if (prefs.theme === 'epaper')
          change({ epaperBackgroundImage: uri });
        else change({ paperBackgroundImage: uri });
        setBackgroundMessage(t('backgroundSaved'));
      } catch (error) {
        setBackgroundMessage(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    clearBackground = () => {
      if (prefs.theme === 'night') change({ nightBackgroundImage: '' });
      else if (prefs.theme === 'epaper') change({ epaperBackgroundImage: '' });
      else change({ paperBackgroundImage: '' });
      setBackgroundMessage(t('solidBackgroundRestored'));
    },
    persistChapter = (
      nextIndex: number,
      edge: 'start' | 'end' = 'start',
      restoredPosition?: number,
    ) => {
      if (chapterSwitchingRef.current) return;
      const safe = readableChapterIndex(
          chapters,
          nextIndex,
          nextIndex < index ? -1 : nextIndex > index ? 1 : 0,
        ),
        next = chapters[safe];
      if (!next) return;
      const commit = (
        updatedBook: Book,
        chapterIndex: number,
        content: string,
      ) => {
        const updatedChapters = updatedBook.chapters ?? chapters,
          resolvedChapter = updatedChapters[chapterIndex] ?? next,
          nextPageIndex =
            edge === 'end'
              ? spreadStart(
                  Math.max(
                    0,
                    paginateText(
                      applyReplaceRules(content, replaceRules, 'content', {
                        name: book.name,
                        origin: book.id,
                      }),
                      pageCapacity,
                      prefs.adaptSpecialStyle,
                    ).length - 1,
                  ),
                  pageColumns,
                )
              : 0;
        readingPosition.current?.flush();
        update({
          ...updatedBook,
          currentChapterIndex: chapterIndex,
          readingPosition: {
            chapterId: resolvedChapter.id,
            position: restoredPosition ?? (edge === 'end' ? 2147483647 : 0),
            titleVisible: true,
          },
          chapterTitle: resolvedChapter.title,
          content,
          progress: (chapterIndex + 1) / updatedChapters.length,
          updatedAt: Date.now(),
        });
        setIndex(chapterIndex);
        // A text bridge restores the explicit cursor (including a same-position seek).
        // Forcing page zero here would be interpreted as a fresh user movement.
        if (!readingPosition.current || resolvedChapter.id !== chapter.id)
          setPageIndex(nextPageIndex);
        setChapterTransition(undefined);
      };
      if (safe === index || next.content || !next.url || next.isVolume) {
        commit(book, safe, next.content ?? '');
        return;
      }

      chapterSwitchingRef.current = true;
      const request = ++chapterSwitchRequest.current;
      setChapterTransition({ targetIndex: safe, title: next.title });
      void (async () => {
        try {
          let content: string;
          try {
            const sources = await loadSources(),
              source = sources.find(item => item.bookSourceUrl === book.origin);
            if (!source) throw new Error(t('sourceMissing'));
            content = await loadChapterContent(source, {
              url: next.url!,
              title: next.title,
              index: safe,
              bookUrl: book.bookUrl ?? '',
              baseUrl: next.baseUrl ?? book.tocUrl ?? book.bookUrl ?? '',
              isVolume: !!next.isVolume,
              isVip: !!next.isVip,
              isPay: !!next.isPay,
            });
            if (request !== chapterSwitchRequest.current) return;
            const nextChapters = chapters.map((chapterItem, chapterIndex) =>
              chapterIndex === safe ? { ...chapterItem, content } : chapterItem,
            );
            commit({ ...book, chapters: nextChapters }, safe, content);
          } catch (primaryError) {
            if (request !== chapterSwitchRequest.current) return;
            addAppLog(
              `[reader-content] chapter transition failed book=${JSON.stringify(book.name)} chapterIndex=${safe} chapter=${JSON.stringify(next.title)} origin=${book.origin ?? ''} chapterUrl=${next.url ?? ''}`,
              primaryError,
            );
            if (!loadGeneralPreferences().autoChangeSource || !book.origin)
              throw primaryError;
            const switched = await autoSwitchSourceForChapter(
              book,
              safe,
              await loadSources(),
            );
            if (request !== chapterSwitchRequest.current) return;
            const resolvedIndex = switched.currentChapterIndex ?? safe,
              resolved = switched.chapters?.[resolvedIndex];
            if (!resolved?.content)
              throw new Error(t('chapterSwitchNoContent'));
            commit(switched, resolvedIndex, resolved.content);
          }
        } catch (error) {
          if (request !== chapterSwitchRequest.current) return;
          addAppLog(
            `[reader-content] chapter transition exhausted book=${JSON.stringify(book.name)} chapter=${JSON.stringify(next.title)}`,
            error,
          );
          setChapterTransition({
            targetIndex: safe,
            title: next.title,
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          if (request === chapterSwitchRequest.current)
            chapterSwitchingRef.current = false;
        }
      })();
    },
    saveCurrentChapter = () => {
      readingPosition.current?.flush();
      update({
        ...book,
        currentChapterIndex: index,
        chapterTitle: chapter.title,
        content: chapter.content,
        progress: (index + 1) / chapters.length,
        updatedAt: Date.now(),
      });
    },
    leave = () => {
      saveCurrentChapter();
      back();
    },
    leaveFor = (open: () => void) => {
      saveCurrentChapter();
      setAdvanced(false);
      open();
    },
    bookmarkId = `${book.id}:${chapter.id}`,
    marked = bookmarks.some(x => x.id === bookmarkId),
    toggleBookmark = () => {
      if (marked) removeBookmark(bookmarkId);
      else
        saveBookmark({
          id: bookmarkId,
          bookId: book.id,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          position: pageIndex * pageCapacity,
          excerpt: replacedContent
            .slice(pageIndex * pageCapacity, pageIndex * pageCapacity + 80)
            .trim(),
          createdAt: Date.now(),
        });
      setBookmarks(listBookmarks(book.id));
    },
    previousPage = () => {
      if (chapterSwitchingRef.current) return;
      pageDirection.current = -1;
      if (pageIndex > 0)
        setPageIndex(value => Math.max(0, value - pageColumns));
      else if (index > 0) {
        const previous = index - 1;
        persistChapter(previous, 'end');
      }
    },
    nextPage = () => {
      if (chapterSwitchingRef.current) return;
      pageDirection.current = 1;
      if (pageIndex + pageColumns < pages.length)
        setPageIndex(value => value + pageColumns);
      else if (index < chapters.length - 1) persistChapter(index + 1);
    },
    reverseCurrentContent = () => {
      const nextChapters = allChapters.map((item, chapterIndex) =>
        chapterIndex === index
          ? { ...item, content: reverseContentLines(item.content) }
          : item,
      );
      update({
        ...book,
        chapters: nextChapters,
        content: nextChapters[index]?.content ?? book.content,
        updatedAt: Date.now(),
      });
      setAdvancedMessage(t('contentReversed'));
    },
    toggleManualRule = (ruleId: number) => {
      const selected = new Set(book.manualReplaceRuleIds ?? []);
      if (selected.has(ruleId)) selected.delete(ruleId);
      else selected.add(ruleId);
      update({
        ...book,
        manualReplaceRuleIds: [...selected],
        updatedAt: Date.now(),
      });
    },
    saveSimulation = () => {
      try {
        const simulatedReading = normalizeSimulatedReading(
          {
            enabled: simulationEnabled,
            startDate: simulationDate,
            startChapter: Number(simulationStart),
            dailyChapters: Number(simulationDaily),
          },
          allChapters.length,
        );
        const nextBook = { ...book, simulatedReading, updatedAt: Date.now() };
        update(nextBook);
        setIndex(value =>
          Math.min(
            value,
            Math.max(
              0,
              simulatedChapterCount(nextBook, allChapters.length) - 1,
            ),
          ),
        );
        setAdvancedMessage(
          t(
            simulatedReading.enabled
              ? 'simulatedReadingEnabled'
              : 'simulatedReadingDisabled',
          ),
        );
      } catch {
        setAdvancedMessage(t('invalidSimulatedReading'));
      }
    },
    fetchRemoteProgress = async () => {
      setAdvancedMessage(t('loadingRemoteProgress'));
      try {
        const progress = await downloadWebDavBookProgress(
          loadWebDavConfig(),
          book,
        );
        setPendingProgress(progress ?? undefined);
        setAdvancedMessage(
          progress ? t('remoteProgressFound') : t('remoteProgressMissing'),
        );
      } catch (error) {
        setAdvancedMessage(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    overwriteRemoteProgress = async () => {
      setAdvancedMessage(t('uploadingProgress'));
      try {
        await uploadWebDavBookProgress(loadWebDavConfig(), {
          ...book,
          currentChapterIndex: index,
          chapterTitle: chapter.title,
        });
        setAdvancedMessage(t('progressUploaded'));
      } catch (error) {
        setAdvancedMessage(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    refreshCurrentChapter = async () => {
      setAdvancedMessage(t('refreshingCurrentChapter'));
      setRemoteLoading(chapter.id);
      try {
        const sources = await loadSources(),
          source = sources.find(item => item.bookSourceUrl === book.origin);
        if (!source) throw new Error(t('sourceMissing'));
        const refreshed = await refreshReaderChapter(book, index, source);
        update(refreshed);
        setAdvancedMessage(t('currentChapterRefreshed'));
      } catch (error) {
        setAdvancedMessage(
          t('refreshCurrentChapterFailed', {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      } finally {
        setRemoteLoading('');
      }
    },
    updateOnlineToc = async () => {
      setAdvancedMessage(t('updatingOnlineToc'));
      try {
        const sources = await loadSources(),
          source = sources.find(item => item.bookSourceUrl === book.origin);
        if (!source) throw new Error(t('sourceMissing'));
        const refreshed = await refreshReaderToc(book, source);
        setIndex(refreshed.currentChapterIndex ?? 0);
        setPageIndex(0);
        update(refreshed);
        setAdvancedMessage(
          t('onlineTocUpdated', { count: refreshed.chapters?.length ?? 0 }),
        );
      } catch (error) {
        setAdvancedMessage(
          t('updateOnlineTocFailed', {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    },
    clearOnlineChapterCache = (scope: 'after' | 'all') => {
      update(clearReaderChapterCache(book, index, scope));
      setRefreshScopeConfirm(undefined);
      setAdvancedMessage(
        t(
          scope === 'all'
            ? 'allChapterCacheCleared'
            : 'laterChapterCacheCleared',
        ),
      );
    },
    readerMenuLabel = (key: ReaderMenuKey) =>
      t(
        {
          bookmark: marked ? 'removeBookmark' : 'addBookmark',
          highlightRule: 'highlightRules',
          editContent: 'editBook',
          pageAnim: 'pageAnimation',
          getProgress: 'getBookProgress',
          coverProgress: 'overwriteBookProgress',
          reverseContent: 'reverseCurrentContent',
          simulatedReading: 'simulatedReading',
          replace: 'replaceRules',
          sameTitleRemoved: 'removeDuplicateChapterTitle',
          reSegment: 'reSegmentAllChapters',
          delRubyTag: 'deleteRubyTag',
          delHTag: 'deleteHeadingTag',
          imageStyle: 'readerImageStyle',
          updateToc: 'updateOnlineToc',
          effectiveReplaces: 'effectiveReplaceRules',
          log: 'logs',
          help: 'readerHelp',
        }[key] as Parameters<typeof t>[0],
      ),
    readerMenuAvailable = (key: ReaderMenuKey) =>
      key === 'updateToc'
        ? !!book.origin && !!book.bookUrl
        : key === 'delRubyTag' || key === 'delHTag'
          ? /\.epub$/i.test(book.localUri?.split(/[?#]/)[0] ?? '') ||
            book.sourceType === 2
          : true,
    runReaderMenuAction = (key: ReaderMenuKey) => {
      if (key === 'bookmark') toggleBookmark();
      else if (key === 'highlightRule') leaveFor(openHighlightRules);
      else if (key === 'editContent') leaveFor(openEditor);
      else if (key === 'pageAnim') {
        setAdvanced(false);
        setConfig(true);
      } else if (key === 'getProgress') void fetchRemoteProgress();
      else if (key === 'coverProgress') void overwriteRemoteProgress();
      else if (key === 'reverseContent') reverseCurrentContent();
      else if (key === 'simulatedReading') {
        const enabled = !simulationEnabled;
        setSimulationEnabled(enabled);
        const simulatedReading = normalizeSimulatedReading(
          {
            enabled,
            startDate: simulationDate,
            startChapter: Number(simulationStart),
            dailyChapters: Number(simulationDaily),
          },
          allChapters.length,
        );
        update({ ...book, simulatedReading, updatedAt: Date.now() });
      } else if (key === 'replace')
        update({
          ...book,
          useReplaceRules: !automaticReplaceEnabled,
          manualReplaceRuleIds: undefined,
          updatedAt: Date.now(),
        });
      else if (key === 'sameTitleRemoved') {
        const ids = new Set(book.removeDuplicateTitleChapterIds ?? []);
        if (ids.has(chapter.id)) ids.delete(chapter.id);
        else ids.add(chapter.id);
        update({
          ...book,
          removeDuplicateTitleChapterIds: [...ids],
          updatedAt: Date.now(),
        });
      } else if (key === 'reSegment')
        update({ ...book, reSegment: !book.reSegment, updatedAt: Date.now() });
      else if (key === 'delRubyTag')
        update({
          ...book,
          deleteRubyTag: !book.deleteRubyTag,
          updatedAt: Date.now(),
        });
      else if (key === 'delHTag')
        update({
          ...book,
          deleteHeadingTag: !book.deleteHeadingTag,
          updatedAt: Date.now(),
        });
      else if (key === 'imageStyle') {
        const styles = ['default', 'full', 'text', 'single'] as const,
          current = styles.indexOf(book.imageStyle ?? 'default');
        update({
          ...book,
          imageStyle: styles[(current + 1) % styles.length],
          updatedAt: Date.now(),
        });
      } else if (key === 'updateToc') void updateOnlineToc();
      else if (key === 'effectiveReplaces') {
        setAdvanced(false);
        setEffectiveReplaces(true);
      } else if (key === 'log') leaveFor(openLogs);
      else if (key === 'help') leaveFor(openHelp);
    };
  advanceMangaRef.current = () => {
    if (index < chapters.length - 1) persistChapter(index + 1);
  };
  previousPageRef.current = previousPage;
  nextPageRef.current = nextPage;
  const seekReaderProgress = (value: number) => {
    const target = normalizeReaderProgressTarget(value, progressState.max);
    if (prefs.progressBarBehavior === 'page') {
      const page = spreadStart(target, pageColumns);
      if (prefs.mode === 'scroll' && readingPosition.current)
        readingPosition.current.seekPage(page);
      else setPageIndex(page);
    } else if (target !== index) {
      if (chapterJumpConfirmed) persistChapter(target);
      else setPendingChapterJump(target);
    }
  };
  return (
    <View
      style={[
        s.reader,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          backgroundColor: palette.background,
        },
      ]}
    >
      <StatusBar
        hidden={prefs.hideStatusBar}
        barStyle={prefs.theme === 'night' ? 'light-content' : 'dark-content'}
      />
      {backgroundImage ? (
        <Image
          source={{ uri: backgroundImage }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <BookCatalogueStatus state={catalogue} />
      {chapter.content.trim() &&
      book.sourceType !== 2 &&
      readerContentSegments(displayContent).every(
        segment => segment.type === 'text',
      ) ? (
        <ReaderPositionBridge
          key={`${book.id}:${chapter.id}`}
          ref={readingPosition}
          book={book}
          chapterId={chapter.id}
          title={replacedTitle}
          text={prefs.mode === 'scroll' ? scrollDisplayContent : displayContent}
          pageText={displayContent}
          indent={prefs.paragraphIndent}
          honorSpecialPageBreaks={prefs.adaptSpecialStyle}
          mode={prefs.mode}
          pageIndex={pageIndex}
          columns={pageColumns}
          ranges={pageRanges}
          layoutKey={JSON.stringify([
            prefs.mode,
            displayContent,
            pageCapacity,
            pageColumns,
            window.width,
            window.height,
            prefs.fontSize,
            prefs.lineHeight,
            prefs.letterSpacing,
            prefs.textBold,
            prefs.textFullJustify,
            prefs.contentInsetHorizontal,
            prefs.contentInsetVertical,
            prefs.paragraphSpacing,
          ])}
          contentTop={64 + prefs.contentInsetVertical}
          setPageIndex={setPageIndex}
          scrollTo={y => textScroll.current?.scrollTo({ y, animated: false })}
          commit={update}
        />
      ) : null}
      {prefs.showReaderHeader ? (
        <ReaderInfoRow
          templates={[
            prefs.headerLeftTemplate,
            prefs.headerMiddleTemplate,
            prefs.headerRightTemplate,
          ]}
          values={readerInfoValues}
          color={palette.foreground}
          size={prefs.readerInfoTextSize}
          style={[
            s.readerInfoHeader,
            {
              top: safeLayout.infoTop,
              left: safeLayout.left + 16,
              right: safeLayout.right + 16,
            },
          ]}
        />
      ) : null}
      {prefs.showReaderFooter ? (
        <ReaderInfoRow
          templates={[
            prefs.footerLeftTemplate,
            prefs.footerMiddleTemplate,
            prefs.footerRightTemplate,
          ]}
          values={readerInfoValues}
          color={palette.foreground}
          size={prefs.readerInfoTextSize}
          style={[
            s.readerInfoFooter,
            {
              bottom: controls
                ? safeLayout.infoBottomWithControls
                : safeLayout.infoBottom,
              left: safeLayout.left + 16,
              right: safeLayout.right + 16,
            },
          ]}
        />
      ) : null}
      <View
        style={[
          s.flex,
          pullBookmarkPageOffset
            ? { transform: [{ translateY: pullBookmarkPageOffset }] }
            : undefined,
        ]}
        onTouchStart={event => {
          const touches = event.nativeEvent.touches;
          if (prefs.twoFingerReplacePreview && touches.length === 2) {
            replacePreviewGesture.current = true;
            replacePreviewTouches.current = touches.map(touch => ({
              x: touch.pageX,
              y: touch.pageY,
            }));
            pullBookmarkCandidate.current = false;
            if (replacePreviewTimer.current)
              clearTimeout(replacePreviewTimer.current);
            replacePreviewTimer.current = setTimeout(
              () => setReplacePreviewActive(true),
              600,
            );
            return;
          }
          touchStart.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          };
          pullBookmarkCandidate.current =
            prefs.pullToToggleBookmark &&
            (prefs.mode === 'page' || readerScrollAtTop.current);
        }}
        onTouchMove={event => {
          if (replacePreviewGesture.current) {
            const touches = event.nativeEvent.touches,
              moved = shouldCancelTwoFingerPreview(
                replacePreviewTouches.current,
                touches.map(touch => ({ x: touch.pageX, y: touch.pageY })),
              );
            if (moved) {
              if (replacePreviewTimer.current)
                clearTimeout(replacePreviewTimer.current);
              replacePreviewTimer.current = undefined;
              setReplacePreviewActive(false);
            }
            return;
          }
          if (!pullBookmarkCandidate.current) return;
          const deltaX = event.nativeEvent.pageX - touchStart.current.x,
            deltaY = event.nativeEvent.pageY - touchStart.current.y,
            state = pullBookmarkGesture({
              deltaX,
              deltaY,
              triggerDistance: prefs.pullBookmarkDistance,
            });
          if (state === 'none') {
            if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)
              pullBookmarkCandidate.current = false;
            return;
          }
          setPullBookmarkState(state);
          setPullBookmarkPageOffset(pullBookmarkOffset(deltaY, window.height));
        }}
        onTouchEnd={event => {
          if (replacePreviewGesture.current) {
            if (replacePreviewTimer.current)
              clearTimeout(replacePreviewTimer.current);
            replacePreviewTimer.current = undefined;
            setReplacePreviewActive(false);
            if (!event.nativeEvent.touches.length)
              replacePreviewGesture.current = false;
            return;
          }
          const touch = event.nativeEvent.changedTouches[0],
            x = touch?.pageX ?? touchStart.current.x,
            y = touch?.pageY ?? touchStart.current.y,
            pullState = pullBookmarkCandidate.current
              ? pullBookmarkGesture({
                  deltaX: x - touchStart.current.x,
                  deltaY: y - touchStart.current.y,
                  triggerDistance: prefs.pullBookmarkDistance,
                })
              : 'none';
          pullBookmarkCandidate.current = false;
          setPullBookmarkState('none');
          setPullBookmarkPageOffset(0);
          if (pullState === 'ready') {
            toggleBookmark();
            return;
          }
          const action = readerTouchAction({
            startX: touchStart.current.x,
            endX: x,
            width: window.width,
            mode: prefs.mode,
            swipeThreshold: prefs.pageSwipeThreshold,
            edgeInset: prefs.pageEdgeInset,
          });
          if (action === 'previous') previousPage();
          else if (action === 'next') nextPage();
          else if (action === 'controls') setControls(value => !value);
        }}
        onTouchCancel={() => {
          if (replacePreviewTimer.current)
            clearTimeout(replacePreviewTimer.current);
          replacePreviewTimer.current = undefined;
          replacePreviewGesture.current = false;
          setReplacePreviewActive(false);
          pullBookmarkCandidate.current = false;
          setPullBookmarkState('none');
          setPullBookmarkPageOffset(0);
        }}
      >
        {remoteLoading === chapter.id ? (
          <View style={s.center}>
            <ActivityIndicator color={palette.foreground} />
            <Text style={{ color: palette.foreground }}>
              {t('loadingChapter')}
            </Text>
          </View>
        ) : remoteError && chapter.url && !chapter.content ? (
          <View style={s.center}>
            <Text style={{ color: palette.foreground }}>{remoteError}</Text>
            <Pressable
              accessibilityRole="button"
              style={s.readerAction}
              onPress={() => setRemoteRetry(value => value + 1)}
            >
              <Text style={{ color: palette.foreground }}>{t('retry')}</Text>
            </Pressable>
          </View>
        ) : book.sourceType === 2 ? (
          <View style={s.flex}>
            {!mangaSpecialUi || !prefs.disableMangaTitle ? (
              <Text style={[s.chapter, { color: palette.foreground }]}>
                {replacedTitle}
              </Text>
            ) : null}
            <ScrollView
              ref={mangaScroll}
              key={chapter.id}
              horizontal={mangaHorizontal}
              pagingEnabled={
                mangaHorizontal && (!mangaSpecialUi || !prefs.mangaAutoScroll)
              }
              onContentSizeChange={(width, height) => {
                mangaExtent.current = mangaHorizontal ? width : height;
              }}
              onLayout={event => {
                mangaViewport.current = mangaHorizontal
                  ? event.nativeEvent.layout.width
                  : event.nativeEvent.layout.height;
              }}
              onScroll={event => {
                mangaOffset.current = mangaHorizontal
                  ? event.nativeEvent.contentOffset.x
                  : event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={50}
              contentContainerStyle={s.mangaContent}
            >
              {mangaImages.map((uri, imageIndex) => (
                <MangaImage
                  key={`${uri}:${imageIndex}`}
                  uri={uri}
                  index={imageIndex}
                  bookId={book.id}
                  headers={mangaHeaders}
                  fitScreen={mangaSpecialUi ? prefs.mangaFitScreen : true}
                  onTap={
                    mangaSpecialUi && prefs.mangaTapScroll
                      ? () => {
                          const max = Math.max(
                            0,
                            mangaExtent.current - mangaViewport.current,
                          );
                          mangaOffset.current = Math.min(
                            max,
                            mangaOffset.current + mangaViewport.current * 0.85,
                          );
                          mangaScroll.current?.scrollTo(
                            mangaHorizontal
                              ? { x: mangaOffset.current, y: 0, animated: true }
                              : {
                                  x: 0,
                                  y: mangaOffset.current,
                                  animated: true,
                                },
                          );
                        }
                      : () => setControls(value => !value)
                  }
                />
              ))}
              {!mangaImages.length ? (
                <Text style={{ color: palette.foreground }}>
                  {t('noMangaImages')}
                </Text>
              ) : null}
            </ScrollView>
          </View>
        ) : prefs.mode === 'scroll' ? (
          <ScrollView
            ref={textScroll}
            key={chapter.id}
            onLayout={event =>
              readingPosition.current?.onViewport(
                event.nativeEvent.layout.height,
              )
            }
            onContentSizeChange={(_width, height) =>
              readingPosition.current?.onExtent(height)
            }
            onScrollBeginDrag={() =>
              readingPosition.current?.onScrollBeginDrag()
            }
            onMomentumScrollEnd={() => readingPosition.current?.flush()}
            onScroll={event => {
              readerScrollAtTop.current =
                event.nativeEvent.contentOffset.y <= 0.5;
              readingPosition.current?.onScroll(
                event.nativeEvent.contentOffset.y,
              );
            }}
            scrollEventThrottle={32}
            contentContainerStyle={[
              s.readerContent,
              {
                paddingHorizontal: prefs.contentInsetHorizontal,
                paddingTop: 64 + prefs.contentInsetVertical,
                paddingBottom: 64 + prefs.contentInsetVertical,
              },
            ]}
          >
            <RuleHighlightedText
              text={replacedTitle}
              rules={highlightRules}
              target="title"
              context={`${book.name} ${book.origin ?? ''}`}
              highlightActionTrigger={prefs.highlightActionTrigger}
              onHighlightRule={setActiveHighlightRule}
              style={[s.chapter, { color: palette.foreground }]}
            />
            {scrollDisplayContent
              .split(/\n{2,}/)
              .map((paragraph, paragraphIndex) => (
                // TODO(htyf-native): React Native can expose normal selection but cannot programmatically expand the native selection range to this whole paragraph; see docs/htyf-migration-gaps.md.
                <View
                  key={`${paragraphIndex}:${paragraph.length}`}
                  onLayout={event =>
                    readingPosition.current?.onParagraphLayout(
                      paragraphIndex,
                      event.nativeEvent.layout.y,
                    )
                  }
                  style={[
                    s.reviewParagraph,
                    { marginBottom: prefs.paragraphSpacing },
                  ]}
                >
                  <ReaderRichContent
                    text={paragraph}
                    rules={highlightRules}
                    context={`${book.name} ${book.origin ?? ''}`}
                    selectable={prefs.selectText}
                    imageClickMode={prefs.imageClickMode}
                    imageStyle={book.imageStyle}
                    imageHeaders={mangaHeaders}
                    onPreview={setPreviewReaderImage}
                    onOpenLink={setPendingReaderLink}
                    highlightActionTrigger={prefs.highlightActionTrigger}
                    onHighlightRule={setActiveHighlightRule}
                    onTextLayout={event =>
                      readingPosition.current?.onTextLayout(
                        paragraphIndex,
                        event.nativeEvent.lines,
                      )
                    }
                    style={[
                      s.readerText,
                      {
                        color: palette.foreground,
                        fontSize: prefs.fontSize,
                        lineHeight: prefs.lineHeight,
                        letterSpacing: prefs.letterSpacing,
                        fontWeight: prefs.textBold ? '700' : '400',
                        textAlign: prefs.textFullJustify ? 'justify' : 'left',
                      },
                    ]}
                  />
                  {reviewCounts[paragraphIndex + 1] ? (
                    <Pressable
                      accessibilityRole="button"
                      style={s.reviewCount}
                      onPress={() => openReviews(index, paragraphIndex + 1)}
                    >
                      <Text style={{ color: palette.foreground }}>
                        {t('reviewCount', {
                          count: reviewCounts[paragraphIndex + 1],
                        })}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
          </ScrollView>
        ) : (
          <Animated.View
            style={[
              s.pageContent,
              {
                paddingHorizontal: prefs.contentInsetHorizontal,
                paddingTop: 64 + prefs.contentInsetVertical,
                paddingBottom: 64 + prefs.contentInsetVertical,
              },
              prefs.pageAnimation === 'fade'
                ? { opacity: pageMotion }
                : prefs.pageAnimation === 'cover'
                  ? {
                      opacity: pageMotion,
                      transform: [
                        {
                          translateX: pageMotion.interpolate({
                            inputRange: [0, 1],
                            outputRange: [
                              pageDirection.current * window.width * 0.35,
                              0,
                            ],
                          }),
                        },
                        {
                          scale: pageMotion.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.96, 1],
                          }),
                        },
                      ],
                    }
                  : prefs.pageAnimation === 'slide'
                    ? {
                        transform: [
                          {
                            translateX: pageMotion.interpolate({
                              inputRange: [0, 1],
                              outputRange: [
                                pageDirection.current * window.width,
                                0,
                              ],
                            }),
                          },
                        ],
                      }
                    : undefined,
            ]}
          >
            <RuleHighlightedText
              text={replacedTitle}
              rules={highlightRules}
              target="title"
              context={`${book.name} ${book.origin ?? ''}`}
              highlightActionTrigger={prefs.highlightActionTrigger}
              onHighlightRule={setActiveHighlightRule}
              style={[s.chapter, { color: palette.foreground }]}
            />
            <View style={pageColumns === 2 ? s.readerSpread : s.flex}>
              {Array.from({ length: pageColumns }, (_, column) => {
                const physicalPage = pageIndex + column;
                if (physicalPage >= pages.length)
                  return <View key={column} style={s.readerSpreadPage} />;
                return (
                  <View
                    key={physicalPage}
                    style={[
                      s.readerSpreadPage,
                      column > 0 && {
                        borderLeftWidth: StyleSheet.hairlineWidth,
                        borderLeftColor: `${palette.foreground}33`,
                        paddingLeft: 18,
                      },
                    ]}
                  >
                    <ReaderRichContent
                      text={pages[physicalPage]}
                      rules={highlightRules}
                      context={`${book.name} ${book.origin ?? ''}`}
                      selectable={prefs.selectText}
                      imageClickMode={prefs.imageClickMode}
                      imageStyle={book.imageStyle}
                      specialHtmlPageHeight={Math.max(
                        120,
                        window.height - 160 - prefs.contentInsetVertical * 2,
                      )}
                      imageHeaders={mangaHeaders}
                      onPreview={setPreviewReaderImage}
                      onOpenLink={setPendingReaderLink}
                      highlightActionTrigger={prefs.highlightActionTrigger}
                      onHighlightRule={setActiveHighlightRule}
                      style={[
                        s.readerText,
                        {
                          color: palette.foreground,
                          fontSize: prefs.fontSize,
                          lineHeight: prefs.lineHeight,
                          letterSpacing: prefs.letterSpacing,
                          fontWeight: prefs.textBold ? '700' : '400',
                          textAlign: prefs.textFullJustify ? 'justify' : 'left',
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}
      </View>
      {chapterTransition ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            s.chapterTransition,
            {
              top: safeLayout.top + 76,
              backgroundColor: readerChrome.background,
              borderColor: `${readerChrome.foreground}22`,
            },
          ]}
        >
          {chapterTransition.error ? (
            <>
              <Text
                style={{ color: readerChrome.foreground, fontWeight: '700' }}
              >
                {t('chapterSwitchFailed', { chapter: chapterTransition.title })}
              </Text>
              <Text
                numberOfLines={2}
                style={{ color: readerChrome.foreground, opacity: 0.75 }}
              >
                {chapterTransition.error}
              </Text>
              <View style={s.chapterTransitionActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('retry')}
                  style={s.chapterTransitionButton}
                  onPress={() => {
                    const target = chapterTransition.targetIndex;
                    setChapterTransition(undefined);
                    persistChapter(target);
                  }}
                >
                  <Text
                    style={{
                      color: readerChrome.foreground,
                      fontWeight: '700',
                    }}
                  >
                    {t('retry')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('close')}
                  style={s.chapterTransitionButton}
                  onPress={() => setChapterTransition(undefined)}
                >
                  <Text style={{ color: readerChrome.foreground }}>
                    {t('close')}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={s.chapterTransitionLoading}>
              <ActivityIndicator color={readerChrome.foreground} size="small" />
              <Text
                numberOfLines={1}
                style={{ color: readerChrome.foreground, flex: 1 }}
              >
                {t('chapterSwitchLoading', {
                  chapter: chapterTransition.title,
                })}
              </Text>
            </View>
          )}
        </View>
      ) : null}
      {pullBookmarkState !== 'none' ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            s.pullBookmarkHint,
            {
              top: safeLayout.hintTop,
              backgroundColor: readerChrome.background,
            },
          ]}
        >
          <Text style={{ color: readerChrome.foreground, fontWeight: '700' }}>
            {t(
              pullBookmarkState === 'ready'
                ? marked
                  ? 'releaseToRemoveBookmark'
                  : 'releaseToAddBookmark'
                : marked
                  ? 'pullToRemoveBookmark'
                  : 'pullToAddBookmark',
            )}
          </Text>
        </View>
      ) : null}
      {controls ? (
        <>
          <View
            style={[
              s.readerTop,
              {
                top: safeLayout.top + 8,
                left: safeLayout.left + 12,
                right: window.width - safeLayout.topRight + 12,
                backgroundColor: readerChrome.background,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('back')}
              style={({ pressed }) => [
                s.readerButton,
                pressed && s.readerButtonPressed,
              ]}
              onPress={leave}
            >
              <Text style={[s.readerIcon, { color: readerChrome.foreground }]}>
                ‹
              </Text>
            </Pressable>
            <View style={s.readerTitleBox}>
              <Text
                numberOfLines={1}
                style={[s.readerTitle, { color: readerChrome.foreground }]}
              >
                {menuTitle.primary}
              </Text>
              {menuTitleDetails.chapter ? (
                <Text
                  numberOfLines={1}
                  style={[
                    s.readerTitleChapter,
                    { color: readerChrome.foreground },
                  ]}
                >
                  {menuTitleDetails.chapter}
                </Text>
              ) : null}
              {menuTitleDetails.sourceUrl ? (
                <Text
                  numberOfLines={1}
                  style={[
                    s.readerTitleSource,
                    { color: readerChrome.foreground },
                  ]}
                >
                  {menuTitleDetails.sourceUrl}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                marked ? t('removeBookmark') : t('addBookmark')
              }
              style={({ pressed }) => [
                s.readerButton,
                pressed && s.readerButtonPressed,
              ]}
              onPress={toggleBookmark}
            >
              <Text style={{ fontSize: 24, color: readerChrome.foreground }}>
                {marked ? '★' : '☆'}
              </Text>
            </Pressable>
          </View>
          <View
            style={[
              s.readerProgressBar,
              {
                left: safeLayout.left + 12,
                right: safeLayout.right + 12,
                bottom: safeLayout.progressBottom,
                backgroundColor: readerChrome.background,
              },
            ]}
          >
            <Text
              style={[s.readerProgressText, { color: readerChrome.foreground }]}
            >
              {t(
                prefs.progressBarBehavior === 'page'
                  ? 'readerPageProgress'
                  : 'readerChapterProgress',
                {
                  current: progressState.current,
                  total: progressState.total,
                },
              )}
            </Text>
            <ReaderProgressSlider
              label={t(
                prefs.progressBarBehavior === 'page'
                  ? 'readerPageProgressLabel'
                  : 'readerChapterProgressLabel',
              )}
              max={progressState.max}
              value={progressState.value}
              step={prefs.progressBarBehavior === 'page' ? pageColumns : 1}
              minimumTrackTintColor={readerChrome.foreground}
              maximumTrackTintColor={`${readerChrome.foreground}55`}
              disabled={
                progressState.max === 0 ||
                (!!chapterTransition && !chapterTransition.error)
              }
              onSeek={seekReaderProgress}
            />
          </View>
          <View
            style={[
              s.readerBottom,
              {
                left: safeLayout.left + 12,
                right: safeLayout.right + 12,
                bottom: safeLayout.bottom + 8,
                backgroundColor: readerChrome.background,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('previousChapter')}
              disabled={
                index === 0 || (!!chapterTransition && !chapterTransition.error)
              }
              style={({ pressed }) => [
                s.readerMainAction,
                (index === 0 ||
                  (!!chapterTransition && !chapterTransition.error)) &&
                  s.readerActionDisabled,
                pressed && s.readerActionPressed,
              ]}
              onPress={() => persistChapter(index - 1)}
            >
              <Text
                style={[
                  s.readerActionSymbol,
                  { color: index === 0 ? '#999' : readerChrome.foreground },
                ]}
              >
                ‹
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: index === 0 ? '#999' : readerChrome.foreground,
                  fontSize: 11,
                }}
              >
                {t('previousChapter')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('toc')}
              style={({ pressed }) => [
                s.readerMainAction,
                pressed && s.readerActionPressed,
              ]}
              onPress={() => {
                setBookmarks(listBookmarks(book.id));
                setHighlights(listHighlights(book.id));
                setToc(true);
              }}
            >
              <Text
                style={[
                  s.readerActionSymbol,
                  { color: readerChrome.foreground },
                ]}
              >
                ☷
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: readerChrome.foreground, fontSize: 11 }}
              >
                {t('toc')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('readAloud')}
              style={({ pressed }) => [
                s.readerMainAction,
                pressed && s.readerActionPressed,
              ]}
              onPress={() => setReadAloudVisible(true)}
            >
              <ReadAloudIcon color={readerChrome.foreground} />
              <Text
                numberOfLines={1}
                style={{ color: readerChrome.foreground, fontSize: 11 }}
              >
                {t('readAloud')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('readerSettings')}
              style={({ pressed }) => [
                s.readerMainAction,
                pressed && s.readerActionPressed,
              ]}
              onPress={() => setQuickStyleVisible(true)}
            >
              <Text
                style={[
                  s.readerActionSymbol,
                  { color: readerChrome.foreground },
                ]}
              >
                Aa
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: readerChrome.foreground, fontSize: 11 }}
              >
                {t('readerSettings')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nextChapter')}
              disabled={
                index === chapters.length - 1 ||
                (!!chapterTransition && !chapterTransition.error)
              }
              style={({ pressed }) => [
                s.readerMainAction,
                (index === chapters.length - 1 ||
                  (!!chapterTransition && !chapterTransition.error)) &&
                  s.readerActionDisabled,
                pressed && s.readerActionPressed,
              ]}
              onPress={() => persistChapter(index + 1)}
            >
              <Text
                style={[
                  s.readerActionSymbol,
                  {
                    color:
                      index === chapters.length - 1
                        ? '#999'
                        : readerChrome.foreground,
                  },
                ]}
              >
                ›
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color:
                    index === chapters.length - 1
                      ? '#999'
                      : readerChrome.foreground,
                  fontSize: 11,
                }}
              >
                {t('nextChapter')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('readerMenuMore')}
              style={({ pressed }) => [
                s.readerMainAction,
                pressed && s.readerActionPressed,
              ]}
              onPress={() => setReaderToolsVisible(true)}
            >
              <Text
                style={[
                  s.readerActionSymbol,
                  { color: readerChrome.foreground },
                ]}
              >
                •••
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: readerChrome.foreground, fontSize: 11 }}
              >
                {t('readerMenuMore')}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
      <ReadAloudSheet
        visible={readAloudVisible}
        focused={focused}
        onDismiss={() => setReadAloudVisible(false)}
        content={displayContent}
        chapterTitle={chapter.title}
        openEngines={openSpeechEngines}
        previousChapter={
          index > 0 ? () => persistChapter(index - 1) : undefined
        }
        nextChapter={
          index < chapters.length - 1
            ? () => persistChapter(index + 1)
            : undefined
        }
      />
      <InTreeSheet
        visible={quickStyleVisible}
        onDismiss={() => setQuickStyleVisible(false)}
      >
        <Text
          accessibilityRole="header"
          style={[s.sectionTitle, { color: colors.text }]}
        >
          {t('readerSettings')}
        </Text>
        <SettingStepper
          label={t('fontSize')}
          value={prefs.fontSize}
          decrease={() => change({ fontSize: prefs.fontSize - 1 })}
          increase={() => change({ fontSize: prefs.fontSize + 1 })}
        />
        <SettingStepper
          label={t('lineSpacing')}
          value={prefs.lineHeight}
          decrease={() => change({ lineHeight: prefs.lineHeight - 2 })}
          increase={() => change({ lineHeight: prefs.lineHeight + 2 })}
        />
        <Text style={[s.settingLabel, { color: colors.text }]}>
          {t('background')}
        </Text>
        <View style={s.themeRow}>
          {(
            [
              ['paper', t('paper')],
              ['green', t('eyeCare')],
              ['night', t('night')],
              ['epaper', t('epaper')],
            ] as Array<[ReaderTheme, string]>
          ).map(([theme, label]) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected: prefs.theme === theme }}
              key={theme}
              style={[s.theme, prefs.theme === theme && s.themeActive]}
              onPress={() => change({ theme })}
            >
              <Text>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          style={[s.quickStyleMore, { borderColor: colors.border }]}
          onPress={() => {
            setQuickStyleVisible(false);
            setConfig(true);
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            {t('moreTypographySettings')}
          </Text>
          <Text style={{ color: colors.primary }}>›</Text>
        </Pressable>
      </InTreeSheet>
      <InTreeSheet
        visible={readerToolsVisible}
        onDismiss={() => setReaderToolsVisible(false)}
      >
        <Text
          accessibilityRole="header"
          style={[s.sectionTitle, { color: colors.text }]}
        >
          {t('readerTools')}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={s.readerToolAction}
          onPress={() => {
            setReaderToolsVisible(false);
            setContentSearch(true);
          }}
        >
          <Text style={{ color: colors.text }}>{t('contentSearch')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.readerToolAction}
          onPress={() => {
            setReaderToolsVisible(false);
            openReviews(index);
          }}
        >
          <Text style={{ color: colors.text }}>{t('reviews')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.readerToolAction}
          onPress={() => {
            setReaderToolsVisible(false);
            openLogs();
          }}
        >
          <Text style={{ color: colors.text }}>{t('logs')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.readerToolAction}
          onPress={() => {
            setReaderToolsVisible(false);
            setAdvanced(true);
          }}
        >
          <Text style={{ color: colors.text }}>{t('advanced')}</Text>
        </Pressable>
      </InTreeSheet>
      <ContentSearchSheet
        visible={contentSearch}
        book={book}
        chapters={chapters}
        onDismiss={() => setContentSearch(false)}
        onSelect={persistChapter}
      />
      <InTreeSheet
        visible={!!previewReaderImage}
        onDismiss={() => setPreviewReaderImage(undefined)}
      >
        <Text accessibilityRole="header" style={s.sectionTitle}>
          {t('readerImagePreview')}
        </Text>
        {previewReaderImage ? (
          <Image
            accessibilityLabel={t('readerInlineImage')}
            source={{ uri: previewReaderImage.src, headers: mangaHeaders }}
            resizeMode="contain"
            style={{
              width: '100%',
              height: Math.min(window.height * 0.6, 560),
            }}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={s.readerAction}
          onPress={() => setPreviewReaderImage(undefined)}
        >
          <Text>{t('close')}</Text>
        </Pressable>
      </InTreeSheet>
      <InTreeSheet
        visible={!!pendingReaderLink}
        onDismiss={() => setPendingReaderLink('')}
      >
        <Text accessibilityRole="header" style={s.sectionTitle}>
          {t('openReaderLinkTitle')}
        </Text>
        <Text selectable style={s.body}>
          {pendingReaderLink}
        </Text>
        <Text style={s.muted}>{t('openReaderLinkWarning')}</Text>
        <View style={s.sheetActions}>
          <Pressable
            accessibilityRole="button"
            style={s.readerAction}
            onPress={() => setPendingReaderLink('')}
          >
            <Text>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.readerAction}
            onPress={() => {
              const target = pendingReaderLink;
              void Linking.openURL(target)
                .then(() => setPendingReaderLink(''))
                .catch(error =>
                  jssdk.showToast({
                    type: 'error',
                    title: t('openLinkFailed'),
                    description:
                      error instanceof Error ? error.message : String(error),
                  }),
                );
            }}
          >
            <Text>{t('openLink')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
      <InTreeSheet
        visible={!!activeHighlightRule}
        onDismiss={() => setActiveHighlightRule(undefined)}
      >
        <Text accessibilityRole="header" style={s.sectionTitle}>
          {t('highlightRuleActionTitle')}
        </Text>
        <Text style={s.body}>
          {highlightRules.find(rule => rule.id === activeHighlightRule?.ruleId)
            ?.name ?? t('highlightRuleFallback')}
        </Text>
        <Text numberOfLines={3} style={s.muted}>
          {activeHighlightRule?.text}
        </Text>
        <View style={s.sheetActions}>
          <Pressable
            accessibilityRole="button"
            style={s.readerAction}
            onPress={() => {
              const ruleId = activeHighlightRule?.ruleId;
              setActiveHighlightRule(undefined);
              if (ruleId !== undefined)
                leaveFor(() => openHighlightRules(ruleId));
            }}
          >
            <Text>{t('edit')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.readerAction}
            onPress={() => {
              const ruleId = activeHighlightRule?.ruleId,
                next = highlightRules.map(rule =>
                  rule.id === ruleId ? { ...rule, isEnabled: false } : rule,
                );
              setHighlightRules(next);
              saveHighlightRules(next);
              setActiveHighlightRule(undefined);
            }}
          >
            <Text style={{ color: colors.danger }}>
              {t('disableHighlightRule')}
            </Text>
          </Pressable>
        </View>
      </InTreeSheet>
      <InTreeSheet visible={toc} onDismiss={() => setToc(false)}>
        <View style={s.tocTabs}>
          {(['toc', 'bookmarks', 'highlights'] as const).map(tab => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tocTab === tab }}
              key={tab}
              style={[
                s.tocTab,
                tocTab === tab ? { borderColor: colors.primary } : null,
              ]}
              onPress={() => setTocTab(tab)}
            >
              <Text
                style={{ color: tocTab === tab ? colors.primary : colors.text }}
              >
                {tab === 'toc'
                  ? t('tocCount', { count: chapters.length })
                  : tab === 'bookmarks'
                    ? t('bookmarksCount', { count: bookmarks.length })
                    : t('highlightsCount', { count: highlights.length })}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          accessibilityLabel={
            tocTab === 'toc'
              ? t('searchToc')
              : tocTab === 'bookmarks'
                ? t('searchBookmarks')
                : t('searchHighlights')
          }
          value={tocQuery}
          onChangeText={setTocQuery}
          placeholder={
            tocTab === 'toc'
              ? t('searchToc')
              : tocTab === 'bookmarks'
                ? t('searchBookmarks')
                : t('searchHighlights')
          }
          placeholderTextColor={colors.muted}
          style={[
            s.tocSearch,
            { color: colors.text, borderColor: colors.border },
          ]}
        />
        {tocTab === 'toc' ? (
          <View style={s.tocActions}>
            <Pressable
              accessibilityRole="button"
              style={s.tocAction}
              disabled={(book.chapters?.length ?? 0) < 2}
              onPress={() => {
                const next = reverseBookToc(book, index),
                  nextIndex = next.currentChapterIndex ?? 0;
                setIndex(nextIndex);
                setPageIndex(0);
                setCollapsedTocVolumes(
                  defaultCollapsedVolumeIds(
                    next.chapters ?? [],
                    nextIndex,
                    next.tocExpanded !== false,
                    next.reverseToc === true,
                  ),
                );
                update(next);
              }}
            >
              <Text style={{ color: colors.primary }}>{t('reverseToc')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: book.tocExpanded !== false }}
              style={s.tocAction}
              onPress={() => {
                const expanded = book.tocExpanded === false;
                setCollapsedTocVolumes(
                  defaultCollapsedVolumeIds(
                    chapters,
                    index,
                    expanded,
                    book.reverseToc === true,
                  ),
                );
                update({
                  ...book,
                  tocExpanded: expanded,
                  updatedAt: Date.now(),
                });
              }}
            >
              <Text style={{ color: colors.primary }}>
                {book.tocExpanded !== false ? '✓ ' : ''}
                {t('expandToc')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: tocUseReplace }}
              style={s.tocAction}
              onPress={() => {
                const next = !tocUseReplace,
                  preferences = loadGeneralPreferences();
                setTocUseReplace(next);
                saveGeneralPreferences({
                  ...preferences,
                  tocUiUseReplace: next,
                });
              }}
            >
              <Text style={{ color: colors.primary }}>
                {tocUseReplace ? '✓ ' : ''}
                {t('tocUseReplace')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: tocCountWords }}
              style={s.tocAction}
              onPress={() => {
                const next = !tocCountWords,
                  preferences = loadGeneralPreferences();
                setTocCountWords(next);
                saveGeneralPreferences({ ...preferences, tocCountWords: next });
              }}
            >
              <Text style={{ color: colors.primary }}>
                {tocCountWords ? '✓ ' : ''}
                {t('showChapterWordCount')}
              </Text>
            </Pressable>
          </View>
        ) : null}
        <ScrollView>
          {tocTab === 'toc'
            ? tocEntries.map(
                ({
                  chapter: item,
                  index: i,
                  title,
                  depth,
                  isVolume,
                  collapsed,
                  chapterCount,
                }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: i === index }}
                    key={item.id}
                    style={[
                      s.tocItem,
                      { paddingLeft: 4 + depth * 18 },
                      isVolume ? { backgroundColor: colors.background } : null,
                    ]}
                    onPress={() => {
                      if (isVolume) {
                        setCollapsedTocVolumes(current => {
                          const next = new Set(current);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                        return;
                      }
                      persistChapter(i);
                      setToc(false);
                    }}
                  >
                    <View style={s.tocTitleBlock}>
                      <Text
                        numberOfLines={1}
                        style={i === index ? s.tocActive : s.body}
                      >
                        {isVolume ? (collapsed ? '› ' : '⌄ ') : ''}
                        {title}
                      </Text>
                      {isVolume ? (
                        <Text style={[s.muted, { color: colors.muted }]}>
                          {t('volumeChapterCount', {
                            count: chapterCount ?? 0,
                          })}
                        </Text>
                      ) : item.tag ||
                        (tocCountWords && chapterWordCount(item)) ? (
                        <Text style={[s.muted, { color: colors.muted }]}>
                          {[
                            item.tag,
                            tocCountWords ? chapterWordCount(item) : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    {bookmarks.some(x => x.chapterId === item.id) ? (
                      <Text>★</Text>
                    ) : null}
                  </Pressable>
                ),
              )
            : tocTab === 'bookmarks'
              ? visibleBookmarks.map(item => (
                  <View key={item.id} style={s.tocBookmarkRow}>
                    <Pressable
                      accessibilityRole="button"
                      style={s.tocBookmarkContent}
                      onPress={() => {
                        const target = readerBookmarkTarget(
                          chapters,
                          item,
                          pageCapacity,
                        );
                        if (!target) return;
                        persistChapter(target.chapterIndex);
                        setPageIndex(target.pageIndex);
                        setToc(false);
                      }}
                      onLongPress={() => {
                        setToc(false);
                        setEditingBookmark(item);
                        setBookmarkExcerptDraft(item.excerpt);
                      }}
                    >
                      <Text numberOfLines={1} style={s.body}>
                        {item.chapterTitle}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={[s.muted, { color: colors.muted }]}
                      >
                        {item.excerpt || t('chapterBookmark')}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('deleteBookmark')}
                      style={s.tocBookmarkDelete}
                      onPress={() => {
                        removeBookmark(item.id);
                        setBookmarks(listBookmarks(book.id));
                      }}
                    >
                      <Text style={{ color: colors.danger, fontSize: 24 }}>
                        ×
                      </Text>
                    </Pressable>
                  </View>
                ))
              : visibleHighlights.map(item => (
                  <View key={item.id} style={s.tocBookmarkRow}>
                    <Pressable
                      accessibilityRole="button"
                      style={s.tocBookmarkContent}
                      onPress={() => {
                        const target = readerHighlightTarget(
                          chapters,
                          item,
                          pageCapacity,
                        );
                        if (!target) return;
                        persistChapter(target.chapterIndex);
                        setPageIndex(target.pageIndex);
                        setToc(false);
                      }}
                      onLongPress={() => {
                        setToc(false);
                        setEditingHighlight(item);
                        setHighlightNoteDraft(item.note ?? '');
                        setHighlightColorDraft(item.color);
                      }}
                    >
                      <View style={s.highlightTitleRow}>
                        <View
                          style={[
                            s.highlightSwatch,
                            { backgroundColor: item.color },
                          ]}
                        />
                        <Text
                          numberOfLines={2}
                          style={[s.body, s.highlightText]}
                        >
                          {item.text}
                        </Text>
                      </View>
                      {item.note ? (
                        <Text
                          numberOfLines={2}
                          style={[s.muted, { color: colors.muted }]}
                        >
                          {item.note}
                        </Text>
                      ) : null}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('deleteHighlight')}
                      style={s.tocBookmarkDelete}
                      onPress={() => {
                        removeHighlight(item.id);
                        setHighlights(listHighlights(book.id));
                      }}
                    >
                      <Text style={{ color: colors.danger, fontSize: 24 }}>
                        ×
                      </Text>
                    </Pressable>
                  </View>
                ))}
          {tocTab === 'toc' && !tocEntries.length ? (
            <Text style={[s.muted, { color: colors.muted, padding: 20 }]}>
              {t('noTocMatches')}
            </Text>
          ) : tocTab === 'bookmarks' && !visibleBookmarks.length ? (
            <Text style={[s.muted, { color: colors.muted, padding: 20 }]}>
              {t('emptyBookmarks')}
            </Text>
          ) : tocTab === 'highlights' && !visibleHighlights.length ? (
            <Text style={[s.muted, { color: colors.muted, padding: 20 }]}>
              {t('emptyHighlights')}
            </Text>
          ) : null}
        </ScrollView>
      </InTreeSheet>
      <InTreeSheet
        visible={!!editingBookmark}
        onDismiss={() => {
          setEditingBookmark(undefined);
          setToc(true);
        }}
      >
        <Text style={s.sectionTitle}>{t('editBookmark')}</Text>
        <Text style={s.body}>{editingBookmark?.chapterTitle}</Text>
        <TextInput
          accessibilityLabel={t('bookmarkExcerpt')}
          multiline
          value={bookmarkExcerptDraft}
          onChangeText={setBookmarkExcerptDraft}
          placeholder={t('bookmarkExcerpt')}
          placeholderTextColor={colors.muted}
          style={[
            s.bookmarkEditor,
            { color: colors.text, borderColor: colors.border },
          ]}
        />
        <View style={s.bookmarkEditorActions}>
          <Pressable
            accessibilityRole="button"
            style={s.bookmarkEditorAction}
            onPress={() => {
              if (!editingBookmark) return;
              removeBookmark(editingBookmark.id);
              setBookmarks(listBookmarks(book.id));
              setEditingBookmark(undefined);
              setToc(true);
            }}
          >
            <Text style={{ color: colors.danger }}>{t('delete')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.bookmarkEditorAction}
            onPress={() => {
              if (!editingBookmark) return;
              saveBookmark({
                ...editingBookmark,
                excerpt: bookmarkExcerptDraft.trim(),
              });
              setBookmarks(listBookmarks(book.id));
              setEditingBookmark(undefined);
              setToc(true);
            }}
          >
            <Text style={{ color: colors.primary }}>{t('save')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
      <InTreeSheet
        visible={!!editingHighlight}
        onDismiss={() => {
          setEditingHighlight(undefined);
          setToc(true);
        }}
      >
        <Text style={s.sectionTitle}>{t('editHighlight')}</Text>
        <Text numberOfLines={3} style={s.body}>
          {editingHighlight?.text}
        </Text>
        <TextInput
          accessibilityLabel={t('highlightNote')}
          multiline
          value={highlightNoteDraft}
          onChangeText={setHighlightNoteDraft}
          placeholder={t('highlightNotePlaceholder')}
          placeholderTextColor={colors.muted}
          style={[
            s.bookmarkEditor,
            { color: colors.text, borderColor: colors.border },
          ]}
        />
        <TextInput
          accessibilityLabel={t('highlightColor')}
          value={highlightColorDraft}
          onChangeText={setHighlightColorDraft}
          placeholder="#f2d35b"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={[
            s.highlightColorInput,
            { color: colors.text, borderColor: colors.border },
          ]}
        />
        <View style={s.bookmarkEditorActions}>
          <Pressable
            accessibilityRole="button"
            style={s.bookmarkEditorAction}
            onPress={() => {
              if (!editingHighlight) return;
              removeHighlight(editingHighlight.id);
              setHighlights(listHighlights(book.id));
              setEditingHighlight(undefined);
              setToc(true);
            }}
          >
            <Text style={{ color: colors.danger }}>{t('delete')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.bookmarkEditorAction}
            onPress={() => {
              if (!editingHighlight) return;
              const color = /^#[\da-f]{6}$/iu.test(highlightColorDraft.trim())
                ? highlightColorDraft.trim()
                : editingHighlight.color;
              saveHighlight({
                ...editingHighlight,
                color,
                note: highlightNoteDraft.trim() || undefined,
              });
              setHighlights(listHighlights(book.id));
              setEditingHighlight(undefined);
              setToc(true);
            }}
          >
            <Text style={{ color: colors.primary }}>{t('save')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
      <InTreeSheet visible={config} onDismiss={() => setConfig(false)}>
        <ScrollView contentContainerStyle={s.readerSettings}>
          <Text style={s.sectionTitle}>{t('readerSettings')}</Text>
          <SettingStepper
            label={t('fontSize')}
            value={prefs.fontSize}
            decrease={() => change({ fontSize: prefs.fontSize - 1 })}
            increase={() => change({ fontSize: prefs.fontSize + 1 })}
          />
          {/* TODO(htyf-native): Enable imported font files only after the pinned expo-font gap in docs/htyf-migration-gaps.md is resolved. */}
          <Text style={s.muted}>{t('customFontUnavailable')}</Text>
          {mangaSpecialUi ? (
            <>
              <View style={s.readerSwitch}>
                <Text>{t('mangaHorizontal')}</Text>
                <Switch
                  accessibilityLabel={t('mangaHorizontal')}
                  value={prefs.mangaHorizontal}
                  onValueChange={mangaHorizontal => change({ mangaHorizontal })}
                />
              </View>
              <View style={s.readerSwitch}>
                <Text>{t('hideMangaTitle')}</Text>
                <Switch
                  accessibilityLabel={t('hideMangaTitle')}
                  value={prefs.disableMangaTitle}
                  onValueChange={disableMangaTitle =>
                    change({ disableMangaTitle })
                  }
                />
              </View>
              <View style={s.readerSwitch}>
                <Text>{t('mangaFitScreen')}</Text>
                <Switch
                  accessibilityLabel={t('mangaFitScreen')}
                  value={prefs.mangaFitScreen}
                  onValueChange={mangaFitScreen => change({ mangaFitScreen })}
                />
              </View>
              <View style={s.readerSwitch}>
                <Text>{t('mangaTapScroll')}</Text>
                <Switch
                  accessibilityLabel={t('mangaTapScroll')}
                  value={prefs.mangaTapScroll}
                  onValueChange={mangaTapScroll => change({ mangaTapScroll })}
                />
              </View>
              <View style={s.readerSwitch}>
                <Text>{t('mangaAutoScroll')}</Text>
                <Switch
                  accessibilityLabel={t('mangaAutoScroll')}
                  value={prefs.mangaAutoScroll}
                  onValueChange={mangaAutoScroll => change({ mangaAutoScroll })}
                />
              </View>
              <View style={s.readerSwitch}>
                <Text>{t('mangaAutoNext')}</Text>
                <Switch
                  accessibilityLabel={t('mangaAutoNext')}
                  value={prefs.mangaAutoNext}
                  onValueChange={mangaAutoNext => change({ mangaAutoNext })}
                />
              </View>
              <SettingStepper
                label={t('mangaAutoScrollSpeed')}
                value={prefs.mangaAutoScrollSpeed}
                decrease={() =>
                  change({
                    mangaAutoScrollSpeed: prefs.mangaAutoScrollSpeed - 5,
                  })
                }
                increase={() =>
                  change({
                    mangaAutoScrollSpeed: prefs.mangaAutoScrollSpeed + 5,
                  })
                }
              />
            </>
          ) : null}
          <SettingStepper
            label={t('lineSpacing')}
            value={prefs.lineHeight}
            decrease={() => change({ lineHeight: prefs.lineHeight - 2 })}
            increase={() => change({ lineHeight: prefs.lineHeight + 2 })}
          />
          <SettingStepper
            label={t('letterSpacing')}
            value={Math.round(prefs.letterSpacing * 10) / 10}
            decrease={() =>
              change({ letterSpacing: prefs.letterSpacing - 0.1 })
            }
            increase={() =>
              change({ letterSpacing: prefs.letterSpacing + 0.1 })
            }
          />
          <SettingStepper
            label={t('paragraphSpacing')}
            value={prefs.paragraphSpacing}
            decrease={() =>
              change({ paragraphSpacing: prefs.paragraphSpacing - 1 })
            }
            increase={() =>
              change({ paragraphSpacing: prefs.paragraphSpacing + 1 })
            }
          />
          <SettingStepper
            label={t('horizontalInsets')}
            value={prefs.contentInsetHorizontal}
            decrease={() =>
              change({
                contentInsetHorizontal: prefs.contentInsetHorizontal - 2,
              })
            }
            increase={() =>
              change({
                contentInsetHorizontal: prefs.contentInsetHorizontal + 2,
              })
            }
          />
          <SettingStepper
            label={t('verticalInsets')}
            value={prefs.contentInsetVertical}
            decrease={() =>
              change({ contentInsetVertical: prefs.contentInsetVertical - 2 })
            }
            increase={() =>
              change({ contentInsetVertical: prefs.contentInsetVertical + 2 })
            }
          />
          <View style={s.readerSwitch}>
            <Text>{t('boldText')}</Text>
            <Switch
              accessibilityLabel={t('boldText')}
              value={prefs.textBold}
              onValueChange={textBold => change({ textBold })}
            />
          </View>
          <View style={s.readerSwitch}>
            <Text>{t('paragraphIndent')}</Text>
            <Switch
              accessibilityLabel={t('paragraphIndent')}
              value={!!prefs.paragraphIndent}
              onValueChange={enabled =>
                change({ paragraphIndent: enabled ? '　　' : '' })
              }
            />
          </View>
          <View style={s.readerSwitch}>
            <Text>{t('textFullJustify')}</Text>
            <Switch
              accessibilityLabel={t('textFullJustify')}
              value={prefs.textFullJustify}
              onValueChange={textFullJustify => change({ textFullJustify })}
            />
          </View>
          <View style={s.readerSwitch}>
            <Text>{t('selectReaderText')}</Text>
            <Switch
              accessibilityLabel={t('selectReaderText')}
              value={prefs.selectText}
              onValueChange={selectText => change({ selectText })}
            />
          </View>
          <View style={s.readerSwitch}>
            <Text>{t('pullToToggleBookmark')}</Text>
            <Switch
              accessibilityLabel={t('pullToToggleBookmark')}
              value={prefs.pullToToggleBookmark}
              onValueChange={pullToToggleBookmark =>
                change({ pullToToggleBookmark })
              }
            />
          </View>
          <View style={s.readerSwitch}>
            <Text>{t('showReaderTitleAddition')}</Text>
            <Switch
              accessibilityLabel={t('showReaderTitleAddition')}
              value={prefs.showReaderTitleAddition}
              onValueChange={showReaderTitleAddition =>
                change({ showReaderTitleAddition })
              }
            />
          </View>
          <View style={s.readerSwitch}>
            <Text>{t('showReaderTitleChapterNameOnly')}</Text>
            <Switch
              accessibilityLabel={t('showReaderTitleChapterNameOnly')}
              disabled={!prefs.showReaderTitleAddition}
              value={prefs.showReaderTitleChapterNameOnly}
              onValueChange={showReaderTitleChapterNameOnly =>
                change({ showReaderTitleChapterNameOnly })
              }
            />
          </View>
          <Text style={s.settingLabel}>{t('background')}</Text>
          <View style={s.themeRow}>
            {(
              [
                ['paper', t('paper')],
                ['green', t('eyeCare')],
                ['night', t('night')],
                ['epaper', t('epaper')],
              ] as Array<[ReaderTheme, string]>
            ).map(([theme, label]) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ selected: prefs.theme === theme }}
                key={theme}
                style={[s.theme, prefs.theme === theme && s.themeActive]}
                onPress={() => change({ theme })}
              >
                <Text>{label}</Text>
              </Pressable>
            ))}
          </View>
          {prefs.theme === 'paper' ? (
            <>
              <ReaderColorField
                label={t('dayBackground')}
                value={prefs.paperBackground}
                change={paperBackground => change({ paperBackground })}
              />
              <ReaderColorField
                label={t('dayText')}
                value={prefs.paperForeground}
                change={paperForeground => change({ paperForeground })}
              />
            </>
          ) : prefs.theme === 'night' ? (
            <>
              <ReaderColorField
                label={t('nightBackground')}
                value={prefs.nightBackground}
                change={nightBackground => change({ nightBackground })}
              />
              <ReaderColorField
                label={t('nightText')}
                value={prefs.nightForeground}
                change={nightForeground => change({ nightForeground })}
              />
            </>
          ) : prefs.theme === 'epaper' ? (
            <>
              <ReaderColorField
                label={t('epaperBackground')}
                value={prefs.epaperBackground}
                change={epaperBackground => change({ epaperBackground })}
              />
              <ReaderColorField
                label={t('epaperText')}
                value={prefs.epaperForeground}
                change={epaperForeground => change({ epaperForeground })}
              />
            </>
          ) : null}
          {prefs.theme !== 'green' ? (
            <View style={s.readerBackgroundActions}>
              <Pressable
                accessibilityRole="button"
                style={s.readerBackgroundButton}
                onPress={() => void chooseBackground()}
              >
                <Text>{t('chooseBackground')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.readerBackgroundButton}
                onPress={clearBackground}
              >
                <Text>{t('useSolid')}</Text>
              </Pressable>
            </View>
          ) : null}
          {backgroundMessage ? (
            <Text style={s.muted}>{backgroundMessage}</Text>
          ) : null}
          <View style={s.readerSwitch}>
            <Text>{t('showHeader')}</Text>
            <Switch
              accessibilityLabel={t('showHeader')}
              value={prefs.showReaderHeader}
              onValueChange={showReaderHeader => change({ showReaderHeader })}
            />
          </View>
          <View style={s.readerSwitch}>
            <Text>{t('showFooter')}</Text>
            <Switch
              accessibilityLabel={t('showFooter')}
              value={prefs.showReaderFooter}
              onValueChange={showReaderFooter => change({ showReaderFooter })}
            />
          </View>
          <SettingStepper
            label={t('readerInfoSize')}
            value={prefs.readerInfoTextSize}
            decrease={() =>
              change({ readerInfoTextSize: prefs.readerInfoTextSize - 1 })
            }
            increase={() =>
              change({ readerInfoTextSize: prefs.readerInfoTextSize + 1 })
            }
          />
          <ReaderTemplateField
            label={t('headerLeft')}
            value={prefs.headerLeftTemplate}
            change={headerLeftTemplate => change({ headerLeftTemplate })}
          />
          <ReaderTemplateField
            label={t('headerMiddle')}
            value={prefs.headerMiddleTemplate}
            change={headerMiddleTemplate => change({ headerMiddleTemplate })}
          />
          <ReaderTemplateField
            label={t('headerRight')}
            value={prefs.headerRightTemplate}
            change={headerRightTemplate => change({ headerRightTemplate })}
          />
          <ReaderTemplateField
            label={t('footerLeft')}
            value={prefs.footerLeftTemplate}
            change={footerLeftTemplate => change({ footerLeftTemplate })}
          />
          <ReaderTemplateField
            label={t('footerMiddle')}
            value={prefs.footerMiddleTemplate}
            change={footerMiddleTemplate => change({ footerMiddleTemplate })}
          />
          <ReaderTemplateField
            label={t('footerRight')}
            value={prefs.footerRightTemplate}
            change={footerRightTemplate => change({ footerRightTemplate })}
          />
          <Text style={s.muted}>{t('templateHelp')}</Text>
          {prefs.mode === 'page' ? (
            <>
              <Text style={s.settingLabel}>{t('pageAnimation')}</Text>
              <View style={s.themeRow}>
                {(
                  [
                    ['none', t('none')],
                    ['slide', t('slide')],
                    ['cover', t('cover')],
                    ['fade', t('fade')],
                  ] as Array<[PageAnimation, string]>
                ).map(([pageAnimation, label]) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected: prefs.pageAnimation === pageAnimation,
                    }}
                    key={pageAnimation}
                    style={[
                      s.theme,
                      prefs.pageAnimation === pageAnimation && s.themeActive,
                    ]}
                    onPress={() => change({ pageAnimation })}
                  >
                    <Text>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          <Text style={s.settingLabel}>{t('readingMode')}</Text>
          <View style={s.themeRow}>
            {(['scroll', 'page'] as const).map(mode => (
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={
                  mode === 'scroll' ? t('scrollReading') : t('pageReading')
                }
                accessibilityState={{ selected: prefs.mode === mode }}
                key={mode}
                style={[s.theme, prefs.mode === mode && s.themeActive]}
                onPress={() => change({ mode })}
              >
                <Text>{mode === 'scroll' ? t('scroll') : t('page')}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.settingLabel}>{t('readerProgressBehavior')}</Text>
          <View style={s.themeRow}>
            {(['page', 'chapter'] as const).map(progressBarBehavior => (
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={
                  progressBarBehavior === 'page'
                    ? t('progressByPage')
                    : t('progressByChapter')
                }
                accessibilityState={{
                  selected: prefs.progressBarBehavior === progressBarBehavior,
                }}
                key={progressBarBehavior}
                style={[
                  s.theme,
                  prefs.progressBarBehavior === progressBarBehavior &&
                    s.themeActive,
                ]}
                onPress={() => change({ progressBarBehavior })}
              >
                <Text>
                  {progressBarBehavior === 'page'
                    ? t('progressByPage')
                    : t('progressByChapter')}
                </Text>
              </Pressable>
            ))}
          </View>
          <SettingStepper
            label={t('brightness')}
            value={Math.round(prefs.brightness * 100)}
            decrease={() => change({ brightness: prefs.brightness - 0.1 })}
            increase={() => change({ brightness: prefs.brightness + 0.1 })}
          />
          <View style={s.readerSwitch}>
            <Text>{t('showBrightnessOverlay')}</Text>
            <Switch
              accessibilityLabel={t('showBrightnessOverlay')}
              value={prefs.showBrightnessOverlay}
              onValueChange={showBrightnessOverlay =>
                change({ showBrightnessOverlay })
              }
            />
          </View>
          <SettingStepper
            label={t('pageSwipeThreshold')}
            value={prefs.pageSwipeThreshold}
            decrease={() =>
              change({ pageSwipeThreshold: prefs.pageSwipeThreshold - 4 })
            }
            increase={() =>
              change({ pageSwipeThreshold: prefs.pageSwipeThreshold + 4 })
            }
          />
          <SettingStepper
            label={t('pageEdgeInset')}
            value={prefs.pageEdgeInset}
            decrease={() => change({ pageEdgeInset: prefs.pageEdgeInset - 4 })}
            increase={() => change({ pageEdgeInset: prefs.pageEdgeInset + 4 })}
          />
          <Text style={s.settingLabel}>{t('orientation')}</Text>
          <View style={s.themeRow}>
            {(['auto', 'portrait', 'landscape'] as const).map(orientation => (
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={
                  orientation === 'auto'
                    ? t('autoRotate')
                    : orientation === 'portrait'
                      ? t('portrait')
                      : t('landscape')
                }
                accessibilityState={{
                  selected: prefs.orientation === orientation,
                }}
                key={orientation}
                style={[
                  s.theme,
                  prefs.orientation === orientation && s.themeActive,
                ]}
                onPress={() => change({ orientation })}
              >
                <Text>
                  {orientation === 'auto'
                    ? t('auto')
                    : orientation === 'portrait'
                      ? t('portrait')
                      : t('landscape')}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={s.readerSwitch}>
            <Text>{t('hideReaderStatusBar')}</Text>
            <Switch
              accessibilityLabel={t('hideReaderStatusBar')}
              value={prefs.hideStatusBar}
              onValueChange={hideStatusBar => change({ hideStatusBar })}
            />
          </View>
          <View style={s.readerSwitch}>
            <Text>{t('readerChromeFollowsPage')}</Text>
            <Switch
              accessibilityLabel={t('readerChromeFollowsPage')}
              value={prefs.readerChromeFollowsPage}
              onValueChange={readerChromeFollowsPage =>
                change({ readerChromeFollowsPage })
              }
            />
          </View>
        </ScrollView>
      </InTreeSheet>
      <InTreeSheet visible={advanced} onDismiss={() => setAdvanced(false)}>
        <ScrollView contentContainerStyle={s.readerSettings}>
          <Text style={s.sectionTitle}>{t('readerAdvancedActions')}</Text>
          <View style={s.wrapRow}>
            <Pressable
              accessibilityRole="button"
              style={s.settingAction}
              onPress={() => setReaderMenuTier('primary')}
            >
              <Text>{t('readerMenuPrimary')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.settingAction}
              onPress={() => setReaderMenuTier('more')}
            >
              <Text>{t('readerMenuMore')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.settingAction}
              onPress={() => {
                setAdvanced(false);
                setReaderMenuConfigOpen(true);
              }}
            >
              <Text>{t('configure')}</Text>
            </Pressable>
          </View>
          <View style={s.wrapRow}>
            {readerMenuConfig[readerMenuTier]
              .filter(readerMenuAvailable)
              .map(key => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={readerMenuLabel(key)}
                  key={key}
                  style={s.settingAction}
                  onPress={() => runReaderMenuAction(key)}
                >
                  <Text>{readerMenuLabel(key)}</Text>
                </Pressable>
              ))}
          </View>
          {!readerMenuConfig[readerMenuTier].some(readerMenuAvailable) ? (
            <Text style={s.muted}>{t('readerMenuSectionEmpty')}</Text>
          ) : null}
          <Text style={s.sectionTitle}>{t('readerAllFeatures')}</Text>
          <View style={s.wrapRow}>
            <Pressable
              accessibilityRole="button"
              style={s.settingAction}
              onPress={() => leaveFor(openEditor)}
            >
              <Text>{t('editBook')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.settingAction}
              onPress={() => leaveFor(openHighlightRules)}
            >
              <Text>{t('highlightRules')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.settingAction}
              onPress={() => {
                setAdvanced(false);
                setEffectiveReplaces(true);
              }}
            >
              <Text>{t('effectiveReplaceRules')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.settingAction}
              onPress={() => leaveFor(openReaderSettings)}
            >
              <Text>{t('readerSettings')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.settingAction}
              onPress={() => leaveFor(openLogs)}
            >
              <Text>{t('logs')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.settingAction}
              onPress={() => leaveFor(openHelp)}
            >
              <Text>{t('readerHelp')}</Text>
            </Pressable>
            {book.localUri && /\.txt(?:$|[?#])/i.test(book.localUri) ? (
              <Pressable
                accessibilityRole="button"
                style={s.settingAction}
                onPress={() => leaveFor(openTxtTocRules)}
              >
                <Text>{t('txtTocRules')}</Text>
              </Pressable>
            ) : null}
          </View>
          {book.origin && book.bookUrl ? (
            <View style={s.wrapRow}>
              <Pressable
                accessibilityRole="button"
                style={s.settingAction}
                onPress={() => leaveFor(openSourceSwitch)}
              >
                <Text>{t('sourceSwitchTitle')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.settingAction}
                onPress={() => leaveFor(openOfflineCache)}
              >
                <Text>{t('offlineCache')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.settingAction}
                onPress={() => void refreshCurrentChapter()}
              >
                <Text>{t('refreshCurrentChapter')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.settingAction}
                onPress={() => void updateOnlineToc()}
              >
                <Text>{t('updateOnlineToc')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.settingAction}
                onPress={() => setRefreshScopeConfirm('after')}
              >
                <Text>{t('refreshCurrentAndLater')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.settingAction}
                onPress={() => setRefreshScopeConfirm('all')}
              >
                <Text>{t('refreshAllChapters')}</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={reverseCurrentContent}
          >
            <Text>{t('reverseCurrentContent')}</Text>
          </Pressable>
          <View style={s.readerSwitch}>
            <Text>{t('removeDuplicateChapterTitle')}</Text>
            <Switch
              accessibilityLabel={t('removeDuplicateChapterTitle')}
              value={
                book.removeDuplicateTitleChapterIds?.includes(chapter.id) ===
                true
              }
              onValueChange={enabled => {
                const ids = new Set(book.removeDuplicateTitleChapterIds ?? []);
                if (enabled) ids.add(chapter.id);
                else ids.delete(chapter.id);
                update({
                  ...book,
                  removeDuplicateTitleChapterIds: [...ids],
                  updatedAt: Date.now(),
                });
              }}
            />
          </View>
          <View style={s.readerSwitch}>
            <Text>{t('deleteRubyTag')}</Text>
            <Switch
              accessibilityLabel={t('deleteRubyTag')}
              value={book.deleteRubyTag === true}
              onValueChange={deleteRubyTag =>
                update({ ...book, deleteRubyTag, updatedAt: Date.now() })
              }
            />
          </View>
          <View style={s.readerSwitch}>
            <Text>{t('deleteHeadingTag')}</Text>
            <Switch
              accessibilityLabel={t('deleteHeadingTag')}
              value={book.deleteHeadingTag === true}
              onValueChange={deleteHeadingTag =>
                update({ ...book, deleteHeadingTag, updatedAt: Date.now() })
              }
            />
          </View>
          <Text style={s.sectionTitle}>{t('readerImageStyle')}</Text>
          <View style={s.wrapRow}>
            {(
              [
                ['default', t('readerImageStyleDefault')],
                ['full', t('readerImageStyleFull')],
                ['text', t('readerImageStyleText')],
                ['single', t('readerImageStyleSingle')],
              ] as const
            ).map(([imageStyle, label]) => {
              const selected = (book.imageStyle ?? 'default') === imageStyle;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  key={imageStyle}
                  style={[s.ruleChip, selected && s.ruleChipActive]}
                  onPress={() =>
                    update({ ...book, imageStyle, updatedAt: Date.now() })
                  }
                >
                  <Text style={selected ? s.ruleChipActiveText : undefined}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.sectionTitle}>{t('manualReplaceRules')}</Text>
          <View style={s.readerSwitch}>
            <Text>{t('enableReplaceRulesForBook')}</Text>
            <Switch
              accessibilityLabel={t('enableReplaceRulesForBook')}
              value={automaticReplaceEnabled}
              onValueChange={useReplaceRules =>
                update({
                  ...book,
                  useReplaceRules,
                  manualReplaceRuleIds: undefined,
                  updatedAt: Date.now(),
                })
              }
            />
          </View>
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={() =>
              update({
                ...book,
                manualReplaceRuleIds: undefined,
                updatedAt: Date.now(),
              })
            }
          >
            <Text>{t('useAutomaticReplaceRules')}</Text>
          </Pressable>
          <View style={s.wrapRow}>
            {replaceRules
              .filter(
                rule =>
                  !rule.scopeSource || rule.scopeTitle || rule.scopeContent,
              )
              .map(rule => {
                const selected =
                  book.manualReplaceRuleIds?.includes(rule.id) === true;
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={rule.id}
                    style={[s.ruleChip, selected && s.ruleChipActive]}
                    onPress={() => toggleManualRule(rule.id)}
                  >
                    <Text style={selected ? s.ruleChipActiveText : undefined}>
                      {rule.name}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
          {!replaceRules.length ? (
            <Text style={s.muted}>{t('emptyReplaceRules')}</Text>
          ) : null}
          <Text style={s.sectionTitle}>{t('simulatedReading')}</Text>
          <View style={s.readerSwitch}>
            <Text>{t('enableSimulatedReading')}</Text>
            <Switch
              accessibilityLabel={t('enableSimulatedReading')}
              value={simulationEnabled}
              onValueChange={setSimulationEnabled}
            />
          </View>
          <TextInput
            accessibilityLabel={t('simulationStartDate')}
            value={simulationDate}
            onChangeText={setSimulationDate}
            placeholder="YYYY-MM-DD"
            style={s.settingInput}
          />
          <View style={s.wrapRow}>
            <TextInput
              accessibilityLabel={t('simulationStartChapter')}
              keyboardType="number-pad"
              value={simulationStart}
              onChangeText={setSimulationStart}
              style={s.smallSettingInput}
            />
            <TextInput
              accessibilityLabel={t('simulationDailyChapters')}
              keyboardType="number-pad"
              value={simulationDaily}
              onChangeText={setSimulationDaily}
              style={s.smallSettingInput}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={saveSimulation}
          >
            <Text>{t('saveSimulatedReading')}</Text>
          </Pressable>
          <Text style={s.sectionTitle}>{t('webDavBookProgress')}</Text>
          <View style={s.wrapRow}>
            <Pressable
              accessibilityRole="button"
              style={s.settingAction}
              onPress={() => void fetchRemoteProgress()}
            >
              <Text>{t('getBookProgress')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.settingAction}
              onPress={() => void overwriteRemoteProgress()}
            >
              <Text>{t('overwriteBookProgress')}</Text>
            </Pressable>
          </View>
          {pendingProgress ? (
            <View style={s.progressPreview}>
              <Text>
                {t('remoteProgressPreview', {
                  chapter: pendingProgress.durChapterIndex + 1,
                  title: pendingProgress.durChapterTitle ?? '',
                })}
              </Text>
              <View style={s.wrapRow}>
                <Pressable
                  accessibilityRole="button"
                  style={s.settingAction}
                  onPress={() => {
                    persistChapter(
                      Math.min(
                        pendingProgress.durChapterIndex,
                        chapters.length - 1,
                      ),
                      'start',
                      pendingProgress.durChapterPos,
                    );
                    setPendingProgress(undefined);
                    setAdvancedMessage(t('remoteProgressApplied'));
                  }}
                >
                  <Text>{t('applyRemoteProgress')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={s.settingAction}
                  onPress={() => setPendingProgress(undefined)}
                >
                  <Text>{t('cancel')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {advancedMessage ? (
            <Text accessibilityLiveRegion="polite" style={s.muted}>
              {advancedMessage}
            </Text>
          ) : null}
        </ScrollView>
      </InTreeSheet>
      <ReaderMenuConfigSheet
        visible={readerMenuConfigOpen}
        value={readerMenuConfig}
        label={readerMenuLabel}
        change={value => {
          const saved = saveReaderMenuConfig(value);
          setReaderMenuConfig(saved);
        }}
        dismiss={() => {
          setReaderMenuConfigOpen(false);
          setAdvanced(true);
        }}
      />
      <InTreeSheet
        visible={effectiveReplaces}
        onDismiss={() => setEffectiveReplaces(false)}
      >
        <Text style={s.sectionTitle}>{t('effectiveReplaceRules')}</Text>
        <Text style={s.muted}>
          {t('effectiveReplaceRulesDescription', {
            chapter: replacedTitle,
          })}
        </Text>
        {effectiveRuleRows.length ? (
          <ScrollView contentContainerStyle={s.effectiveRuleList}>
            {effectiveRuleRows.map(item => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('editNamed', { name: item.rule.name })}
                key={item.rule.id}
                style={[s.effectiveRuleRow, { borderColor: colors.border }]}
                onPress={() => {
                  setEffectiveReplaces(false);
                  leaveFor(() => openReplaceRule(item.rule.id));
                }}
              >
                <Text style={[s.bookName, { color: colors.text }]}>
                  {item.rule.name}
                </Text>
                <Text style={[s.muted, s.effectiveRuleMeta]}>
                  {item.title && item.content
                    ? t('replaceRuleTitleAndContent')
                    : item.title
                      ? t('replaceRuleTitleOnly')
                      : t('replaceRuleContentOnly')}
                  {item.rule.group ? ` · ${item.rule.group}` : ''}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={[s.muted, s.effectiveRuleEmpty]}>
            {t('noEffectiveReplaceRules')}
          </Text>
        )}
      </InTreeSheet>
      <InTreeSheet
        visible={!!refreshScopeConfirm}
        onDismiss={() => setRefreshScopeConfirm(undefined)}
      >
        <Text style={s.sectionTitle}>{t('confirmRefreshChapterCache')}</Text>
        <Text style={s.muted}>
          {t(
            refreshScopeConfirm === 'all'
              ? 'confirmRefreshAllChapters'
              : 'confirmRefreshCurrentAndLater',
          )}
        </Text>
        <View style={s.wrapRow}>
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={() => setRefreshScopeConfirm(undefined)}
          >
            <Text>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={() =>
              refreshScopeConfirm &&
              clearOnlineChapterCache(refreshScopeConfirm)
            }
          >
            <Text>{t('confirm')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
      <InTreeSheet
        visible={pendingChapterJump !== undefined}
        onDismiss={() => setPendingChapterJump(undefined)}
      >
        <Text style={s.sectionTitle}>{t('confirmChapterProgressJump')}</Text>
        <Text style={s.muted}>
          {t('confirmChapterProgressJumpDescription', {
            chapter:
              pendingChapterJump === undefined
                ? ''
                : (chapters[pendingChapterJump]?.title ??
                  String(pendingChapterJump + 1)),
          })}
        </Text>
        <View style={s.wrapRow}>
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={() => setPendingChapterJump(undefined)}
          >
            <Text>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.settingAction}
            onPress={() => {
              if (pendingChapterJump !== undefined) {
                setChapterJumpConfirmed(true);
                persistChapter(pendingChapterJump);
              }
              setPendingChapterJump(undefined);
            }}
          >
            <Text>{t('confirm')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
      {prefs.showBrightnessOverlay ? (
        <View
          pointerEvents="none"
          style={[s.brightnessMask, { opacity: (1 - prefs.brightness) * 0.72 }]}
        />
      ) : null}
    </View>
  );
}
function SettingStepper({
  label,
  value,
  decrease,
  increase,
}: {
  label: string;
  value: number;
  decrease: () => void;
  increase: () => void;
}) {
  const { t } = useAppTheme();
  return (
    <View style={s.stepper}>
      <Text style={s.settingLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('decrease', { name: label })}
        style={s.stepButton}
        onPress={decrease}
      >
        <Text style={s.stepText}>－</Text>
      </Pressable>
      <Text style={s.stepValue}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('increase', { name: label })}
        style={s.stepButton}
        onPress={increase}
      >
        <Text style={s.stepText}>＋</Text>
      </Pressable>
    </View>
  );
}
function ReaderColorField({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <View style={s.readerColorField}>
      <Text style={s.settingLabel}>{label}</Text>
      <View style={[s.readerColorPreview, { backgroundColor: value }]} />
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={7}
        value={draft}
        onChangeText={setDraft}
        onEndEditing={() => change(draft)}
        style={s.readerColorInput}
      />
    </View>
  );
}
function ReaderTemplateField({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: (value: string) => void;
}) {
  return (
    <View style={s.readerTemplateField}>
      <Text style={s.settingLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        maxLength={200}
        style={s.readerTemplateInput}
      />
    </View>
  );
}
function ReaderInfoRow({
  templates,
  values,
  color,
  size,
  style,
}: {
  templates: [string, string, string];
  values: ReaderInfoValues;
  color: string;
  size: number;
  style: object;
}) {
  return (
    <View pointerEvents="none" style={[s.readerInfoRow, style]}>
      {templates.map((template, index) => (
        <Text
          key={index}
          numberOfLines={1}
          style={[
            s.readerInfoText,
            {
              color,
              fontSize: size,
              textAlign:
                index === 0 ? 'left' : index === 1 ? 'center' : 'right',
            },
          ]}
        >
          {renderReaderInfoTemplate(template, values)}
        </Text>
      ))}
    </View>
  );
}
function Settings({
  back,
  openSources,
  openAnnotations,
  openBackup,
  openReplaceRules,
  openTxtTocRules,
  openDictRules,
  openHighlightRules,
  openCoverRule,
  openCoverSettings,
  openWelcomeSettings,
  openQr,
  openAutoTasks,
  openAppearance,
  openLogs,
  openSubscriptions,
  openGeneralSettings,
  openReaderSettings,
  openAbout,
  openKeyboardAssists,
  openSpeechEngines,
  extraEntries,
}: {
  back: () => void;
  openSources: () => void;
  openAnnotations: () => void;
  openBackup: () => void;
  openReplaceRules: () => void;
  openTxtTocRules: () => void;
  openDictRules: () => void;
  openHighlightRules: (ruleId?: number) => void;
  openCoverRule: () => void;
  openCoverSettings: () => void;
  openWelcomeSettings: () => void;
  openQr: () => void;
  openAutoTasks: () => void;
  openAppearance: () => void;
  openLogs: () => void;
  openSubscriptions: () => void;
  openGeneralSettings: () => void;
  openReaderSettings: () => void;
  openAbout: () => void;
  openKeyboardAssists: () => void;
  openSpeechEngines: () => void;
  extraEntries: Array<{ label: string; open: () => void }>;
}) {
  const { colors, t } = useAppTheme();
  const entries: Array<{ label: string; open: () => void }> = [
    { label: t('appearance'), open: openAppearance },
    { label: t('otherSettings'), open: openGeneralSettings },
    { label: t('readerSettings'), open: openReaderSettings },
    { label: t('httpTtsEngines'), open: openSpeechEngines },
    { label: t('backupRestore'), open: openBackup },
    { label: t('sourceManagement'), open: openSources },
    { label: t('annotations'), open: openAnnotations },
    { label: t('replaceRules'), open: openReplaceRules },
    { label: t('txtTocRules'), open: openTxtTocRules },
    { label: t('dictionaryRules'), open: openDictRules },
    { label: t('highlightRules'), open: openHighlightRules },
    { label: t('coverRules'), open: openCoverRule },
    { label: t('coverSettings'), open: openCoverSettings },
    { label: t('welcomeSettings'), open: openWelcomeSettings },
    { label: t('qrImport'), open: openQr },
    { label: t('ruleSubscriptions'), open: openSubscriptions },
    { label: t('autoTasks'), open: openAutoTasks },
    { label: t('keyboardAssistConfig'), open: openKeyboardAssists },
    { label: t('logs'), open: openLogs },
    { label: t('about'), open: openAbout },
    ...extraEntries,
  ];
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('settings')} onBack={back} />
      <ScrollView>
        {entries.map(entry => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={entry.label}
            key={entry.label}
            style={[
              s.setting,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={entry.open}
          >
            <Text style={[s.bookName, { color: colors.text }]}>
              {entry.label}
            </Text>
            <Text style={{ color: colors.muted }}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
function HomeTabIcon({
  tab,
  color,
  selected,
}: {
  tab: RootTab;
  color: string;
  selected: boolean;
}) {
  const names = {
    bookshelf: 'ic_bottom_books',
    explore: 'ic_bottom_explore',
    rss: 'ic_bottom_rss_feed',
    mine: 'ic_bottom_person',
  } as const;
  return (
    <SourceIcon
      name={`${names[tab]}_${selected ? 's' : 'e'}`}
      color={color}
      size={24}
    />
  );
}
function TabBar({
  active,
  select,
  preferences,
  skinRevision,
}: {
  active: RootTab;
  select: (v: RootTab) => void;
  preferences: GeneralPreferences;
  skinRevision: number;
}) {
  const insets = useSafeAreaInsets();
  const { t, preferences: appPreferences, colors } = useAppTheme();
  const { preferences: shelfPreferences } = useBookshelfPreferences();
  const shelfRefresh = useBookshelfRefresh();
  const barElevation =
    appPreferences.themeMode === 'eink' ? 0 : appPreferences.barElevation;
  const labels: Record<RootTab, string> = {
      bookshelf: t('bookshelf'),
      explore: t('explore'),
      rss: t('subscriptions'),
      mine: t('mine'),
    },
    skin = loadActiveBottomBarSkin(),
    slots: Record<RootTab, 'bookshelf' | 'home' | 'notes' | 'settings'> = {
      bookshelf: 'bookshelf',
      explore: 'home',
      rss: 'notes',
      mine: 'settings',
    };
  void skinRevision;
  return (
    <View
      style={[
        s.tabs,
        {
          paddingBottom: insets.bottom,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          elevation: barElevation,
          shadowOpacity: barElevation ? 0.22 : 0,
          shadowRadius: barElevation / 2,
          shadowOffset: { width: 0, height: -Math.max(1, barElevation / 4) },
          shadowColor: '#000',
        },
      ]}
    >
      {tabKeys
        .filter(key => key !== 'explore' || preferences.showExplore)
        .filter(key => key !== 'rss' || preferences.showRss)
        .map(key => {
          const selected = active === key;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={key}
              style={({ pressed }) => [s.tab, pressed && s.iconPressed]}
              onPress={() => select(key)}
            >
              <View style={{ position: 'relative' }}>
                {skin?.assignments[slots[key]] ? (
                  <Image
                    source={{
                      uri: `file://${selected ? skin.assignments[slots[key]]!.selected : (skin.assignments[slots[key]]!.normal ?? skin.assignments[slots[key]]!.selected)}`,
                    }}
                    style={[
                      s.tabSkinIcon,
                      !selected && !skin.assignments[slots[key]]!.normal
                        ? s.tabSkinIconInactive
                        : null,
                    ]}
                  />
                ) : (
                  <HomeTabIcon
                    tab={key}
                    selected={selected}
                    color={selected ? colors.accent : colors.muted}
                  />
                )}
                {key === 'bookshelf' &&
                shelfPreferences.showWaitUpCount &&
                shelfRefresh.pending > 0 ? (
                  <Text
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -12,
                      minWidth: 16,
                      minHeight: 16,
                      fontSize: 11,
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                      textAlign: 'center',
                      overflow: 'hidden',
                      borderRadius: 8,
                      color: '#FFFFFF',
                      backgroundColor: colors.accent,
                    }}
                  >
                    {shelfRefresh.pending}
                  </Text>
                ) : null}
              </View>
              <Text
                style={[
                  s.tabLabel,
                  selected && s.tabLabelActive,
                  { color: selected ? colors.accent : colors.muted },
                ]}
              >
                {labels[key]}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );
}
runStorageMigrations();
function AppNavigation() {
  const { navigationTheme, dark, colors, t, preferences, backgroundImage } =
    useAppTheme();
  const [welcomeVisible, setWelcomeVisible] = useState(
    () => loadWelcomePreferences().showTime > 0,
  );
  const [newRemoteBackup, setNewRemoteBackup] =
      useState<RemoteBackupEntry | null>(null),
    [restoringRemote, setRestoringRemote] = useState(false),
    [remoteRestoreError, setRemoteRestoreError] = useState(''),
    [appRevision, setAppRevision] = useState(0);
  useEffect(() => {
    if (!welcomeVisible) return;
    const timer = setTimeout(
      () => setWelcomeVisible(false),
      loadWelcomePreferences().showTime,
    );
    return () => clearTimeout(timer);
  }, [welcomeVisible]);
  useEffect(() => {
    void findNewRemoteBackup()
      .then(setNewRemoteBackup)
      .catch(() => undefined);
  }, []);
  const dismissRemote = () => {
      if (newRemoteBackup) {
        const preferences = loadBackupPreferences();
        saveBackupPreferences({
          ...preferences,
          lastCheckedRemote: Math.max(
            preferences.lastCheckedRemote,
            newRemoteBackup.modifiedAt,
          ),
        });
      }
      setRemoteRestoreError('');
      setNewRemoteBackup(null);
    },
    restoreRemote = async () => {
      if (!newRemoteBackup) return;
      setRestoringRemote(true);
      setRemoteRestoreError('');
      try {
        const preview = await inspectWebDavBackupEntry(
          loadWebDavConfig(),
          newRemoteBackup,
        );
        await restoreBackupPreview(preview);
        const preferences = loadBackupPreferences();
        saveBackupPreferences({
          ...preferences,
          lastBackup: Math.max(
            preferences.lastBackup,
            newRemoteBackup.modifiedAt,
          ),
          lastCheckedRemote: Math.max(
            preferences.lastCheckedRemote,
            newRemoteBackup.modifiedAt,
          ),
        });
        setNewRemoteBackup(null);
        setAppRevision(value => value + 1);
      } catch (error) {
        setRemoteRestoreError(
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setRestoringRemote(false);
      }
    };
  return (
    <View
      style={[
        s.flex,
        {
          backgroundColor: dark
            ? preferences.nightBackground
            : preferences.dayBackground,
        },
      ]}
    >
      {backgroundImage ? (
        <Image
          source={{ uri: backgroundImage }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      {/* TODO(htyf-native): Additional ebook associations remain unavailable until the native declarations in docs/htyf-migration-gaps.md are authorized. */}
      <NavigationContainer
        theme={navigationTheme}
        linking={{
          prefixes: ['legado://', 'yuedu://'],
          config: {
            screens: {
              Home: 'home',
              Book: 'book/:bookId',
              Reader: 'read/:bookId',
              Search: 'search',
              Settings: 'settings',
              Sources: 'sources',
              LocalBookImport: 'import',
              QrImport: 'qr',
            },
          },
          async getInitialURL() {
            const url = await Linking.getInitialURL();
            return url && /^(?:file|content):/i.test(url)
              ? `legado://import?uri=${encodeURIComponent(url)}`
              : url;
          },
          subscribe(listener) {
            const subscription = Linking.addEventListener('url', ({ url }) =>
              listener(
                /^(?:file|content):/i.test(url)
                  ? `legado://import?uri=${encodeURIComponent(url)}`
                  : url,
              ),
            );
            return () => subscription.remove();
          },
        }}
      >
        <Shell key={appRevision} />
      </NavigationContainer>
      {welcomeVisible ? <WelcomeOverlay /> : null}
      <InTreeSheet visible={!!newRemoteBackup} onDismiss={dismissRemote}>
        <Text style={[s.backupSheetTitle, { color: colors.text }]}>
          {t('newRemoteBackup')}
        </Text>
        <Text style={{ color: colors.muted }}>
          {newRemoteBackup
            ? t('newRemoteBackupSummary', {
                name: newRemoteBackup.name,
                date: new Date(newRemoteBackup.modifiedAt).toLocaleString(),
              })
            : ''}
        </Text>
        {remoteRestoreError ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {remoteRestoreError}
          </Text>
        ) : null}
        {restoringRemote ? (
          <ActivityIndicator />
        ) : (
          <View style={s.backupActions}>
            <Pressable
              accessibilityRole="button"
              style={[s.backupSecondary, { borderColor: colors.border }]}
              onPress={dismissRemote}
            >
              <Text style={{ color: colors.text }}>{t('notNow')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.backupPrimary}
              onPress={() => void restoreRemote()}
            >
              <Text style={s.primaryText}>{t('replaceAndRestore')}</Text>
            </Pressable>
          </View>
        )}
      </InTreeSheet>
    </View>
  );
}
export default function App() {
  // TODO(htyf-native): Replace the template com.apps/org.reactjs native identities only after native-project edits are separately authorized; see docs/htyf-migration-gaps.md.
  return (
    <AppThemeProvider>
      <View style={s.flex}>
        <BottomSheetModalProvider>
          <AppNavigation />
          <CoverThumbnailRenderer />
        </BottomSheetModalProvider>
      </View>
    </AppThemeProvider>
  );
}
const s = StyleSheet.create({
  headerAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  backupSheetTitle: { fontSize: 20, fontWeight: '800' },
  backupActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  backupSecondary: {
    minHeight: 48,
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupPrimary: {
    minHeight: 48,
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#285d42',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  muted: { color: '#777' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#222' },
  action: { fontSize: 30 },
  iconPressed: { opacity: 0.5 },
  headerTextButton: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextAction: { color: '#285d42', fontWeight: '700' },
  list: { padding: 12, gap: 12 },
  book: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
  },
  cover: {
    width: 64,
    height: 88,
    borderRadius: 7,
    backgroundColor: '#426b55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverText: { color: '#fff', fontWeight: '700' },
  coverRefresh: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  coverMessage: { color: '#a13b3b', lineHeight: 20 },
  bookText: { flex: 1, padding: 8, gap: 7 },
  bookName: { fontSize: 17, fontWeight: '600', color: '#222' },
  intro: { color: '#555', lineHeight: 19 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  tab: {
    minHeight: 60,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabSkinIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
    marginBottom: 2,
  },
  tabSkinIconInactive: { opacity: 0.4 },
  tabLabel: { fontSize: 12, lineHeight: 16 },
  tabLabelActive: { fontWeight: '700' },
  detail: { padding: 20, paddingBottom: 100 },
  hero: { flexDirection: 'row', marginBottom: 28 },
  largeCover: { width: 96, height: 132 },
  detailName: { fontSize: 24, fontWeight: '700', color: '#171717' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
    color: '#222',
  },
  body: { fontSize: 16, lineHeight: 26, color: '#444' },
  cacheButton: {
    minHeight: 48,
    marginTop: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#397554',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cacheButtonText: { color: '#397554', fontWeight: '700' },
  audioButton: {
    minHeight: 48,
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: '#397554',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioButtonText: { color: '#fff', fontWeight: '700' },
  primary: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: '#397554',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallPrimary: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#397554',
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  reader: { flex: 1, backgroundColor: '#f4ecd8' },
  pullBookmarkHint: {
    position: 'absolute',
    top: 72,
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 22,
    zIndex: 12,
    elevation: 12,
  },
  readerContent: { paddingHorizontal: 26, paddingVertical: 70 },
  reviewParagraph: { marginBottom: 18 },
  reviewCount: {
    alignSelf: 'flex-end',
    minHeight: 36,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.75,
  },
  readerSettings: { paddingBottom: 20 },
  readerColorField: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readerColorPreview: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#777',
  },
  readerColorInput: {
    width: 100,
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontFamily: 'monospace',
  },
  readerBackgroundActions: { flexDirection: 'row', gap: 10, marginVertical: 8 },
  readerBackgroundButton: {
    minHeight: 44,
    flex: 1,
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerTemplateField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readerTemplateInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  readerInfoRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  readerInfoHeader: { top: 4 },
  readerInfoFooter: { bottom: 4 },
  readerInfoText: { flex: 1, opacity: 0.72 },
  mangaContent: { alignItems: 'center' },
  readerSwitch: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingAction: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  effectiveRuleList: { marginTop: 10, maxHeight: 360 },
  effectiveRuleRow: {
    minHeight: 58,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  effectiveRuleMeta: { marginTop: 4 },
  effectiveRuleEmpty: { marginTop: 18, textAlign: 'center' },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  ruleChip: {
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: 22,
    backgroundColor: '#eee',
    justifyContent: 'center',
  },
  ruleChipActive: { backgroundColor: '#397554' },
  ruleChipActiveText: { color: '#fff', fontWeight: '700' },
  settingInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  smallSettingInput: {
    minWidth: 120,
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  progressPreview: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#eee',
    gap: 10,
  },
  pageContent: { flex: 1, paddingHorizontal: 26, paddingVertical: 70 },
  readerSpread: { flex: 1, flexDirection: 'row', gap: 18 },
  readerSpreadPage: { flex: 1, minWidth: 0 },
  pageNumber: { position: 'absolute', right: 24, bottom: 18, opacity: 0.62 },
  brightnessMask: {
    ...StyleSheet.absoluteFill,
    zIndex: 300,
    elevation: 30,
    backgroundColor: '#000',
  },
  chapter: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2d291f',
    marginBottom: 32,
  },
  readerText: { fontSize: 19, lineHeight: 34, color: '#302c24' },
  readerTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  readerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  readerButtonPressed: { opacity: 0.48 },
  readerIcon: { fontSize: 34, lineHeight: 38 },
  readerTitleBox: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    overflow: 'hidden',
  },
  readerTitle: { fontSize: 17, lineHeight: 21, fontWeight: '700' },
  readerTitleChapter: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    opacity: 0.72,
  },
  readerTitleSource: { fontSize: 9, lineHeight: 12, opacity: 0.46 },
  readerProgressBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 64,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  readerProgressText: { minWidth: 72, fontSize: 11, fontWeight: '600' },
  readerProgressSlider: { flex: 1, height: 44 },
  chapterTransition: {
    position: 'absolute',
    zIndex: 20,
    left: 16,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  chapterTransitionLoading: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chapterTransitionActions: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  chapterTransitionButton: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  readerBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  readerMainAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  readerActionSymbol: { fontSize: 20, lineHeight: 24, fontWeight: '600' },
  readerToolAction: {
    minHeight: 52,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  readerAction: {
    minWidth: 72,
    minHeight: 68,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerActionPressed: { opacity: 0.48 },
  readerActionDisabled: { opacity: 0.42 },
  tocItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  tocSearch: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  tocTabs: { flexDirection: 'row', marginTop: 8, marginBottom: 10 },
  tocTab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  tocActions: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  tocAction: {
    minHeight: 44,
    width: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tocTitleBlock: { flex: 1, minWidth: 0 },
  tocBookmarkRow: {
    minHeight: 64,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  tocBookmarkContent: { flex: 1, justifyContent: 'center', paddingVertical: 8 },
  highlightTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  highlightSwatch: { width: 12, height: 36, borderRadius: 6 },
  highlightText: { flex: 1 },
  tocBookmarkDelete: {
    width: 52,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkEditor: {
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    marginTop: 12,
  },
  highlightColorInput: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  bookmarkEditorActions: { flexDirection: 'row', marginTop: 12 },
  bookmarkEditorAction: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tocActive: {
    flex: 1,
    fontSize: 16,
    lineHeight: 26,
    color: '#397554',
    fontWeight: '700',
  },
  stepper: { minHeight: 58, flexDirection: 'row', alignItems: 'center' },
  settingLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 22 },
  stepValue: { width: 48, textAlign: 'center', fontSize: 16 },
  themeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  quickStyleMore: {
    minHeight: 50,
    marginTop: 14,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  theme: {
    minHeight: 44,
    flex: 1,
    borderRadius: 22,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeActive: { borderWidth: 2, borderColor: '#397554' },
  searchRow: { flexDirection: 'row', gap: 8, padding: 12 },
  searchMessage: { color: '#777', paddingHorizontal: 16, paddingBottom: 8 },
  searchLoading: { marginTop: 40 },
  searchBook: {
    minHeight: 76,
    padding: 12,
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: '#eee',
    paddingHorizontal: 18,
    fontSize: 16,
  },
  setting: {
    minHeight: 58,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mine: { paddingBottom: 32 },
  mineHero: { padding: 22, margin: 14, borderRadius: 14, gap: 8 },
});
