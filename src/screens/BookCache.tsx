import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PageHeader } from '../components/PageHeader';
import { cacheBookChapters, mergeRefreshedChapters, type CacheFailure, type CacheProgress } from '../core/bookCache';
import { loadBookInfo, loadChapterContent, loadChapters } from '../core/webBook';
import { cacheMangaBatch, clearMangaCache, mangaCacheStats } from '../core/mangaCache';
import { parseMangaImages } from '../core/manga';
import { buildSourceRequest } from '../core/sourceRequest';
import { loadSources } from '../data/sources';
import type { MessageKey } from '../i18n';
import { useAppTheme } from '../theme/AppTheme';
import type { Book, BookChapter, BookSource, SearchBook } from '../types';
import { loadGeneralPreferences } from '../data/generalPreferences';

type Notice = { key: MessageKey; values?: Record<string, string | number> } | { raw: string };

export function BookCache({ book, back, changed }: { book?: Book; back: () => void; changed: (book: Book) => void }) {
  const { colors, t } = useAppTheme();
  const [draft, setDraft] = useState(book);
  const [source, setSource] = useState<BookSource>();
  const [refreshing, setRefreshing] = useState(!!book?.origin);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<CacheProgress>();
  const [failures, setFailures] = useState<CacheFailure[]>([]);
  const [notice, setNotice] = useState<Notice>();
  const [imageStats, setImageStats] = useState({ files: 0, bytes: 0 });
  const cancelled = useRef(false);
  const mounted = useRef(true);

  useEffect(() => () => {
    mounted.current = false;
    cancelled.current = true;
  }, []);
  useEffect(() => {
    if (book?.sourceType === 2) void mangaCacheStats(book.id).then(setImageStats);
  }, [book?.id, book?.sourceType]);
  useEffect(() => {
    if (!book?.origin || !book.bookUrl) {
      setRefreshing(false);
      setNotice({ key: book ? 'localBookNoNetworkCache' : 'bookRemoved' });
      return;
    }
    let active = true;
    setRefreshing(true);
    void loadSources()
      .then(sources => {
        const found = sources.find(item => item.bookSourceUrl === book.origin);
        if (!found) throw new Error(t('sourceMissing'));
        setSource(found);
        const searchBook: SearchBook = {
          bookUrl: book.bookUrl!,
          tocUrl: book.tocUrl,
          origin: book.origin!,
          originName: book.originName ?? found.bookSourceName,
          name: book.name,
          author: book.author,
          intro: book.intro,
          coverUrl: book.coverUrl,
        };
        return loadBookInfo(found, searchBook).then(info => loadChapters(found, info).then(chapters => ({ info, chapters })));
      })
      .then(({ info, chapters }) => {
        if (!active) return;
        const next = mergeRefreshedChapters(book, info, chapters);
        setDraft(next);
        changed(next);
        setNotice({ key: 'directoryRefreshed', values: { count: chapters.length } });
      })
      .catch(reason => {
        if (active) setNotice({ key: 'directoryRefreshFailed', values: { error: reason instanceof Error ? reason.message : String(reason) } });
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
      cancelled.current = true;
    };
  }, [book?.id, t]);

  const start = async (fromCurrent: boolean) => {
    if (!draft || !source || running) return;
    cancelled.current = false;
    setRunning(true);
    setFailures([]);
    setProgress(undefined);
    setNotice({ key: 'preparingCache' });
    try {
      const concurrency = loadGeneralPreferences().threadCount;
      const result = await cacheBookChapters(
        draft,
        (chapter, index) => {
          const remote: BookChapter = {
            url: chapter.url!,
            title: chapter.title,
            index,
            bookUrl: draft.bookUrl ?? '',
            baseUrl: chapter.baseUrl ?? draft.tocUrl ?? draft.bookUrl ?? '',
            isVolume: !!chapter.isVolume,
            isVip: !!chapter.isVip,
            isPay: !!chapter.isPay,
          };
          return loadChapterContent(source, remote);
        },
        {
          fromIndex: fromCurrent ? (draft.currentChapterIndex ?? 0) : 0,
          concurrency,
          cancelled: () => cancelled.current,
          onProgress: setProgress,
        },
      );
      changed(result.book);
      if (result.book.sourceType === 2) {
        const images = result.book.chapters?.flatMap(chapter => parseMangaImages(chapter.content, chapter.baseUrl ?? result.book.tocUrl ?? result.book.bookUrl ?? '')) ?? [];
        const firstUrl = result.book.chapters?.find(chapter => chapter.url)?.url;
        const headers = firstUrl ? buildSourceRequest(source, firstUrl).headers : {};
        setNotice({ key: 'cachingMangaImages', values: { count: images.length } });
        const imageResult = await cacheMangaBatch(result.book.id, images, headers, {
          concurrency,
          cancelled: () => cancelled.current,
          onProgress: (completed, total, failed) => setProgress({ completed, total, failed, chapterTitle: t('mangaImages') }),
        });
        if (mounted.current) setImageStats(await mangaCacheStats(result.book.id));
        if (imageResult.failed) result.failures.push({ chapterId: 'manga-images', chapterTitle: t('mangaImages'), message: t('mangaImageFailures', { count: imageResult.failed }) });
      }
      if (!mounted.current) return;
      setDraft(result.book);
      setFailures(result.failures);
      setNotice(result.cancelled
        ? { key: 'cacheStopped', values: { count: result.completed - result.failures.length } }
        : result.failures.length
          ? { key: 'cacheCompleteWithFailures', values: { count: result.failures.length } }
          : { key: 'cacheComplete', values: { count: result.completed } });
    } catch (reason) {
      if (mounted.current) setNotice({ raw: reason instanceof Error ? reason.message : String(reason) });
    } finally {
      if (mounted.current) setRunning(false);
    }
  };
  const chapters = draft?.chapters ?? [];
  const cached = chapters.filter(chapter => chapter.isVolume || !!chapter.content).length;
  const message = notice ? ('raw' in notice ? notice.raw : t(notice.key, notice.values)) : '';

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('offlineCacheTitle')} onBack={back} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.name, { color: colors.text }]}>{draft?.name ?? t('bookNotFound')}</Text>
        <Text style={[styles.stats, { color: colors.text }]}>{t('cacheStats', { cached, total: chapters.length })}</Text>
        {draft?.sourceType === 2 ? (
          <View style={styles.rowBetween}>
            <Text style={[styles.stats, { color: colors.text }]}>{t('mangaCacheStats', { count: imageStats.files, size: (imageStats.bytes / 1024 / 1024).toFixed(1) })}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('clearImages')} style={styles.clear} onPress={() => void clearMangaCache(draft.id).then(() => setImageStats({ files: 0, bytes: 0 }))}>
              <Text style={[styles.clearText, { color: colors.danger }]}>{t('clearImages')}</Text>
            </Pressable>
          </View>
        ) : null}
        {refreshing ? <View style={styles.row}><ActivityIndicator color={colors.primary} /><Text style={[styles.message, { color: colors.muted }]}>{t('refreshingDirectory')}</Text></View> : null}
        {message ? <Text style={[styles.message, { color: colors.muted }]}>{message}</Text> : null}
        {progress ? (
          <View style={[styles.progressBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.progressText, { color: colors.primary }]}>{t('cacheProgress', { completed: progress.completed, total: progress.total, failed: progress.failed })}</Text>
            <Text numberOfLines={1} style={[styles.message, { color: colors.muted }]}>{progress.chapterTitle}</Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          {running ? (
            <Pressable accessibilityRole="button" style={[styles.stop, { backgroundColor: colors.danger }]} onPress={() => { cancelled.current = true; setNotice({ key: 'stoppingCache' }); }}>
              <Text style={styles.primaryText}>{t('stopCache')}</Text>
            </Pressable>
          ) : (
            <>
              <Pressable accessibilityRole="button" disabled={!source || refreshing} accessibilityState={{ disabled: !source || refreshing }} style={[styles.secondary, { borderColor: colors.primary }, (!source || refreshing) && styles.disabled]} onPress={() => void start(true)}>
                <Text style={[styles.secondaryText, { color: colors.primary }]}>{t('cacheAfterCurrent')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={!source || refreshing} accessibilityState={{ disabled: !source || refreshing }} style={[styles.primary, { backgroundColor: colors.primary }, (!source || refreshing) && styles.disabled]} onPress={() => void start(false)}>
                <Text style={styles.primaryText}>{t(failures.length ? 'retryFailedChapters' : 'cacheAllChapters')}</Text>
              </Pressable>
            </>
          )}
        </View>
        {failures.length ? (
          <View style={styles.failures}>
            <Text style={[styles.failureTitle, { color: colors.danger }]}>{t('failedChapters')}</Text>
            {failures.map(failure => (
              <View key={failure.chapterId} style={[styles.failure, { backgroundColor: colors.surface, borderColor: colors.danger }]}>
                <Text style={[styles.failureName, { color: colors.text }]}>{failure.chapterTitle}</Text>
                <Text style={[styles.failureMessage, { color: colors.danger }]}>{failure.message}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  name: { fontSize: 22, fontWeight: '800' },
  stats: { fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  clear: { minWidth: 88, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontWeight: '700' },
  message: { lineHeight: 21 },
  progressBox: { padding: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, gap: 7 },
  progressText: { fontSize: 17, fontWeight: '700' },
  actions: { gap: 10 },
  primary: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { minHeight: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontWeight: '700' },
  stop: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.42 },
  failures: { marginTop: 8, gap: 8 },
  failureTitle: { fontSize: 17, fontWeight: '700' },
  failure: { padding: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, gap: 4 },
  failureName: { fontWeight: '700' },
  failureMessage: {},
});
