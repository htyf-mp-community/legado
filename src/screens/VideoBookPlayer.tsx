import { useBookVisit } from '../hooks/useBookVisit';
import { useBookCatalogue } from '../hooks/useBookCatalogue';
import { BookCatalogueStatus } from '../components/BookCatalogueStatus';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Video, { type VideoRef } from 'react-native-video';
import { PageHeader } from '../components/PageHeader';
import { activeDanmaku, parseDanmaku } from '../core/danmaku';
import { buildSourceRequest } from '../core/sourceRequest';
import { groupVideoEpisodes, parseVideoSources } from '../core/videoBook';
import { loadChapterPayload } from '../core/webBook';
import { loadSources } from '../data/sources';
import { loadVideoProgress, saveVideoProgress } from '../data/videoProgress';
import { useAppTheme } from '../theme/AppTheme';
import type { Book } from '../types';

type Props = { book?: Book; back: () => void; update: (book: Book, before?: Book) => void; download: (url: string, title: string, headers: Record<string, string>) => void };

export function VideoBookPlayer({ book, back, update: commitBook, download }: Props) {
  useBookVisit(book?.id);
  const update = useCallback((next: Book) => commitBook(next, book), [commitBook, book]);
  const { colors, t } = useAppTheme(), chapters = book?.chapters ?? [], volumes = useMemo(() => groupVideoEpisodes(chapters), [chapters]);
  const initial = Math.max(0, Math.min(book?.currentChapterIndex ?? 0, chapters.length - 1));
  const [chapterIndex, setChapterIndex] = useState(initial), [line, setLine] = useState(0), [sources, setSources] = useState<ReturnType<typeof parseVideoSources>>([]), [headers, setHeaders] = useState<Record<string, string>>({}), [loading, setLoading] = useState(false), [error, setError] = useState(''), [position, setPosition] = useState(0), [danmakuVisible, setDanmakuVisible] = useState(true);
  const ref = useRef<VideoRef>(null), positionRef = useRef(0), chapter = chapters[chapterIndex], activeVolume = Math.max(0, volumes.findIndex(item => item.episodeIndexes.includes(chapterIndex))), request = sources[line];
  const catalogue = useBookCatalogue(book, setChapterIndex);
  const danmaku = useMemo(() => parseDanmaku(chapter?.danmaku ?? ''), [chapter?.danmaku]), visibleDanmaku = danmakuVisible ? activeDanmaku(danmaku, position) : [];

  useEffect(() => {
    if (!book || !chapter || catalogue.needed) return;
    let active = true;
    setLoading(true); setError(''); setSources([]); setLine(0); setPosition(0);
    void loadSources().then(async all => {
      const source = all.find(item => item.bookSourceUrl === book.origin);
      if (!source) throw new Error(t('videoSourceMissing'));
      let content = chapter.content, subContent = chapter.danmaku ?? '';
      if (!content || !subContent) {
        if (!chapter.url) throw new Error(t('episodeRuleMissing'));
        const payload = await loadChapterPayload(source, { url: chapter.url, title: chapter.title, index: chapterIndex, bookUrl: book.bookUrl ?? '', baseUrl: chapter.baseUrl ?? book.tocUrl ?? book.bookUrl ?? '', isVolume: !!chapter.isVolume, isVip: !!chapter.isVip, isPay: !!chapter.isPay });
        content ||= payload.content; subContent ||= payload.subContent;
      }
      const parsed = parseVideoSources(content, chapter.baseUrl ?? chapter.url ?? book.bookUrl);
      if (!parsed.length) throw new Error(t('noPlayableVideo'));
      const requestHeaders = chapter.url ? buildSourceRequest(source, chapter.url).headers : {};
      if (active) {
        setSources(parsed); setHeaders(requestHeaders);
        const nextChapters = chapters.map((item, index) => index === chapterIndex ? { ...item, content, danmaku: subContent } : item);
        update({ ...book, chapters: nextChapters, currentChapterIndex: chapterIndex, chapterTitle: chapter.title, content, progress: (chapterIndex + 1) / Math.max(1, chapters.length), updatedAt: Date.now() });
      }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (request && positionRef.current > 2) saveVideoProgress(request.uri, positionRef.current); };
  }, [book?.id, book?.origin, chapter?.url, chapterIndex, t, catalogue.needed]);

  const nextEpisode = () => { const ordered = volumes.flatMap(item => item.episodeIndexes), cursor = ordered.indexOf(chapterIndex); if (cursor >= 0 && cursor < ordered.length - 1) setChapterIndex(ordered[cursor + 1]); };
  if (!book) return <View style={[s.flex, { backgroundColor: colors.background }]}><PageHeader title={t('videoMissing')} onBack={back} /><Text style={[s.empty, { color: colors.muted }]}>{t('videoBookRemoved')}</Text></View>;
  return <View style={[s.flex, { backgroundColor: colors.background }]}><PageHeader title={book.name} onBack={back} action={request ? <Pressable accessibilityRole="button" style={s.touch} onPress={() => download(request.uri, chapter?.title ?? book.name, { ...headers, ...request.headers })}><Text style={{ color: colors.primary }}>{t('download')}</Text></Pressable> : undefined} />
    <BookCatalogueStatus state={catalogue} />
    <View style={s.stage}>{request ? <><Video key={request.uri} ref={ref} source={{ uri: request.uri, headers: { ...headers, ...request.headers } }} style={StyleSheet.absoluteFill} controls resizeMode="contain" fullscreenAutorotate preventsDisplaySleepDuringVideoPlayback onLoad={event => { const saved = loadVideoProgress(request.uri); if (saved > 2 && saved < event.duration - 5) ref.current?.seek(saved); }} onProgress={event => { positionRef.current = event.currentTime; setPosition(event.currentTime); }} onEnd={nextEpisode} onError={event => setError(event.error.errorString ?? t('videoPlaybackFailed'))} /><View pointerEvents="none" style={StyleSheet.absoluteFill}>{visibleDanmaku.map((item, index) => <Text numberOfLines={1} key={`${item.time}:${item.text}`} style={[s.danmaku, { color: item.color, top: item.mode === 'top' ? 8 : item.mode === 'bottom' ? undefined : 8 + index * 28, bottom: item.mode === 'bottom' ? 8 : undefined, left: item.mode === 'scroll' ? `${Math.max(-20, 100 - (position - item.time) * 20)}%` : '15%' }]}>{item.text}</Text>)}</View></> : loading ? <ActivityIndicator color="#fff" /> : <Text style={s.stageText}>{error || t('chooseEpisode')}</Text>}</View>
    {danmaku.length ? <Pressable accessibilityRole="switch" accessibilityState={{ checked: danmakuVisible }} style={s.danmakuToggle} onPress={() => setDanmakuVisible(value => !value)}><Text style={{ color: colors.primary }}>{t(danmakuVisible ? 'disableDanmaku' : 'enableDanmaku')} · {danmaku.length}</Text></Pressable> : null}
    {error ? <Text accessibilityRole="alert" style={[s.error, { color: colors.danger }]}>{error}</Text> : null}<ScrollView contentContainerStyle={s.content}><Text style={[s.heading, { color: colors.text }]}>{t('lines')}</Text><View style={s.row}>{sources.map((item, index) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: line === index }} key={item.uri} style={[s.pill, { borderColor: line === index ? colors.primary : colors.border }]} onPress={() => setLine(index)}><Text style={{ color: colors.text }}>{t('lineNumber', { number: index + 1 })}</Text></Pressable>)}</View><Text style={[s.heading, { color: colors.text }]}>{t('volumes')}</Text><View style={s.row}>{volumes.map((volume, index) => <Pressable accessibilityRole="button" key={`${volume.title}:${index}`} style={[s.pill, { borderColor: activeVolume === index ? colors.primary : colors.border }]} onPress={() => setChapterIndex(volume.episodeIndexes[0])}><Text style={{ color: colors.text }}>{volume.title}</Text></Pressable>)}</View><Text style={[s.heading, { color: colors.text }]}>{t('episodes')}</Text><View style={s.episodes}>{(volumes[activeVolume]?.episodeIndexes ?? []).map(index => <Pressable accessibilityRole="radio" accessibilityState={{ selected: chapterIndex === index }} key={chapters[index].id} style={[s.episode, { backgroundColor: chapterIndex === index ? colors.primary : colors.surface, borderColor: colors.border }]} onPress={() => setChapterIndex(index)}><Text numberOfLines={2} style={{ color: chapterIndex === index ? '#fff' : colors.text }}>{chapters[index].title}</Text></Pressable>)}</View></ScrollView></View>;
}

const s = StyleSheet.create({ flex: { flex: 1 }, stage: { aspectRatio: 16 / 9, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, stageText: { color: '#fff', padding: 20, textAlign: 'center' }, danmaku: { position: 'absolute', fontWeight: '700', textShadowColor: '#000', textShadowRadius: 2 }, danmakuToggle: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, content: { padding: 16, gap: 10, paddingBottom: 50 }, heading: { fontSize: 17, fontWeight: '800', marginTop: 6 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pill: { minHeight: 44, minWidth: 64, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }, episodes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, episode: { minHeight: 50, width: '31%', borderWidth: 1, borderRadius: 8, padding: 8, alignItems: 'center', justifyContent: 'center' }, touch: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }, error: { paddingHorizontal: 16, paddingTop: 10 }, empty: { padding: 24, textAlign: 'center' } });
