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
import { WebView } from 'react-native-webview';
import { findMediaUrl } from '../core/media';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import { fetchRssArticleContent } from '../core/rss';
import {
  loadRssArticles,
  loadRssSources,
  saveRssArticles,
  setRssFavorite,
  rssFavoriteGroups,
  updateRssArticle,
} from '../data/rss';
import { useAppTheme } from '../theme/AppTheme';

export const plainRssText = (value: string) =>
  value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();

export function RssReader({
  articleId,
  back,
  play,
}: {
  articleId: string;
  back: () => void;
  play: (url: string, title: string) => void;
}) {
  const { colors, t } = useAppTheme();
  const [articles, setArticles] = useState(() => {
    const next = updateRssArticle(loadRssArticles(), articleId, {
      read: true,
      readTime: Date.now(),
    });
    saveRssArticles(next);
    return next;
  });
  const article = useMemo(
    () => articles.find(item => item.id === articleId),
    [articleId, articles],
  );
  const source = useMemo(
    () => loadRssSources().find(item => item.sourceUrl === article?.origin),
    [article?.origin],
  );
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [web, setWeb] = useState(false),
    [message, setMessage] = useState(''),
    [favoriteSheet, setFavoriteSheet] = useState(false),
    [favoriteGroup, setFavoriteGroup] = useState('');
  const request = useRef(0);
  const loadContent = useCallback(
    async (force = false) => {
      const current = loadRssArticles().find(item => item.id === articleId),
        currentSource = loadRssSources().find(
          item => item.sourceUrl === current?.origin,
        );
      if (
        !current ||
        !currentSource ||
        (!force && current.content) ||
        !currentSource.ruleContent
      )
        return;
      const token = ++request.current;
      setLoading(true);
      setError('');
      setMessage('');
      try {
        const content = await fetchRssArticleContent(current, currentSource);
        if (request.current !== token) return;
        const next = updateRssArticle(loadRssArticles(), articleId, {
          content,
        });
        saveRssArticles(next);
        setArticles(next);
        setMessage(t('rssContentRefreshed'));
      } catch (reason) {
        if (request.current === token)
          setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        if (request.current === token) setLoading(false);
      }
    },
    [articleId, t],
  );
  useEffect(() => {
    if (!article?.content) void loadContent();
    return () => {
      request.current += 1;
    };
  }, [article?.content, loadContent]);
  if (!article)
    return (
      <View style={[s.flex, { backgroundColor: colors.background }]}>
        <PageHeader title={t('rssArticleMissing')} onBack={back} />
        <View style={s.center}>
          <Text style={{ color: colors.muted }}>{t('rssArticleRemoved')}</Text>
        </View>
      </View>
    );
  const toggleStar = () => {
    if (!article.starred) {
      setFavoriteGroup('');
      setFavoriteSheet(true);
      return;
    }
    const next = setRssFavorite(loadRssArticles(), articleId, false);
    saveRssArticles(next);
    setArticles(next);
  };
  const chooseFavoriteGroup = (group: string) => {
    const next = setRssFavorite(loadRssArticles(), articleId, true, group);
    saveRssArticles(next);
    setArticles(next);
    setFavoriteSheet(false);
    setFavoriteGroup('');
  };
  const favoriteGroups = rssFavoriteGroups(articles);
  const media = findMediaUrl(
      article.content || article.description || article.link || '',
      article.link,
    ),
    canWeb =
      typeof source?.injectJs === 'string' &&
      !!source.injectJs.trim() &&
      /^https?:/i.test(article.link);
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={article.sort || t('rssReaderTitle')}
        onBack={back}
        action={
          <View style={s.actions}>
            {source?.ruleContent ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('refreshRssContent')}
                accessibilityState={{ disabled: loading }}
                disabled={loading}
                style={s.touch}
                onPress={() => void loadContent(true)}
              >
                <Text style={[s.actionIcon, { color: colors.primary }]}>↻</Text>
              </Pressable>
            ) : null}
            {canWeb ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  web ? t('showParsedContent') : t('showOriginalPage')
                }
                accessibilityState={{ selected: web }}
                style={s.touch}
                onPress={() => {
                  setError('');
                  setWeb(value => !value);
                }}
              >
                <Text style={[s.web, { color: colors.primary }]}>
                  {web ? t('parsedContentMark') : t('originalPageMark')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                article.starred ? t('removeFavorite') : t('addFavorite')
              }
              accessibilityState={{ selected: article.starred }}
              style={s.touch}
              onPress={toggleStar}
            >
              <Text style={s.star}>{article.starred ? '★' : '☆'}</Text>
            </Pressable>
          </View>
        }
      />
      {message && !web ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.notice, { color: colors.primary }]}
        >
          {message}
        </Text>
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[s.error, { color: colors.danger }]}
        >
          {error}
        </Text>
      ) : null}
      {web && canWeb ? (
        <WebView
          source={{ uri: article.link }}
          injectedJavaScript={String(source?.injectJs)}
          javaScriptEnabled
          originWhitelist={['http://*', 'https://*']}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(t('rssWebPageFailed'));
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          <Text style={[s.title, { color: colors.text }]}>{article.title}</Text>
          {article.pubDate ? (
            <Text style={[s.meta, { color: colors.muted }]}>
              {article.pubDate}
            </Text>
          ) : null}
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          <Text selectable style={[s.body, { color: colors.text }]}>
            {plainRssText(
              article.content || article.description || t('emptyRssContent'),
            )}
          </Text>
          {article.link ? (
            <Text selectable style={[s.link, { color: colors.primary }]}>
              {article.link}
            </Text>
          ) : null}
          {media ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('playVideo')}
              style={[s.play, { backgroundColor: colors.primary }]}
              onPress={() => play(media, article.title)}
            >
              <Text style={s.playText}>{t('playVideo')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
      <InTreeSheet
        visible={favoriteSheet}
        onDismiss={() => setFavoriteSheet(false)}
      >
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          {t('chooseFavoriteGroup')}
        </Text>
        {favoriteGroups.map(group => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chooseNamedFavoriteGroup', { name: group })}
            key={group}
            style={[s.group, { borderColor: colors.border }]}
            onPress={() => chooseFavoriteGroup(group)}
          >
            <Text style={{ color: colors.text }}>{group}</Text>
          </Pressable>
        ))}
        <TextInput
          accessibilityLabel={t('newFavoriteGroup')}
          value={favoriteGroup}
          onChangeText={setFavoriteGroup}
          placeholder={t('newFavoriteGroup')}
          placeholderTextColor={colors.muted}
          style={[
            s.groupInput,
            { borderColor: colors.border, color: colors.text },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !favoriteGroup.trim() }}
          disabled={!favoriteGroup.trim()}
          style={[
            s.favoriteButton,
            {
              backgroundColor: favoriteGroup.trim()
                ? colors.primary
                : colors.border,
            },
          ]}
          onPress={() => chooseFavoriteGroup(favoriteGroup)}
        >
          <Text style={s.playText}>{t('addFavorite')}</Text>
        </Pressable>
      </InTreeSheet>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row' },
  actionIcon: { fontSize: 25, fontWeight: '700' },
  web: { fontSize: 17, fontWeight: '700' },
  star: { fontSize: 28, color: '#d59518' },
  notice: { paddingHorizontal: 20, paddingTop: 8 },
  error: { marginHorizontal: 20, marginVertical: 10 },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 25, lineHeight: 34, fontWeight: '700' },
  meta: { marginTop: 10, marginBottom: 22 },
  body: { fontSize: 18, lineHeight: 31 },
  link: { marginTop: 30, fontSize: 13 },
  play: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: { color: '#fff', fontWeight: '700' },
  sheetTitle: { fontSize: 19, fontWeight: '700', marginBottom: 10 },
  group: {
    minHeight: 46,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  groupInput: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  favoriteButton: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
