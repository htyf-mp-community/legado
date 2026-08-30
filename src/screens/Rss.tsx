import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import jssdk from '@htyf-mp/js-sdk';
import { useFocusEffect } from '@react-navigation/native';
import { fetchRssFeedPage, parseRssSortEntries } from '../core/rss';
import { InTreeSheet } from '../components/InTreeSheet';
import {
  clearRssFavorites,
  DEFAULT_RSS_FAVORITE_GROUP,
  deleteRssFavoriteGroup,
  loadRssArticles,
  filterRssArticles,
  loadRssSources,
  mergeRssArticles,
  mergeRssSources,
  parseRssSources,
  rssFavoriteGroups,
  saveRssArticles,
  saveRssSources,
} from '../data/rss';
import type { RssArticleView } from '../data/rss';
import type { RssArticle, RssSource } from '../types';
import { addAppLog } from '../data/appLog';
import { useAppTheme } from '../theme/AppTheme';

export function Rss({
  open,
  manage,
}: {
  open: (articleId: string) => void;
  manage: () => void;
}) {
  const { colors, t } = useAppTheme();
  const [sources, setSources] = useState<RssSource[]>([]);
  const [articles, setArticles] = useState<RssArticle[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [articleView, setArticleView] = useState<RssArticleView>('all');
  const [favoriteGroup, setFavoriteGroup] = useState('');
  const [favoriteDelete, setFavoriteDelete] = useState<'group' | 'all' | null>(
    null,
  );
  const [sortIndex, setSortIndex] = useState(0);
  const [activeSort, setActiveSort] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [activeKey, setActiveKey] = useState('');
  const [page, setPage] = useState(1);
  const [nextUrl, setNextUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const nextSources = loadRssSources();
      setSources(nextSources);
      setArticles(loadRssArticles());
      setSourceUrl(current =>
        nextSources.some(source => source.sourceUrl === current)
          ? current
          : (nextSources.find(source => source.enabled)?.sourceUrl ?? ''),
      );
    }, []),
  );
  const selected = sources.find(source => source.sourceUrl === sourceUrl);
  const enabledSources = sources.filter(source => source.enabled);
  const sortState = useMemo(() => {
    if (!selected) return { entries: [], invalid: false };
    try {
      return { entries: parseRssSortEntries(selected), invalid: false };
    } catch {
      return { entries: [], invalid: true };
    }
  }, [selected]);
  const sort = sortState.entries[sortIndex];
  useEffect(() => {
    setSortIndex(0);
    setActiveSort('');
    setActiveKey('');
    setNextUrl('');
    setPage(1);
    request.current += 1;
  }, [sourceUrl]);
  useEffect(() => {
    if (sort) {
      setActiveSort(sort.title);
      setActiveKey('');
      setNextUrl('');
      setPage(1);
    }
  }, [sort]);
  const favoriteGroups = useMemo(() => rssFavoriteGroups(articles), [articles]);
  useEffect(() => {
    if (articleView !== 'favorites') return;
    if (!favoriteGroups.includes(favoriteGroup))
      setFavoriteGroup(favoriteGroups[0] ?? '');
  }, [articleView, favoriteGroup, favoriteGroups]);
  const visible = filterRssArticles(
    articles,
    articleView,
    sourceUrl,
    activeSort,
    favoriteGroup,
  );
  const commitArticles = (next: RssArticle[]) => {
    setArticles(next);
    saveRssArticles(next);
  };
  const refresh = async () => {
    if (!selected || !sort || loading || paging) return;
    const key = searchKey.trim(),
      searchUrl =
        typeof selected.searchUrl === 'string' ? selected.searchUrl.trim() : '',
      url = key && searchUrl ? searchUrl : sort.url,
      sortName = key && searchUrl ? t('search') : sort.title,
      token = ++request.current;
    setLoading(true);
    setError(false);
    setMessage(t('refreshingRss', { name: selected.sourceName }));
    try {
      const result = await fetchRssFeedPage(selected, {
        sortName,
        url,
        page: 1,
        key,
      });
      if (request.current !== token) return;
      const next = mergeRssArticles(articles, result.articles);
      setArticles(next);
      saveRssArticles(next);
      setActiveSort(sortName);
      setActiveKey(key);
      setPage(1);
      setNextUrl(result.nextUrl);
      setMessage(t('rssArticlesFetched', { count: result.articles.length }));
    } catch (reason) {
      if (request.current !== token) return;
      addAppLog(`RSS refresh failed: ${selected.sourceName}`, reason);
      setError(true);
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (request.current === token) setLoading(false);
    }
  };
  const loadMore = async () => {
    if (!selected || !nextUrl || loading || paging) return;
    const nextPage = page + 1,
      token = ++request.current;
    setPaging(true);
    setError(false);
    try {
      const result = await fetchRssFeedPage(selected, {
        sortName: activeSort,
        url: nextUrl,
        page: nextPage,
        key: activeKey,
      });
      if (request.current !== token) return;
      const next = mergeRssArticles(articles, result.articles),
        before = articles.length;
      setArticles(next);
      saveRssArticles(next);
      setPage(nextPage);
      setNextUrl(next.length > before ? result.nextUrl : '');
      setMessage(t('rssArticlesFetched', { count: result.articles.length }));
    } catch (reason) {
      if (request.current !== token) return;
      addAppLog(`RSS next page failed: ${selected.sourceName}`, reason);
      setError(true);
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (request.current === token) setPaging(false);
    }
  };
  const importSources = async () => {
    try {
      const incoming = parseRssSources(await Clipboard.getString());
      const next = mergeRssSources(sources, incoming);
      setSources(next);
      saveRssSources(next);
      setSourceUrl(incoming[0].sourceUrl);
      void jssdk.showToast({
        type: 'success',
        title: t('rssSourcesImported', { count: incoming.length }),
      });
    } catch (error) {
      void jssdk.showToast({
        type: 'error',
        title: t('rssSourceImportFailed'),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
  if (!enabledSources.length)
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Text style={[s.empty, { color: colors.text }]}>
          {t(sources.length ? 'noEnabledRssSources' : 'noRssSources')}
        </Text>
        <Text style={[s.muted, { color: colors.muted }]}>
          {t('rssImportHelp')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('importRssSources')}
          style={[s.primary, { backgroundColor: colors.primary }]}
          onPress={() => void importSources()}
        >
          <Text style={s.primaryText}>{t('importFromClipboard')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('manageRssSources')}
          style={s.secondary}
          onPress={manage}
        >
          <Text style={[s.secondaryText, { color: colors.primary }]}>
            {t('manageRssSources')}
          </Text>
        </Pressable>
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
        {enabledSources.map(source => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chooseRssSource', {
              name: source.sourceName,
            })}
            accessibilityState={{ selected: sourceUrl === source.sourceUrl }}
            key={source.sourceUrl}
            style={[
              s.chip,
              {
                backgroundColor:
                  sourceUrl === source.sourceUrl
                    ? colors.primary
                    : colors.surface,
              },
            ]}
            onPress={() => setSourceUrl(source.sourceUrl)}
          >
            <Text
              style={[
                sourceUrl === source.sourceUrl ? s.activeText : s.text,
                {
                  color: sourceUrl === source.sourceUrl ? '#fff' : colors.text,
                },
              ]}
            >
              {source.sourceName}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {sortState.invalid ? (
        <Text
          accessibilityRole="alert"
          style={[s.warning, { color: colors.danger }]}
        >
          {t('rssInvalidSort')}
        </Text>
      ) : null}
      {sortState.entries.length > 1 ? (
        <ScrollView
          horizontal
          style={s.horizontalRail}
          contentContainerStyle={s.categories}
          showsHorizontalScrollIndicator={false}
        >
          {sortState.entries.map((entry, index) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chooseRssCategory', { name: entry.title })}
              accessibilityState={{ selected: index === sortIndex }}
              key={`${entry.title}:${entry.url}`}
              style={s.category}
              onPress={() => setSortIndex(index)}
            >
              <Text
                style={{
                  color: index === sortIndex ? colors.primary : colors.muted,
                  fontWeight: index === sortIndex ? '700' : '400',
                }}
              >
                {entry.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {selected &&
      typeof selected.searchUrl === 'string' &&
      selected.searchUrl.trim() ? (
        <View style={s.searchRow}>
          <TextInput
            accessibilityLabel={t('rssSearchPlaceholder')}
            value={searchKey}
            onChangeText={setSearchKey}
            onSubmitEditing={() => void refresh()}
            returnKeyType="search"
            placeholder={t('rssSearchPlaceholder')}
            placeholderTextColor={colors.muted}
            style={[
              s.searchInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('searchRss')}
            style={s.searchButton}
            onPress={() => void refresh()}
          >
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {t('search')}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView
        horizontal
        style={s.horizontalRail}
        contentContainerStyle={s.actions}
        showsHorizontalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('refresh')}
          style={({ pressed }) => [
            s.action,
            { backgroundColor: colors.surface },
            pressed && s.pressed,
          ]}
          onPress={() => void refresh()}
        >
          <Text style={[s.actionText, { color: colors.text }]}>
            {t('refresh')}
          </Text>
        </Pressable>
        {(['all', 'history', 'favorites'] as const).map(view => (
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel={t(
              view === 'all'
                ? 'showAllArticles'
                : view === 'history'
                  ? 'historyOnly'
                  : 'favoritesOnly',
            )}
            accessibilityState={{ checked: articleView === view }}
            key={view}
            style={({ pressed }) => [
              s.action,
              {
                backgroundColor:
                  articleView === view ? colors.primary : colors.surface,
              },
              pressed && s.pressed,
            ]}
            onPress={() => setArticleView(view)}
          >
            <Text
              style={[
                articleView === view ? s.actionTextActive : s.actionText,
                { color: articleView === view ? '#fff' : colors.text },
              ]}
            >
              {t(
                view === 'all'
                  ? 'showAllArticles'
                  : view === 'history'
                    ? 'historyOnly'
                    : 'favoritesOnly',
              )}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('importRssSources')}
          style={({ pressed }) => [
            s.action,
            { backgroundColor: colors.surface },
            pressed && s.pressed,
          ]}
          onPress={() => void importSources()}
        >
          <Text style={[s.actionText, { color: colors.text }]}>
            {t('importSource')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('manageRssSources')}
          style={({ pressed }) => [
            s.action,
            { backgroundColor: colors.surface },
            pressed && s.pressed,
          ]}
          onPress={manage}
        >
          <Text style={[s.actionText, { color: colors.text }]}>
            {t('manageSource')}
          </Text>
        </Pressable>
      </ScrollView>
      {articleView === 'favorites' && favoriteGroups.length ? (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.favoriteGroups}
          >
            {favoriteGroups.map(group => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: favoriteGroup === group }}
                accessibilityLabel={t('chooseNamedFavoriteGroup', {
                  name: group,
                })}
                key={group}
                style={[
                  s.favoriteChip,
                  {
                    borderColor:
                      favoriteGroup === group ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFavoriteGroup(group)}
              >
                <Text
                  style={{
                    color:
                      favoriteGroup === group ? colors.primary : colors.text,
                  }}
                >
                  {group === DEFAULT_RSS_FAVORITE_GROUP
                    ? t('defaultFavoriteGroup')
                    : group}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={s.favoriteManage}>
            <Pressable
              accessibilityRole="button"
              style={s.favoriteManageButton}
              onPress={() => setFavoriteDelete('group')}
            >
              <Text style={{ color: colors.danger }}>
                {t('deleteFavoriteGroup')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.favoriteManageButton}
              onPress={() => setFavoriteDelete('all')}
            >
              <Text style={{ color: colors.danger }}>
                {t('clearFavorites')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            s.message,
            {
              color: error ? colors.danger : colors.muted,
              backgroundColor: colors.surface,
              borderColor: error ? colors.danger : colors.border,
            },
          ]}
        >
          {message}
        </Text>
      ) : null}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={s.loading} />
      ) : visible.length ? (
        <ScrollView style={s.contentScroll} contentContainerStyle={s.list}>
          {visible.map(article => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('openRssArticle', { name: article.title })}
              key={article.id}
              style={[s.article, { backgroundColor: colors.surface }]}
              onPress={() => open(article.id)}
            >
              <View style={s.articleTitle}>
                <Text
                  numberOfLines={2}
                  style={[
                    s.title,
                    { color: article.read ? colors.muted : colors.text },
                    article.read && s.read,
                  ]}
                >
                  {article.title}
                </Text>
                {article.starred ? <Text style={s.star}>★</Text> : null}
              </View>
              <Text style={[s.muted, { color: colors.muted }]}>
                {article.pubDate || article.sort}
              </Text>
              {articleView === 'history' && article.readTime ? (
                <Text style={[s.muted, { color: colors.muted }]}>
                  {t('rssReadAt', {
                    date: new Date(article.readTime).toLocaleString(),
                  })}
                </Text>
              ) : null}
              {article.description ? (
                <Text
                  numberOfLines={2}
                  style={[s.description, { color: colors.muted }]}
                >
                  {plain(article.description)}
                </Text>
              ) : null}
            </Pressable>
          ))}
          {articleView === 'all' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                nextUrl ? t('loadMoreArticles') : t('noMoreArticles')
              }
              disabled={!nextUrl || paging}
              style={s.loadMore}
              onPress={() => void loadMore()}
            >
              {paging ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text
                  style={{
                    color: nextUrl ? colors.primary : colors.muted,
                    fontWeight: '700',
                  }}
                >
                  {nextUrl ? t('loadMoreArticles') : t('noMoreArticles')}
                </Text>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      ) : (
        <View style={s.center}>
          <Text style={[s.empty, { color: colors.text }]}> 
            {articleView === 'favorites'
              ? t('noFavoriteArticles')
              : articleView === 'history'
                ? t('noRssHistory')
                : t('refreshForArticles')}
          </Text>
          {articleView === 'all' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('refresh')}
              style={({ pressed }) => [
                s.primary,
                { backgroundColor: colors.primary },
                pressed && s.pressed,
              ]}
              onPress={() => void refresh()}
            >
              <Text style={s.primaryText}>{t('refresh')}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <InTreeSheet
        visible={!!favoriteDelete}
        onDismiss={() => setFavoriteDelete(null)}
      >
        <Text style={[s.confirmTitle, { color: colors.text }]}>
          {favoriteDelete === 'all'
            ? t('clearFavoritesTitle')
            : t('deleteFavoriteGroupTitle', {
                name:
                  favoriteGroup === DEFAULT_RSS_FAVORITE_GROUP
                    ? t('defaultFavoriteGroup')
                    : favoriteGroup,
              })}
        </Text>
        <Text style={{ color: colors.muted }}>{t('favoriteDeleteHelp')}</Text>
        <View style={s.confirmActions}>
          <Pressable
            accessibilityRole="button"
            style={s.confirmButton}
            onPress={() => setFavoriteDelete(null)}
          >
            <Text style={{ color: colors.text }}>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[s.confirmButton, { backgroundColor: colors.danger }]}
            onPress={() => {
              commitArticles(
                favoriteDelete === 'all'
                  ? clearRssFavorites(articles)
                  : deleteRssFavoriteGroup(articles, favoriteGroup),
              );
              setFavoriteDelete(null);
            }}
          >
            <Text style={s.primaryText}>{t('delete')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
    </View>
  );
}

const plain = (value: string) =>
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  primary: {
    minHeight: 48,
    borderRadius: 24,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  secondaryText: { fontWeight: '700' },
  horizontalRail: { flexGrow: 0 },
  tabs: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 22,
  },
  text: {},
  activeText: { color: '#fff', fontWeight: '700' },
  actions: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  action: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  actionText: {},
  actionTextActive: { fontWeight: '700' },
  message: {
    marginHorizontal: 16,
    marginVertical: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  loading: { marginTop: 40 },
  list: { padding: 12, gap: 10 },
  article: { borderRadius: 10, padding: 14, gap: 7 },
  articleTitle: { flexDirection: 'row', gap: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  read: { fontWeight: '500' },
  star: { color: '#d59518', fontSize: 18 },
  description: { lineHeight: 20 },
  warning: { paddingHorizontal: 16, paddingVertical: 6 },
  categories: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  category: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchButton: {
    minWidth: 60,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.56 },
  loadMore: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  favoriteGroups: { paddingHorizontal: 12, gap: 8 },
  favoriteChip: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  favoriteManage: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
  },
  favoriteManageButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  confirmTitle: { fontSize: 19, fontWeight: '700', marginBottom: 8 },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  confirmButton: {
    minWidth: 86,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
