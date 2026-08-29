import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Book, BookSource, SearchBook } from '../types';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import { allSettledLimited } from '../core/concurrency';
import { searchSource } from '../core/webBook';
import { SearchRunGate } from '../core/searchRunGate';
import {
  filterSearchResults,
  groupSearchResults,
  loadBookSearchPreferences,
  rememberSearchKeyword,
  removeSearchKeyword,
  saveBookSearchPreferences,
  searchBookIndicator,
  searchLocalBooks,
  selectSearchSources,
  type BookSearchPreferences,
  type GroupedSearchResult,
} from '../data/bookSearch';
import { loadGeneralPreferences } from '../data/generalPreferences';
import { loadSources } from '../data/sources';
import { loadReadRecords } from '../data/readRecords';
import { useAppTheme } from '../theme/AppTheme';

type Failure = { source: BookSource; message: string };

export function BookSearch({
  initialQuery,
  initialSourceUrl,
  back,
  open,
  login,
  library,
  openLocal,
}: {
  initialQuery?: string;
  initialSourceUrl?: string;
  back: () => void;
  open: (book: SearchBook) => void;
  login: (sourceUrl: string) => void;
  library: Book[];
  openLocal: (bookId: string) => void;
}) {
  const { colors, t } = useAppTheme();
  const [query, setQuery] = useState(initialQuery ?? ''),
    [results, setResults] = useState<SearchBook[]>([]),
    [failures, setFailures] = useState<Failure[]>([]),
    [running, setRunning] = useState(false),
    [page, setPage] = useState(0),
    [progress, setProgress] = useState({ done: 0, total: 0 }),
    [hasMore, setHasMore] = useState(false),
    [message, setMessage] = useState(() => t('searchEnabledSources')),
    [sheet, setSheet] = useState(false),
    [confirmClear, setConfirmClear] = useState(false),
    [originChoice, setOriginChoice] = useState<GroupedSearchResult>(),
    [preferences, setPreferences] = useState(loadBookSearchPreferences),
    [availableGroups, setAvailableGroups] = useState<string[]>([]),
    [scopedSourceName, setScopedSourceName] = useState(''),
    runGate = useRef(new SearchRunGate()),
    submitRef = useRef<(nextPage?: boolean) => Promise<void>>(async () => {}),
    autoRun = useRef(false);
  const visible = useMemo(
      () =>
        filterSearchResults(
          results,
          query.trim(),
          preferences.precision,
          preferences.filter,
        ),
      [preferences.filter, preferences.precision, query, results],
    ),
    localMatches = useMemo(
      () => (page === 0 ? searchLocalBooks(library, query).slice(0, 20) : []),
      [library, page, query],
    ),
    readRecords = loadReadRecords(),
    grouped = useMemo(
      () => groupSearchResults(visible, query),
      [query, visible],
    );
  const commit = (next: BookSearchPreferences) => {
    const saved = saveBookSearchPreferences(next);
    setPreferences(saved);
    return saved;
  };
  useEffect(() => {
    let active = true;
    void loadSources().then(all => {
      if (!active) return;
      setAvailableGroups(
        [
          ...new Set(
            all.flatMap(source =>
              String(source.bookSourceGroup ?? '')
                .split(/[,，]/)
                .map(item => item.trim())
                .filter(Boolean),
            ),
          ),
        ].sort((a, b) => a.localeCompare(b)),
      );
      if (initialSourceUrl)
        setScopedSourceName(
          all.find(source => source.bookSourceUrl === initialSourceUrl)
            ?.bookSourceName ?? '',
        );
    });
    return () => {
      active = false;
      runGate.current.cancel();
    };
  }, [initialSourceUrl]);
  const stop = () => {
    runGate.current.cancel();
    setRunning(false);
    setMessage(t('searchStopped'));
  };
  const changeQuery = (value: string) => {
    if (running) stop();
    setQuery(value);
    setResults([]);
    setFailures([]);
    setPage(0);
    setHasMore(false);
  };
  const run = async (nextPage = false) => {
    const key = query.trim();
    if (!key || running) return;
    const token = runGate.current.next();
    setRunning(true);
    if (!nextPage) {
      setResults([]);
      setFailures([]);
    }
    try {
      const all = await loadSources(),
        groups = [
          ...new Set(
            all.flatMap(source =>
              String(source.bookSourceGroup ?? '')
                .split(/[,，]/)
                .map(item => item.trim())
                .filter(Boolean),
            ),
          ),
        ].sort((a, b) => a.localeCompare(b)),
        sources = selectSearchSources(
          all,
          preferences.groups,
          initialSourceUrl,
        ),
        targetPage = nextPage ? page + 1 : 1;
      setAvailableGroups(groups);
      setProgress({ done: 0, total: sources.length });
      let incomingCount = 0,
        failedCount = 0;
      await allSettledLimited(
        sources.map(source => async () => {
          try {
            const books = await searchSource(source, key, targetPage);
            incomingCount += books.length;
            if (runGate.current.isCurrent(token))
              setResults(current => [
                ...new Map(
                  [...current, ...books].map(book => [
                    `${book.origin}\0${book.bookUrl}\0${book.name}\0${book.author}`,
                    book,
                  ]),
                ).values(),
              ]);
          } catch (error) {
            failedCount += 1;
            if (runGate.current.isCurrent(token))
              setFailures(current => [
                ...current,
                {
                  source,
                  message:
                    error instanceof Error ? error.message : String(error),
                },
              ]);
          } finally {
            if (runGate.current.isCurrent(token))
              setProgress(current => ({
                ...current,
                done: current.done + 1,
              }));
          }
        }),
        loadGeneralPreferences().threadCount,
      );
      if (!runGate.current.isCurrent(token)) return;
      setPage(targetPage);
      setHasMore(incomingCount > 0);
      if (!nextPage)
        setPreferences(commit(rememberSearchKeyword(preferences, key)));
      setMessage(
        sources.length
          ? t(
              failedCount
                ? 'sourceSearchCompleteFailed'
                : 'sourceSearchComplete',
              {
                success: sources.length - failedCount,
                total: sources.length,
                failed: failedCount,
              },
            )
          : t('enableSourcesFirst'),
      );
    } catch (error) {
      if (runGate.current.isCurrent(token))
        setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (runGate.current.isCurrent(token)) setRunning(false);
    }
  };
  submitRef.current = run;
  useEffect(() => {
    if (!initialQuery?.trim() || autoRun.current) return;
    autoRun.current = true;
    void submitRef.current(false);
  }, [initialQuery]);
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('search')}
        onBack={back}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('searchOptions')}
            style={s.headerAction}
            onPress={() => setSheet(true)}
          >
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {t('options')}
            </Text>
          </Pressable>
        }
      />
      <View style={s.searchRow}>
        <TextInput
          accessibilityLabel={t('searchKeyword')}
          returnKeyType="search"
          onSubmitEditing={() => void run()}
          autoFocus
          value={query}
          onChangeText={changeQuery}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={colors.muted}
          style={[
            s.input,
            { color: colors.text, backgroundColor: colors.surface },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          style={[s.primary, { backgroundColor: colors.primary }]}
          onPress={() => (running ? stop() : void run())}
        >
          <Text style={s.primaryText}>
            {running ? t('stopSearch') : t('search')}
          </Text>
        </Pressable>
      </View>
      <Text style={[s.message, { color: colors.muted }]}>{message}</Text>
      {initialSourceUrl ? (
        <Text style={[s.scopeBanner, { color: colors.primary }]}>
          {t('searchingSingleSource', {
            name: scopedSourceName || initialSourceUrl,
          })}
        </Text>
      ) : null}
      {running ? (
        <Text style={[s.progress, { color: colors.primary }]}>
          {t('searchProgress', progress)}
        </Text>
      ) : null}
      {!results.length && !running && preferences.history.length ? (
        <View style={s.history}>
          <View style={s.rowBetween}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>
              {t('searchHistory')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('clearSearchHistory')}
              style={s.touch}
              onPress={() => setConfirmClear(true)}
            >
              <Text style={{ color: colors.danger }}>{t('clear')}</Text>
            </Pressable>
          </View>
          <View style={s.wrap}>
            {preferences.history.slice(0, 12).map(item => (
              <View
                key={item.word}
                style={[s.historyChip, { backgroundColor: colors.surface }]}
              >
                <Pressable
                  accessibilityRole="button"
                  style={s.historyWord}
                  onPress={() => changeQuery(item.word)}
                >
                  <Text style={{ color: colors.text }}>{item.word}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('deleteNamedHistory', {
                    name: item.word,
                  })}
                  style={s.historyDelete}
                  onPress={() =>
                    commit(removeSearchKeyword(preferences, item.word))
                  }
                >
                  <Text style={{ color: colors.danger }}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {localMatches.length ? (
        <View style={s.localSection}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            {t('localBookshelfResults')}
          </Text>
          {localMatches.map(book => (
            <Pressable
              accessibilityRole="button"
              key={book.id}
              style={[s.localBook, { borderColor: colors.border }]}
              onPress={() => openLocal(book.id)}
            >
              <Text style={[s.localName, { color: colors.text }]}>
                {book.name}
              </Text>
              <Text style={{ color: colors.muted }}>
                {book.author || t('unknownAuthor')}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {running && !visible.length ? (
        <ActivityIndicator style={s.loading} color={colors.primary} />
      ) : grouped.length ? (
        <ScrollView contentContainerStyle={s.list}>
          {grouped.map((group, index) => {
            const book = group.book;
            return (
              <Pressable
                accessibilityRole="button"
                key={`${book.name}:${book.author}:${index}`}
                style={[s.book, { backgroundColor: colors.surface }]}
                onPress={() =>
                  group.origins.length > 1 ? setOriginChoice(group) : open(book)
                }
              >
                <View style={s.resultTitleRow}>
                  <Text style={[s.bookName, { color: colors.text }]}>
                    {book.name}
                  </Text>
                  {group.origins.length > 1 ? (
                    <Text style={[s.originCount, { color: colors.primary }]}>
                      {t('sourceCount', { count: group.origins.length })}
                    </Text>
                  ) : null}
                  {searchBookIndicator(
                    book,
                    library,
                    readRecords,
                    preferences.showReadRecord,
                  ) === 'bookshelf' ? (
                    <Text style={[s.indicator, { color: colors.primary }]}>
                      {t('inBookshelf')}
                    </Text>
                  ) : searchBookIndicator(
                      book,
                      library,
                      readRecords,
                      preferences.showReadRecord,
                    ) === 'read' ? (
                    <Text style={[s.indicator, { color: '#c47a22' }]}>
                      {t('hasReadRecord')}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ color: colors.muted }}>
                  {book.author || t('unknownAuthor')} · {book.originName}
                </Text>
                {book.latestChapterTitle ? (
                  <Text numberOfLines={1} style={{ color: colors.muted }}>
                    {book.latestChapterTitle}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          {hasMore ? (
            <Pressable
              accessibilityRole="button"
              disabled={running}
              style={[s.loadMore, { borderColor: colors.primary }]}
              onPress={() => void run(true)}
            >
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {running ? t('searching') : t('loadMore')}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : (
        <View style={s.center}>
          <Text style={[s.empty, { color: colors.text }]}>
            {query ? t('noSearchResults') : t('enterBookOrAuthor')}
          </Text>
        </View>
      )}
      <InTreeSheet visible={sheet} onDismiss={() => setSheet(false)}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.sheet}
        >
          <Text style={[s.sheetTitle, { color: colors.text }]}>
            {t('searchOptions')}
          </Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: preferences.precision }}
            style={[s.option, { borderColor: colors.border }]}
            onPress={() =>
              commit({ ...preferences, precision: !preferences.precision })
            }
          >
            <Text style={{ color: colors.text }}>{t('precisionSearch')}</Text>
            <Text style={{ color: colors.primary }}>
              {preferences.precision ? '✓' : ''}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: preferences.showReadRecord }}
            style={[s.option, { borderColor: colors.border }]}
            onPress={() =>
              commit({
                ...preferences,
                showReadRecord: !preferences.showReadRecord,
              })
            }
          >
            <Text style={{ color: colors.text }}>{t('showReadRecord')}</Text>
            <Text style={{ color: colors.primary }}>
              {preferences.showReadRecord ? '✓' : ''}
            </Text>
          </Pressable>
          {!initialSourceUrl ? (
            <>
              <Text style={[s.label, { color: colors.text }]}>
                {t('searchScope')}
              </Text>
              <View style={s.wrap}>
                <Pressable
                  accessibilityRole="button"
                  style={[
                    s.chip,
                    {
                      backgroundColor: !preferences.groups.length
                        ? colors.primary
                        : colors.background,
                    },
                  ]}
                  onPress={() => commit({ ...preferences, groups: [] })}
                >
                  <Text
                    style={{
                      color: !preferences.groups.length ? '#fff' : colors.text,
                    }}
                  >
                    {t('allSources')}
                  </Text>
                </Pressable>
                {availableGroups.map(group => {
                  const active = preferences.groups.includes(group);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={group}
                      style={[
                        s.chip,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : colors.background,
                        },
                      ]}
                      onPress={() =>
                        commit({
                          ...preferences,
                          groups: active
                            ? preferences.groups.filter(item => item !== group)
                            : [...preferences.groups, group],
                        })
                      }
                    >
                      <Text style={{ color: active ? '#fff' : colors.text }}>
                        {group}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          <Text style={[s.label, { color: colors.text }]}>
            {t('searchResultFilter')}
          </Text>
          <TextInput
            accessibilityLabel={t('searchResultFilter')}
            multiline
            value={preferences.filter}
            onChangeText={filter => commit({ ...preferences, filter })}
            placeholder={t('searchResultFilterHint')}
            placeholderTextColor={colors.muted}
            style={[
              s.filter,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
          {failures.length ? (
            <>
              <Text style={[s.label, { color: colors.text }]}>
                {t('sourceFailures')}
              </Text>
              {failures.map(item => (
                <View
                  key={item.source.bookSourceUrl}
                  style={[s.failure, { borderColor: colors.border }]}
                >
                  <View style={s.failureText}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      {item.source.bookSourceName}
                    </Text>
                    <Text style={{ color: colors.danger }}>{item.message}</Text>
                  </View>
                  {item.source.loginUrl || item.source.enabledCookieJar ? (
                    <Pressable
                      accessibilityRole="button"
                      style={s.touch}
                      onPress={() => {
                        setSheet(false);
                        login(item.source.bookSourceUrl);
                      }}
                    >
                      <Text
                        style={{ color: colors.primary, fontWeight: '700' }}
                      >
                        {t('login')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      </InTreeSheet>
      <InTreeSheet
        visible={confirmClear}
        onDismiss={() => setConfirmClear(false)}
      >
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          {t('clearSearchHistory')}
        </Text>
        <Text style={[s.confirmText, { color: colors.muted }]}>
          {t('confirmClearSearchHistory')}
        </Text>
        <View style={s.confirmActions}>
          <Pressable
            accessibilityRole="button"
            style={s.confirmButton}
            onPress={() => setConfirmClear(false)}
          >
            <Text style={{ color: colors.text }}>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.confirmButton}
            onPress={() => {
              commit({ ...preferences, history: [] });
              setConfirmClear(false);
            }}
          >
            <Text style={{ color: colors.danger, fontWeight: '700' }}>
              {t('clear')}
            </Text>
          </Pressable>
        </View>
      </InTreeSheet>
      <InTreeSheet
        visible={!!originChoice}
        onDismiss={() => setOriginChoice(undefined)}
      >
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          {originChoice
            ? t('chooseBookSourceFor', { name: originChoice.book.name })
            : t('chooseBookSource')}
        </Text>
        <ScrollView contentContainerStyle={s.originList}>
          {originChoice?.origins.map(sourceBook => (
            <Pressable
              accessibilityRole="button"
              key={`${sourceBook.origin}:${sourceBook.bookUrl}`}
              style={[s.originOption, { borderColor: colors.border }]}
              onPress={() => {
                setOriginChoice(undefined);
                open(sourceBook);
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {sourceBook.originName}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.muted }}>
                {sourceBook.latestChapterTitle || sourceBook.bookUrl}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </InTreeSheet>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  headerAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { flexDirection: 'row', gap: 8, padding: 12 },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 18,
    fontSize: 16,
  },
  primary: {
    minWidth: 68,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  message: { paddingHorizontal: 16, paddingBottom: 8 },
  progress: { paddingHorizontal: 16, paddingBottom: 8, fontWeight: '700' },
  scopeBanner: { paddingHorizontal: 16, paddingBottom: 8, fontWeight: '700' },
  history: { padding: 16, gap: 10 },
  localSection: { paddingHorizontal: 16, paddingBottom: 12, gap: 4 },
  localBook: {
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  localName: { fontSize: 16, fontWeight: '700' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  historyChip: {
    minHeight: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyWord: {
    minHeight: 44,
    paddingLeft: 14,
    paddingRight: 6,
    justifyContent: 'center',
  },
  historyDelete: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { marginTop: 40 },
  list: { padding: 12, gap: 12 },
  book: { minHeight: 76, padding: 12, gap: 6, borderRadius: 10 },
  bookName: { fontSize: 17, fontWeight: '700' },
  resultTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  indicator: { fontSize: 12, fontWeight: '700' },
  originCount: { fontSize: 12, fontWeight: '800' },
  loadMore: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  empty: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  sheet: { gap: 12, paddingBottom: 20 },
  sheetTitle: { fontSize: 21, fontWeight: '800' },
  option: {
    minHeight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  filter: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
  },
  failure: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  failureText: { flex: 1, gap: 3 },
  confirmText: { marginVertical: 16, lineHeight: 22 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  confirmButton: {
    minWidth: 72,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  originList: { paddingTop: 12, paddingBottom: 12 },
  originOption: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    gap: 4,
  },
});
