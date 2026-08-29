import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { InTreeSheet } from '../components/InTreeSheet';
import { PageHeader } from '../components/PageHeader';
import {
  rssDebugSuggestions,
  runRssSourceDebug,
  type RssDebugEvent,
} from '../core/rssDebug';
import { loadRssSources } from '../data/rss';
import type { RssSource } from '../types';
import { useAppTheme } from '../theme/AppTheme';

export function RssSourceDebug({
  sourceUrl,
  back,
}: {
  sourceUrl: string;
  back: () => void;
}) {
  const { colors, t } = useAppTheme();
  const [source, setSource] = useState<RssSource>(),
    [input, setInput] = useState(''),
    [events, setEvents] = useState<RssDebugEvent[]>([]),
    [running, setRunning] = useState(false),
    [error, setError] = useState(''),
    [listSource, setListSource] = useState(''),
    [contentSource, setContentSource] = useState(''),
    [raw, setRaw] = useState<{ title: string; body: string }>();
  useEffect(() => {
    const found = loadRssSources().find(item => item.sourceUrl === sourceUrl);
    if (found) setSource(found);
    else setError(t('rssSourceDeleted'));
  }, [sourceUrl, t]);
  const start = async () => {
    if (!source || !input.trim() || running) return;
    setEvents([]);
    setError('');
    setListSource('');
    setContentSource('');
    setRunning(true);
    try {
      const result = await runRssSourceDebug(source, input, event =>
        setEvents(current => [...current, event]),
      );
      setListSource(result.listSource);
      setContentSource(result.contentSource);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRunning(false);
    }
  };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('rssSourceDebugTitle')}
        onBack={back}
        action={
          listSource || contentSource ? (
            <View style={s.headerActions}>
              {listSource ? (
                <Pressable
                  accessibilityRole="button"
                  style={s.headerButton}
                  onPress={() =>
                    setRaw({ title: t('rssListSource'), body: listSource })
                  }
                >
                  <Text style={{ color: colors.primary }}>
                    {t('rssListShort')}
                  </Text>
                </Pressable>
              ) : null}
              {contentSource ? (
                <Pressable
                  accessibilityRole="button"
                  style={s.headerButton}
                  onPress={() =>
                    setRaw({
                      title: t('rssContentSource'),
                      body: contentSource,
                    })
                  }
                >
                  <Text style={{ color: colors.primary }}>
                    {t('rssContentShort')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : undefined
        }
      />
      <View style={[s.form, { borderColor: colors.border }]}>
        <Text style={[s.sourceName, { color: colors.text }]}>
          {source?.sourceName ?? t('loadingSource')}
        </Text>
        {source ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.suggestions}
          >
            {rssDebugSuggestions(source).map(item => (
              <Pressable
                accessibilityRole="button"
                key={item.value}
                style={[s.chip, { backgroundColor: colors.surface }]}
                onPress={() => setInput(item.value)}
              >
                <Text style={{ color: colors.text }}>{item.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <View style={s.row}>
          <TextInput
            accessibilityLabel={t('rssDebugInput')}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => void start()}
            editable={!running}
            placeholder={t('rssDebugInputHint')}
            placeholderTextColor={colors.muted}
            style={[
              s.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!source || !input.trim() || running}
            style={[
              s.run,
              { backgroundColor: colors.primary },
              (!source || !input.trim() || running) && s.disabled,
            ]}
            onPress={() => void start()}
          >
            <Text style={s.runText}>{running ? t('running') : t('start')}</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.logs}>
        {events.map((event, index) => (
          <View
            key={`${event.stage}:${index}`}
            style={[s.event, { backgroundColor: colors.surface }]}
          >
            <Text
              style={[
                s.badge,
                {
                  backgroundColor:
                    event.status === 'success'
                      ? colors.primary
                      : event.status === 'error'
                        ? colors.danger
                        : colors.muted,
                },
              ]}
            >
              {t(`rssDebugStage_${event.stage}`)}
            </Text>
            <Text selectable style={[s.eventText, { color: colors.text }]}>
              {event.message}
            </Text>
          </View>
        ))}
        {running ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {error}
          </Text>
        ) : null}
        {!events.length && !error ? (
          <Text style={[s.help, { color: colors.muted }]}>
            {t('rssDebugHelp')}
          </Text>
        ) : null}
      </ScrollView>
      <InTreeSheet visible={!!raw} onDismiss={() => setRaw(undefined)}>
        <Text style={[s.rawTitle, { color: colors.text }]}>{raw?.title}</Text>
        <ScrollView style={s.rawScroll}>
          <Text selectable style={[s.rawText, { color: colors.text }]}>
            {raw?.body}
          </Text>
        </ScrollView>
      </InTreeSheet>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row' },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { padding: 16, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  sourceName: { fontSize: 17, fontWeight: '700' },
  suggestions: { gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  run: {
    minWidth: 72,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  runText: { color: '#fff', fontWeight: '700' },
  logs: { padding: 16, gap: 10 },
  event: { padding: 12, borderRadius: 10, gap: 7 },
  badge: {
    alignSelf: 'flex-start',
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    overflow: 'hidden',
  },
  eventText: { lineHeight: 20 },
  help: { textAlign: 'center', marginTop: 40, lineHeight: 22 },
  rawTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  rawScroll: { maxHeight: 480 },
  rawText: { fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
});
