import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Svg, { Path } from 'react-native-svg';
import { InTreeSheet } from './InTreeSheet';
import {
  loadHttpTts,
  loadReadAloudPreferences,
  saveReadAloudPreferences,
} from '../data/httpTts';
import { readAloudParagraphs } from '../core/httpTts';
import { ReadAloudController, type ReadAloudState } from '../core/readAloud';
import { createHttpTtsDriver } from '../services/httpTtsAudio';
import { useAppTheme } from '../theme/AppTheme';

/** Foreground HTTP speech controls. Closing the sheet retains speech; leaving the reader releases it. */
export function ReadAloudSheet({
  visible,
  focused,
  onDismiss,
  content,
  chapterTitle,
  previousChapter,
  nextChapter,
  openEngines,
}: {
  visible: boolean;
  focused: boolean;
  onDismiss: () => void;
  content: string;
  chapterTitle: string;
  previousChapter?: () => void;
  nextChapter?: () => void;
  openEngines: () => void;
}) {
  const { colors, t } = useAppTheme();
  const [preferences, setPreferences] = useState(loadReadAloudPreferences),
    [engines, setEngines] = useState(loadHttpTts);
  const [requested, setRequested] = useState(false),
    [startIndex, setStartIndex] = useState(0);
  const [state, setState] = useState<ReadAloudState>({
    status: 'idle',
    paragraph: 0,
  });
  const [deadline, setDeadline] = useState(0),
    [remaining, setRemaining] = useState(0);
  const controller = useRef<ReadAloudController | undefined>(undefined),
    completion = useRef(nextChapter);
  completion.current = nextChapter;
  const paragraphs = useMemo(() => readAloudParagraphs(content), [content]);
  const engine = engines.find(item => item.id === preferences.engineId);
  const wasActive = useRef(false);
  useEffect(() => {
    if (visible) {
      setPreferences(loadReadAloudPreferences());
      const next = loadHttpTts();
      setEngines(previous =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    }
  }, [visible]);
  useEffect(() => {
    setStartIndex(0);
  }, [content]);
  useEffect(() => {
    if (!requested || !engine || !focused || !paragraphs.length) return;
    let active = true;
    // HttpReadAloudService passes AppConfig.speechRatePlay + 5, not the slider's raw 0…45.
    const session = new ReadAloudController(
      createHttpTtsDriver(engine, preferences.speechRate + 5, chapterTitle),
      next => {
        if (!active) return;
        setState(next);
        if (next.status === 'ended') {
          if (completion.current) completion.current();
          else setRequested(false);
        }
        if (next.status === 'error') setRequested(false);
      },
    );
    controller.current = session;
    wasActive.current = true;
    void session.start(paragraphs, startIndex, engine.pauseDuration);
    return () => {
      active = false;
      controller.current = undefined;
      void session.stop().catch(error => {
        if (focused)
          setState({ status: 'error', paragraph: 0, error: String(error) });
      });
    };
  }, [
    requested,
    engine,
    preferences.speechRate,
    chapterTitle,
    paragraphs,
    startIndex,
    focused,
  ]);
  useEffect(() => {
    if (!focused) {
      setRequested(false);
      setDeadline(0);
    }
  }, [focused]);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 60_000)));
      if (Date.now() >= deadline) {
        setRequested(false);
        setDeadline(0);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const start = () => {
    if (!engine || !paragraphs.length) return;
    if (preferences.timerMinutes && !deadline)
      setDeadline(Date.now() + preferences.timerMinutes * 60_000);
    setRequested(true);
  };
  const stop = () => {
    setRequested(false);
    setDeadline(0);
    setState(previous => ({ ...previous, status: 'idle', error: undefined }));
  };
  const action = (
    label: string,
    callback: (() => void) | undefined,
    path?: string,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!callback}
      accessibilityState={{ disabled: !callback }}
      onPress={callback}
      style={({ pressed }) => [
        s.action,
        {
          borderColor: colors.border,
          opacity: !callback || pressed ? 0.45 : 1,
        },
      ]}
    >
      {path ? (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d={path} fill={colors.primary} />
        </Svg>
      ) : null}
      <Text style={{ color: colors.primary }}>{label}</Text>
    </Pressable>
  );
  const paused = state.status === 'paused',
    running = requested && !['ended', 'error'].includes(state.status);
  return (
    <InTreeSheet visible={visible} onDismiss={onDismiss}>
      <Text
        accessibilityRole="header"
        style={[s.title, { color: colors.text }]}
      >
        {t('readAloud')}
      </Text>
      <Text style={{ color: colors.text }}>{chapterTitle}</Text>
      <Text style={[s.note, { color: colors.muted }]}>
        {engine
          ? t('httpTtsSelected', { name: engine.name })
          : t('httpTtsNeedEngine')}
      </Text>
      <Text style={{ color: colors.text }}>
        {t('readAloudParagraph', {
          current: paragraphs.length ? state.paragraph + 1 : 0,
          total: paragraphs.length,
        })}
      </Text>
      {state.status === 'loading' ? (
        <View style={s.row}>
          <ActivityIndicator />
          <Text style={{ color: colors.muted }}>{t('readAloudLoading')}</Text>
        </View>
      ) : null}
      {state.error ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
          {state.error}
        </Text>
      ) : null}
      {!paragraphs.length ? (
        <Text style={{ color: colors.muted }}>{t('readAloudNoText')}</Text>
      ) : null}
      {state.status === 'ended' ? (
        <Text style={{ color: colors.text }}>{t('readAloudComplete')}</Text>
      ) : null}
      <View style={s.row}>
        {action(
          t('readAloudPrevParagraph'),
          state.paragraph > 0
            ? () => {
                setStartIndex(state.paragraph - 1);
                start();
              }
            : undefined,
        )}
        {running
          ? action(
              t(paused ? 'readAloudResume' : 'readAloudPause'),
              () => {
                void (
                  paused
                    ? controller.current?.resume()
                    : controller.current?.pause()
                )?.catch(error =>
                  setState({ ...state, status: 'error', error: String(error) }),
                );
              },
              paused ? 'M8 5v14l11-7z' : 'M6 5h4v14H6zm8 0h4v14h-4z',
            )
          : action(
              t('readAloudPlay'),
              engine && paragraphs.length ? start : undefined,
              'M8 5v14l11-7z',
            )}
        {action(
          t('readAloudNextParagraph'),
          state.paragraph < paragraphs.length - 1
            ? () => {
                setStartIndex(state.paragraph + 1);
                start();
              }
            : undefined,
        )}
        {action(
          t('readAloudStop'),
          wasActive.current ? stop : undefined,
          'M6 6h12v12H6z',
        )}
      </View>
      <View style={s.row}>
        {action(t('previousChapter'), previousChapter)}
        {action(t('nextChapter'), nextChapter)}
      </View>
      <Text style={[s.note, { color: colors.text }]}>
        {t('readAloudSpeed')} {((preferences.speechRate + 5) / 10).toFixed(1)}
      </Text>
      <Slider
        accessibilityLabel={t('readAloudSpeed')}
        minimumValue={0}
        maximumValue={45}
        step={1}
        value={preferences.speechRate}
        minimumTrackTintColor={colors.primary}
        onSlidingComplete={speechRate =>
          setPreferences(saveReadAloudPreferences({ speechRate }))
        }
      />
      <Text style={[s.note, { color: colors.text }]}>
        {t('readAloudTimer')}：
        {preferences.timerMinutes || t('readAloudNoTimer')}
      </Text>
      <Slider
        accessibilityLabel={t('readAloudTimer')}
        minimumValue={0}
        maximumValue={180}
        step={1}
        value={preferences.timerMinutes}
        minimumTrackTintColor={colors.primary}
        onSlidingComplete={timerMinutes => {
          setPreferences(saveReadAloudPreferences({ timerMinutes }));
          setDeadline(
            timerMinutes && requested ? Date.now() + timerMinutes * 60_000 : 0,
          );
        }}
      />
      {deadline ? (
        <Text style={{ color: colors.muted }}>
          {t('readAloudTimerRemaining', { minutes: remaining })}
        </Text>
      ) : null}
      {action(t('readAloudEngineSettings'), () => {
        stop();
        onDismiss();
        openEngines();
      })}
      <Text style={[s.note, { color: colors.muted }]}>
        {t('httpTtsUnavailable')}
      </Text>
    </InTreeSheet>
  );
}
const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  note: { marginVertical: 12, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  action: {
    minHeight: 48,
    minWidth: 48,
    padding: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
