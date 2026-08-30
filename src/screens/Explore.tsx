import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { exploreSource, parseExploreEntries } from '../core/webBook';
import { mergeExploreBooks, selectExploreSources } from '../core/explore';
import { loadSources } from '../data/sources';
import type { BookSource, SearchBook } from '../types';
import { useAppTheme } from '../theme/AppTheme';

export function Explore({ open }: { open: (book: SearchBook) => void }) {
  const { colors, t } = useAppTheme();
  const [sources, setSources] = useState<BookSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourceFailures, setSourceFailures] = useState(0);
  const [sourceUrl, setSourceUrl] = useState('');
  const [entryIndex, setEntryIndex] = useState(0);
  const [books, setBooks] = useState<SearchBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [paging, setPaging] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [message, setMessage] = useState(() => t('chooseExploreCategory'));
  const request = useRef(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setSourcesLoading(true);
      void loadSources().then(value => {
          if (!active) return;
          const result = selectExploreSources(value);
          setSources(result.available);
          setSourceFailures(result.failed);
          setSourceUrl(current => result.available.some(source => source.bookSourceUrl === current) ? current : (result.available[0]?.bookSourceUrl ?? ''));
        }).finally(() => { if (active) setSourcesLoading(false); });
      return () => {
        active = false;
      };
    }, []),
  );
  const source = sources.find(item => item.bookSourceUrl === sourceUrl);
  const entries = useMemo(
    () => (source ? parseExploreEntries(source) : []),
    [source],
  );
  useEffect(() => setEntryIndex(0), [sourceUrl]);
  useEffect(() => {
    const entry = entries[entryIndex];
    if (!source || !entry) {
      setBooks([]);
      setMessage(t('chooseExploreCategory'));
      return;
    }
    const token = ++request.current;
    setLoading(true);
    setPaging(false);
    setPage(1);
    setHasMore(true);
    setError(false);
    setBooks([]);
    setMessage(t('loadingExploreCategory', { name: entry.title }));
    void exploreSource(source, entry, 1)
      .then(value => {
        if (request.current !== token) return;
        setBooks(value);
        setHasMore(value.length > 0);
        setMessage(value.length ? t('exploreBookCount', { count: value.length }) : t('emptyExploreCategory'));
      })
      .catch(reason => {
        if (request.current !== token) return;
        setBooks([]);
        setError(true);
        setMessage(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (request.current === token) setLoading(false);
      });
    return () => { if (request.current === token) request.current += 1; };
  }, [entries, entryIndex, reload, source, t]);
  const loadNext = async () => {
    const entry = entries[entryIndex];
    if (!source || !entry || loading || paging || !hasMore) return;
    const nextPage = page + 1, token = ++request.current;
    setPaging(true);
    setError(false);
    setMessage(t('loadingExplorePage', { page: nextPage }));
    try {
      const incoming = await exploreSource(source, entry, nextPage);
      if (request.current !== token) return;
      const next = mergeExploreBooks(books, incoming), added = next.length > books.length;
      setBooks(next);
      setPage(nextPage);
      setHasMore(incoming.length > 0 && added);
      setMessage(t('exploreBookCount', { count: next.length }));
    } catch (reason) {
      if (request.current !== token) return;
      setError(true);
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (request.current === token) setPaging(false);
    }
  };
  if (sourcesLoading) return <View style={[s.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!sources.length)
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Text style={[s.empty, { color: colors.text }]}>{t('noExploreSources')}</Text>
        <Text style={[s.muted, { color: colors.muted }]}>{t('noExploreSourcesHelp')}</Text>
        {sourceFailures ? <Text style={{ color: colors.danger }}>{t('exploreSourcesSkipped', { count: sourceFailures })}</Text> : null}
      </View>
    );
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}> 
      <View style={s.filterHeader}>
      <ScrollView
        horizontal
        style={s.horizontalRail}
        contentContainerStyle={s.tabs}
        showsHorizontalScrollIndicator={false}
      >
        {sources.map(item => (
          <Pressable accessibilityRole="button"
            accessibilityLabel={t('chooseExploreSource', { name: item.bookSourceName })}
            accessibilityState={{ selected: sourceUrl === item.bookSourceUrl }}
            key={item.bookSourceUrl}
            style={({ pressed }) => [
              s.chip,
              { backgroundColor: sourceUrl === item.bookSourceUrl ? colors.primary : colors.surface },
              pressed && s.pressed,
            ]}
            onPress={() => setSourceUrl(item.bookSourceUrl)}
          >
            <Text
              style={[sourceUrl === item.bookSourceUrl ? s.chipTextActive : s.chipText, { color: sourceUrl === item.bookSourceUrl ? '#fff' : colors.text }]}
            >
              {item.bookSourceName}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {sourceFailures ? <Text style={[s.warning, { color: colors.danger }]}>{t('exploreSourcesSkipped', { count: sourceFailures })}</Text> : null}
      {entries.length > 1 ? (
        <ScrollView
          horizontal
          style={s.horizontalRail}
          contentContainerStyle={s.categories}
          showsHorizontalScrollIndicator={false}
        >
          {entries.map((entry, index) => (
            <Pressable accessibilityRole="button"
              accessibilityLabel={t('chooseExploreEntry', { name: entry.title })}
              accessibilityState={{ selected: index === entryIndex }}
              key={`${entry.title}:${entry.url}`}
              style={({ pressed }) => [
                s.category,
                {
                  backgroundColor:
                    index === entryIndex ? colors.surface : 'transparent',
                },
                pressed && s.pressed,
              ]}
              onPress={() => setEntryIndex(index)}
            >
              <Text style={[index === entryIndex ? s.categoryActive : s.muted, { color: index === entryIndex ? colors.primary : colors.muted }]}>
                {entry.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View
        style={[
          s.statusRow,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text accessibilityLiveRegion="polite" style={[s.message, { color: error ? colors.danger : colors.muted }]}>{message}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('refreshExplore')} style={({ pressed }) => [s.refresh, pressed && s.pressed]} onPress={() => setReload(value => value + 1)}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t('refresh')}</Text></Pressable>
      </View>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={s.loading} />
      ) : (
        <ScrollView style={s.contentScroll} contentContainerStyle={s.list}>
          {books.map((book, index) => (
            <Pressable accessibilityRole="button"
              accessibilityLabel={t('openExploreBook', { name: book.name })}
              key={`${book.origin}:${book.bookUrl}:${index}`}
              style={[s.book, { backgroundColor: colors.surface }]}
              onPress={() => open(book)}
            >
              <Text style={[s.name, { color: colors.text }]}>{book.name}</Text>
              <Text style={[s.muted, { color: colors.muted }]}>
                {book.author || t('unknownAuthor')} · {book.originName}
              </Text>
              {book.intro ? (
                <Text numberOfLines={2} style={[s.intro, { color: colors.muted }]}>
                  {book.intro}
                </Text>
              ) : null}
            </Pressable>
          ))}
          {books.length ? <Pressable accessibilityRole="button" accessibilityLabel={hasMore ? t('loadNextPage') : t('noMoreResults')} disabled={!hasMore || paging} style={s.loadMore} onPress={() => void loadNext()}>{paging ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: hasMore ? colors.primary : colors.muted, fontWeight: '700' }}>{hasMore ? t('loadNextPage') : t('noMoreResults')}</Text>}</Pressable> : null}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  filterHeader: { flexShrink: 0, paddingBottom: 8 },
  contentScroll: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  empty: { fontSize: 19, fontWeight: '700' },
  muted: {},
  horizontalRail: { flexGrow: 0 },
  tabs: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 22,
  },
  chipText: {},
  chipTextActive: { color: '#fff', fontWeight: '700' },
  categories: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  warning: { paddingHorizontal: 16, paddingTop: 4 },
  category: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 18 },
  categoryActive: { fontWeight: '700' },
  statusRow: {
    minHeight: 52,
    marginHorizontal: 16,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  message: { flex: 1, paddingLeft: 16, paddingVertical: 8 },
  refresh: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.56 },
  loading: { marginTop: 40 },
  list: { padding: 12, gap: 10 },
  book: { padding: 14, borderRadius: 10, gap: 6 },
  name: { fontSize: 17, fontWeight: '700' },
  intro: { lineHeight: 20 },
  loadMore: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
