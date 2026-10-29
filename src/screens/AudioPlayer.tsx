import { useBookVisit } from '../hooks/useBookVisit';
import { useBookCatalogue } from '../hooks/useBookCatalogue';
import { BookCatalogueStatus } from '../components/BookCatalogueStatus';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Slider from '@react-native-community/slider';
import TrackPlayer, {
  Event,
  State,
  usePlaybackState,
  useProgress,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import { requestNotifications } from 'react-native-permissions';
import { PageHeader } from '../components/PageHeader';
// TODO(htyf-native): Background audio declarations/lifecycle still require the authorized native work recorded in docs/htyf-migration-gaps.md; foreground playback remains available.
import { formatAudioTime, parseAudioContent } from '../core/audioContent';
import { AUDIO_REMOTE_CHAPTER_EVENT } from '../core/audioRemoteNavigation';
import { ensureAudioPlayer } from '../core/audioPlayer';
import { buildSourceRequest } from '../core/sourceRequest';
import { coverImageUri, displayBookCover } from '../core/bookCover';
import { loadChapterContent } from '../core/webBook';
import {
  clearAudioSleepDeadline,
  getAudioSleepDeadline,
  loadAudioPreferences,
  saveAudioPreferences,
  setAudioSleepDeadline,
} from '../data/audioPreferences';
import { loadSources } from '../data/sources';
import type { Book, BookChapter } from '../types';
import type { BookSource } from '../types';
import { useAppTheme } from '../theme/AppTheme';
import { createDownload, runDownload } from '../core/mediaDownload';
import {
  loadDownloads,
  saveDownloads,
  type DownloadRecord,
} from '../data/downloads';

const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function AudioPlayer({
  book,
  back,
  update: commitBook,
}: {
  book?: Book;
  back: () => void;
  update: (book: Book, before?: Book) => void;
}) {
  useBookVisit(book?.id);
  const update = useCallback((next: Book) => commitBook(next, book), [commitBook, book]);
  const { colors, t } = useAppTheme();
  const [chapterIndex, setChapterIndex] = useState(
    book?.currentChapterIndex ?? 0,
  );
  const [loading, setLoading] = useState(true);
  const catalogue = useBookCatalogue(book, setChapterIndex);
  const [prepared, setPrepared] = useState(false);
  const [message, setMessage] = useState(() => t('audioPreparing'));
  const [activeSource, setActiveSource] = useState<BookSource>();
  const [activeSegments, setActiveSegments] = useState<
    ReturnType<typeof parseAudioContent>
  >([]);
  const [cacheStart, setCacheStart] = useState(() => String(chapterIndex + 1));
  const [cacheEnd, setCacheEnd] = useState(() => String(book?.chapters?.length ?? 1));
  const [caching, setCaching] = useState(false);
  const [rate, setRateValue] = useState(loadAudioPreferences().rate);
  const [mediaButtonPerNext, setMediaButtonPerNext] = useState(
    () => loadAudioPreferences().mediaButtonPerNext,
  );
  const [sleepDeadline, setSleepDeadlineState] = useState(() => {
    const deadline = getAudioSleepDeadline();
    return deadline > Date.now() ? deadline : 0;
  });
  const [now, setNow] = useState(Date.now());
  const autoPlay = useRef(false);
  const loadingRef = useRef(false);
  const playback = usePlaybackState();
  const progress = useProgress(500);
  const chapters = book?.chapters ?? [];
  const safeIndex = Math.max(0, Math.min(chapterIndex, chapters.length - 1));
  const chapter = chapters[safeIndex];
  useEffect(() => {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33)
      void requestNotifications(['alert', 'sound']).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!sleepDeadline) return;
    const interval = setInterval(() => {
      const value = Date.now();
      setNow(value);
      if (value >= sleepDeadline) {
        clearAudioSleepDeadline();
        setSleepDeadlineState(0);
        void TrackPlayer.pause();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepDeadline]);
  useEffect(() => {
    if (!book || !chapter) {
      setLoading(false);
      setMessage(t('bookOrChapterMissing'));
      return;
    }
    if (catalogue.needed) { setLoading(false); setPrepared(false); return; }
    let active = true;
    loadingRef.current = true;
    setLoading(true);
    setPrepared(false);
    setMessage(t('loadingNamedChapter', { chapter: chapter.title }));
    void loadSources()
      .then(async sources => {
        if (book.sourceType !== 1) throw new Error(t('audioSourceMissing'));
        const source = sources.find(item => item.bookSourceUrl === book.origin);
        if (!source) throw new Error(t('audioSourceMissing'));
        setActiveSource(source);
        let content = chapter.content;
        if (!content) {
          if (!chapter.url) throw new Error(t('chapterAudioRuleMissing'));
          content = await loadChapterContent(source, {
            url: chapter.url,
            title: chapter.title,
            index: safeIndex,
            bookUrl: book.bookUrl ?? '',
            baseUrl: chapter.baseUrl ?? book.tocUrl ?? book.bookUrl ?? '',
            isVolume: !!chapter.isVolume,
            isVip: !!chapter.isVip,
            isPay: !!chapter.isPay,
          });
          const nextChapters = chapters.map((item, index) =>
            index === safeIndex ? { ...item, content } : item,
          );
          update({
            ...book,
            chapters: nextChapters,
            currentChapterIndex: safeIndex,
            chapterTitle: chapter.title,
            content,
            progress: (safeIndex + 1) / chapters.length,
            updatedAt: Date.now(),
          });
        }
        const segments = parseAudioContent(content);
        if (!segments.length)
          throw new Error(t('noPlayableAudio'));
        setActiveSegments(segments);
        await ensureAudioPlayer();
        const requestHeaders = chapter.url
          ? buildSourceRequest(source, chapter.url).headers
          : {};
        await TrackPlayer.reset();
        await TrackPlayer.setQueue(
          segments.map((segment, index) => ({
            id: `${book.id}:${safeIndex}:${index}`,
            url: segment.url,
            title:
              segment.title ??
              (segments.length > 1
                ? `${chapter.title} (${index + 1}/${segments.length})`
                : chapter.title),
            artist: book.author || book.name,
            album: book.name,
            artwork: displayBookCover(book) ? coverImageUri(displayBookCover(book)!) : undefined,
            headers: { ...requestHeaders, ...segment.headers },
          })),
        );
        await TrackPlayer.setRate(rate);
        if (!active) return;
        setPrepared(true);
        setMessage(t('audioSegmentsSummary', { chapter: chapter.title, count: segments.length }));
        if (autoPlay.current) await TrackPlayer.play();
      })
      .catch(reason => {
        if (active)
          setMessage(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        loadingRef.current = false;
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [book?.id, book?.origin, chapter?.url, chapterIndex, t, catalogue.needed]);
  useTrackPlayerEvents(
    [Event.PlaybackQueueEnded, Event.PlaybackError],
    event => {
      if (event.type === Event.PlaybackError) {
        setMessage(t('playbackFailedDetail', { error: event.message }));
        return;
      }
      if (!loadingRef.current && prepared && safeIndex < chapters.length - 1) {
        autoPlay.current = true;
        setChapterIndex(safeIndex + 1);
      }
    },
  );
  const changeChapter = (next: number) => {
    if (loading || next < 0 || next >= chapters.length) return;
    autoPlay.current = playback.state === State.Playing;
    setChapterIndex(next);
  };
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      AUDIO_REMOTE_CHAPTER_EVENT,
      (direction: -1 | 1) => changeChapter(safeIndex + direction),
    );
    return () => subscription.remove();
  }, [safeIndex, loading, playback.state, chapters.length]);
  const changeRate = async (value: number) => {
    setRateValue(value);
    saveAudioPreferences({ rate: value, mediaButtonPerNext });
    if (prepared) await TrackPlayer.setRate(value);
  };
  const changeMediaButtonMode = (value: boolean) => {
    setMediaButtonPerNext(value);
    saveAudioPreferences({ rate, mediaButtonPerNext: value });
  };
  const setSleep = (minutes: number) => {
    const deadline = minutes ? Date.now() + minutes * 60_000 : 0;
    if (deadline) setAudioSleepDeadline(deadline);
    else clearAudioSleepDeadline();
    setSleepDeadlineState(deadline);
    setNow(Date.now());
  };
  const remaining = sleepDeadline
    ? Math.max(0, Math.ceil((sleepDeadline - now) / 60_000))
    : 0;
  const copyPlayUrl = async () => {
    const track = await TrackPlayer.getActiveTrack();
    const url = String(track?.url ?? activeSegments[0]?.url ?? '');
    if (!url) return setMessage(t('noCurrentPlayUrl'));
    Clipboard.setString(url);
    setMessage(t('playUrlCopied'));
  };
  const cacheRange = async () => {
    if (!book || !activeSource || caching) return;
    const start = Number.parseInt(cacheStart, 10) - 1,
      end = Number.parseInt(cacheEnd, 10) - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= chapters.length) {
      setMessage(t('invalidChapterRange'));
      return;
    }
    setCaching(true);
    try {
      const queued: DownloadRecord[] = [];
      for (let index = start; index <= end; index += 1) {
        const item = chapters[index];
        let content = item.content;
        if (!content && item.url)
          content = await loadChapterContent(activeSource, {
            url: item.url,
            title: item.title,
            index,
            bookUrl: book.bookUrl ?? '',
            baseUrl: item.baseUrl ?? book.tocUrl ?? book.bookUrl ?? '',
            isVolume: !!item.isVolume,
            isVip: !!item.isVip,
            isPay: !!item.isPay,
          });
        const headers = item.url
          ? buildSourceRequest(activeSource, item.url).headers
          : {};
        parseAudioContent(content).forEach((segment, segmentIndex) =>
          queued.push(
            createDownload(
              segment.url,
              `${book.name}-${item.title}-${segmentIndex + 1}`,
              { ...headers, ...segment.headers },
            ),
          ),
        );
      }
      if (!queued.length) throw new Error(t('noPlayableAudio'));
      saveDownloads([...queued, ...loadDownloads()]);
      let completed = 0;
      for (const item of queued) {
        const patch = (value: Partial<DownloadRecord>) => {
          const all = loadDownloads().map(download =>
            download.id === item.id ? { ...download, ...value } : download,
          );
          saveDownloads(all);
        };
        await runDownload(item, patch).catch(() => undefined);
        completed += 1;
        setMessage(t('audioCacheProgress', { completed, total: queued.length }));
      }
      setMessage(t('audioCacheComplete', { count: completed }));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setCaching(false);
    }
  };
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('audioPlayerTitle')} onBack={back} />
      <BookCatalogueStatus state={catalogue} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.cover, { backgroundColor: colors.primary }]}>
          <Text style={styles.coverText}>
            {book?.name.slice(0, 2) ?? t('audioMark')}
          </Text>
        </View>
        <Text style={[styles.bookName, { color: colors.text }]}>{book?.name ?? t('bookMissing')}</Text>
        <Text style={[styles.chapter, { color: colors.text }]}>{chapter?.title ?? t('noChapter')}</Text>
        <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.muted }]}>{message}</Text>
        {loading ? <ActivityIndicator /> : null}
        <View style={styles.timeline}>
          <Slider
            accessibilityLabel={t('playbackProgress')}
            disabled={!prepared || !progress.duration}
            minimumValue={0}
            maximumValue={Math.max(1, progress.duration)}
            value={progress.position}
            minimumTrackTintColor={colors.primary}
            onSlidingComplete={value => void TrackPlayer.seekTo(value)}
          />
          <View style={styles.times}>
            <Text style={[styles.time, { color: colors.muted }]}>
              {formatAudioTime(progress.position)}
            </Text>
            <Text style={[styles.time, { color: colors.muted }]}>
              {formatAudioTime(progress.duration)}
            </Text>
          </View>
        </View>
        <View style={styles.controls}>
          <Pressable accessibilityRole="button"
            accessibilityLabel={t('previousChapter')}
            accessibilityState={{ disabled: safeIndex === 0 || loading }}
            disabled={safeIndex === 0 || loading}
            style={styles.control}
            onPress={() => changeChapter(safeIndex - 1)}
          >
            <Text style={[styles.controlText, { color: colors.primary }]}>{t('previousChapter')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button"
            accessibilityLabel={
              t(playback.state === State.Playing ? 'pausePlayback' : 'startPlayback')
            }
            disabled={!prepared}
            accessibilityState={{ disabled: !prepared }}
            style={[styles.play, { backgroundColor: colors.primary }, !prepared && styles.disabled]}
            onPress={() =>
              void (playback.state === State.Playing
                ? TrackPlayer.pause()
                : TrackPlayer.play())
            }
          >
            <Text style={styles.playText}>
              {t(playback.state === State.Playing ? 'pause' : 'play')}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button"
            accessibilityLabel={t('nextChapter')}
            accessibilityState={{ disabled: safeIndex >= chapters.length - 1 || loading }}
            disabled={safeIndex >= chapters.length - 1 || loading}
            style={styles.control}
            onPress={() => changeChapter(safeIndex + 1)}
          >
            <Text style={[styles.controlText, { color: colors.primary }]}>{t('nextChapter')}</Text>
          </Pressable>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('playbackSpeed')}</Text>
        <View style={styles.options}>
          {rates.map(value => (
            <Pressable accessibilityRole="radio"
              key={value}
              accessibilityState={{ selected: rate === value }}
              style={[styles.option, { backgroundColor: rate === value ? colors.primary : colors.surface }]}
              onPress={() => void changeRate(value)}
            >
              <Text
                style={
                  rate === value ? styles.optionTextActive : [styles.optionText, { color: colors.text }]
                }
              >
                {value}×
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.preferenceRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.preferenceText}>
            <Text style={{ color: colors.text }}>{t('mediaButtonPerNext')}</Text>
            <Text style={{ color: colors.muted }}>{t('mediaButtonPerNextSummary')}</Text>
          </View>
          <Switch
            accessibilityLabel={t('mediaButtonPerNext')}
            value={mediaButtonPerNext}
            onValueChange={changeMediaButtonMode}
            trackColor={{ true: colors.primary }}
          />
        </View>
        {book?.sourceType === 1 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('audioActions')}</Text>
            <View style={styles.options}>
              <Pressable accessibilityRole="button" style={[styles.option, { backgroundColor: colors.surface }]} onPress={() => void copyPlayUrl()}>
                <Text style={{ color: colors.text }}>{t('copyPlayUrl')}</Text>
              </Pressable>
              {activeSource?.customButton ? (
                // TODO(htyf-native): Source custom-button callbacks require the pinned QuickJS runtime documented in docs/htyf-migration-gaps.md.
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled style={[styles.option, styles.disabled, { backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.muted }}>{t('sourceCustomButtonUnavailable')}</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('audioCacheRange')}</Text>
            <View style={styles.rangeRow}>
              <TextInput accessibilityLabel={t('startChapter')} keyboardType="number-pad" value={cacheStart} onChangeText={setCacheStart} style={[styles.rangeInput, { color: colors.text, borderColor: colors.border }]} />
              <Text style={{ color: colors.muted }}>—</Text>
              <TextInput accessibilityLabel={t('endChapter')} keyboardType="number-pad" value={cacheEnd} onChangeText={setCacheEnd} style={[styles.rangeInput, { color: colors.text, borderColor: colors.border }]} />
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: caching }} disabled={caching} style={[styles.option, { backgroundColor: colors.primary }]} onPress={() => void cacheRange()}>
                <Text style={styles.optionTextActive}>{caching ? t('caching') : t('startCache')}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('sleepTimer')}{remaining ? t('sleepRemaining', { minutes: remaining }) : ''}
        </Text>
        <View style={styles.options}>
          {[0, 15, 30, 60].map(minutes => (
            <Pressable accessibilityRole="button"
              key={minutes}
              style={[styles.option, { backgroundColor: colors.surface }]}
              onPress={() => setSleep(minutes)}
            >
              <Text style={[styles.optionText, { color: colors.text }]}>
                {minutes ? t('minutes', { count: minutes }) : t('off')}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 22, alignItems: 'center', gap: 12, paddingBottom: 40 },
  preferenceRow: { width: '100%', minHeight: 56, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  preferenceText: { flex: 1, gap: 3 },
  cover: {
    width: 150,
    height: 190,
    marginTop: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  bookName: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  chapter: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: { textAlign: 'center', lineHeight: 20 },
  timeline: { width: '100%', marginTop: 8 },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  time: { fontVariant: ['tabular-nums'] },
  controls: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  control: {
    minWidth: 76,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: { fontWeight: '700' },
  play: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  sectionTitle: {
    alignSelf: 'flex-start',
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
  },
  options: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minWidth: 58,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {},
  optionTextActive: { color: '#fff', fontWeight: '700' },
  rangeRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeInput: { width: 64, minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, textAlign: 'center' },
});
