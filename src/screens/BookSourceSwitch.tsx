import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PageHeader } from '../components/PageHeader';
import { applySourceSwitchCandidate, discoverSourceSwitchCandidates, SourceSwitchError } from '../core/bookSourceSwitch';
import { loadSources } from '../data/sources';
import type { Book, SearchBook } from '../types';
import { useAppTheme } from '../theme/AppTheme';

export function BookSourceSwitch({
  book,
  back,
  changed,
}: {
  book?: Book;
  back: () => void;
  changed: (book: Book) => void;
}) {
  const { colors, t } = useAppTheme();
  const [results, setResults] = useState<SearchBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState('');
  const [message, setMessage] = useState(() => t('searchingSourceCandidates'));
  useEffect(() => {
    setResults([]);
    setLoading(true);
    setMessage(t('searchingSourceCandidates'));
    if (!book) {
      setLoading(false);
      setMessage(t('bookRemoved'));
      return;
    }
    let active = true;
    void loadSources()
      .then(sources => discoverSourceSwitchCandidates(book, sources))
      .then(({ candidates, failedSources }) => {
        if (!active) return;
        setResults(candidates);
        setMessage(failedSources ? t('sourceCandidateSummaryFailed', { count: candidates.length, failed: failedSources }) : t('sourceCandidateSummary', { count: candidates.length }));
      })
      .catch(reason => {
        if (active)
          setMessage(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [book, t]);
  const select = async (candidate: SearchBook) => {
    if (!book || selecting) return;
    setSelecting(candidate.bookUrl);
    setMessage(t('switchingToSource', { name: candidate.originName }));
    try {
      changed(await applySourceSwitchCandidate(book, candidate, await loadSources()));
    } catch (reason) {
      setMessage(reason instanceof SourceSwitchError ? t(reason.code) : reason instanceof Error ? reason.message : String(reason));
      setSelecting('');
    }
  };
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('sourceSwitchTitle')} onBack={back} />
      <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.muted }]}>{message}</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : results.length ? (
        <ScrollView contentContainerStyle={styles.list}>
          {results.map((candidate, index) => (
            <Pressable accessibilityRole="button"
              accessibilityLabel={t('chooseSourceCandidate', { name: candidate.name, source: candidate.originName })}
              key={`${candidate.origin}:${candidate.bookUrl}:${index}`}
              disabled={!!selecting}
              style={[styles.item, { backgroundColor: colors.surface }]}
              onPress={() => void select(candidate)}
            >
              <View style={styles.itemText}>
                <Text style={[styles.name, { color: colors.text }]}>{candidate.name}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  {candidate.author || t('unknownAuthor')} · {candidate.originName}
                </Text>
                {candidate.latestChapterTitle ? (
                  <Text numberOfLines={1} style={[styles.meta, { color: colors.muted }]}>
                    {candidate.latestChapterTitle}
                  </Text>
                ) : null}
              </View>
              {selecting === candidate.bookUrl ? <ActivityIndicator color={colors.primary} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.text }]}>{t('noSourceCandidates')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  message: { paddingHorizontal: 16, paddingVertical: 10 },
  loading: { marginTop: 40 },
  list: { padding: 12, gap: 10 },
  item: {
    minHeight: 76,
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemText: { flex: 1, gap: 5 },
  name: { fontSize: 17, fontWeight: '700' },
  meta: {},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  empty: { fontSize: 17, fontWeight: '700' },
});
