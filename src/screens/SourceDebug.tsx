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
import { PageHeader } from '../components/PageHeader';
import { runSourceDebug, SourceDebugPipelineError, type SourceDebugEvent } from '../core/sourceDebug';
import { loadSources } from '../data/sources';
import type { BookSource } from '../types';
import { useAppTheme } from '../theme/AppTheme';

export function SourceDebug({
  sourceUrl,
  back,
}: {
  sourceUrl: string;
  back: () => void;
}) {
  const { colors, t } = useAppTheme();
  const [source, setSource] = useState<BookSource>();
  const [keyword, setKeyword] = useState('');
  const [events, setEvents] = useState<SourceDebugEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void loadSources()
      .then(sources => {
        const found = sources.find(item => item.bookSourceUrl === sourceUrl);
        if (!found) throw new Error(t('sourceDeleted'));
        if (active) setSource(found);
      })
      .catch(reason => {
        if (active)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [sourceUrl, t]);
  const start = async () => {
    const key = keyword.trim();
    if (!source || !key || running) return;
    setEvents([]);
    setError('');
    setRunning(true);
    try {
      await runSourceDebug(source, key, event =>
        setEvents(current => {
          const next = current.filter(item => item.stage !== event.stage);
          return [...next, event];
        }),
        (messageKey, values) => t(messageKey, values),
      );
    } catch (reason) {
      setError(reason instanceof SourceDebugPipelineError ? t(reason.code) : reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRunning(false);
    }
  };
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('sourceDebugTitle')} onBack={back} />
      <View style={[styles.form, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sourceName, { color: colors.text }]}>
          {source?.bookSourceName ?? t('loadingSource')}
        </Text>
        <View style={styles.row}>
          <TextInput
            accessibilityLabel={t('debugKeyword')}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={() => void start()}
            editable={!running}
            returnKeyType="search"
            placeholder={t('debugKeywordPlaceholder')}
            placeholderTextColor={colors.muted}
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
          />
          <Pressable accessibilityRole="button"
            accessibilityLabel={t('startSourceDebug')}
            disabled={!source || !keyword.trim() || running}
            style={[
              styles.run,
              { backgroundColor: colors.primary },
              (!source || !keyword.trim() || running) && styles.disabled,
            ]}
            onPress={() => void start()}
          >
            <Text style={styles.runText}>{running ? t('running') : t('start')}</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.logs}>
        {events.map(event => (
          <View key={event.stage} style={[styles.log, { backgroundColor: colors.surface }]}>
            <Text
              style={[
                styles.badge,
                event.status === 'success'
                  ? { backgroundColor: colors.primary }
                  : event.status === 'error'
                    ? { backgroundColor: colors.danger }
                    : { backgroundColor: colors.muted },
              ]}
            >
              {event.stage.toUpperCase()}
            </Text>
            <Text style={[styles.message, { color: colors.text }]}>{event.message}</Text>
          </View>
        ))}
        {running ? <ActivityIndicator color={colors.primary} style={styles.indicator} /> : null}
        {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {!events.length && !error ? (
          <Text style={[styles.empty, { color: colors.muted }]}>{t('debugHelp')}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: {
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sourceName: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
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
  logs: { padding: 16, gap: 12 },
  log: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f4f4f4',
  },
  badge: {
    width: 74,
    paddingVertical: 5,
    borderRadius: 5,
    overflow: 'hidden',
    textAlign: 'center',
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  message: { flex: 1, lineHeight: 20 },
  indicator: { marginTop: 12 },
  error: { lineHeight: 21 },
  empty: { textAlign: 'center', marginTop: 40, lineHeight: 22 },
});
