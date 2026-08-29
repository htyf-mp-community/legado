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
import { toLibraryBook } from '../core/onlineLibrary';
import { loadBookInfo, loadChapters } from '../core/webBook';
import { loadSources } from '../data/sources';
import type { Book, BookChapter, SearchBook } from '../types';
import { useAppTheme } from '../theme/AppTheme';

export function OnlineBookDetail({
  initialBook,
  back,
  added,
}: {
  initialBook: SearchBook;
  back: () => void;
  added: (book: Book) => void;
}) {
  const { colors, t } = useAppTheme();
  const [book, setBook] = useState(initialBook);
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void loadSources()
      .then(sources => {
        const source = sources.find(
          x => x.bookSourceUrl === initialBook.origin,
        );
        if (!source) throw new Error(t('sourceMissing'));
        return loadBookInfo(source, initialBook).then(info =>
          loadChapters(source, info).then(items => ({ info, items })),
        );
      })
      .then(({ info, items }) => {
        if (!active) return;
        setBook(info);
        setChapters(items);
      })
      .catch(reason => {
        if (active)
          setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialBook, retry, t]);
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('onlineBook')} onBack={back} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ color: colors.muted }}>{t('loadingOnlineBook')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text>
          <Pressable accessibilityRole="button" style={[styles.retry, { backgroundColor: colors.primary }]} onPress={() => setRetry(x => x + 1)}>
            <Text style={styles.primaryText}>{t('retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.name, { color: colors.text }]}>{book.name}</Text>
            <Text style={{ color: colors.muted }}>
              {book.author || t('unknownAuthor')} · {book.originName}
            </Text>
            <Text style={[styles.heading, { color: colors.text }]}>{t('introduction')}</Text>
            <Text style={[styles.body, { color: colors.text }]}>{book.intro || t('noIntroduction')}</Text>
            <Text style={[styles.heading, { color: colors.text }]}>{t('chapterCount', { count: chapters.length })}</Text>
            {chapters.slice(0, 50).map(chapter => (
              <Text
                key={`${chapter.index}:${chapter.url}`}
                style={[styles.chapter, { color: colors.text, borderBottomColor: colors.border }]}
              >
                {chapter.title}
              </Text>
            ))}
            {chapters.length > 50 ? (
              <Text style={{ color: colors.muted }}>{t('remainingChaptersSaved')}</Text>
            ) : null}
          </ScrollView>
          <Pressable accessibilityRole="button"
            disabled={!chapters.length}
            accessibilityState={{ disabled: !chapters.length }}
            style={[styles.primary, { backgroundColor: colors.primary }, !chapters.length && styles.disabled]}
            onPress={() => added(toLibraryBook(book, chapters))}
          >
            <Text style={styles.primaryText}>
              {chapters.length ? t('addAndRead') : t('noChaptersToAdd')}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  content: { padding: 20, gap: 10, paddingBottom: 100 },
  name: { fontSize: 24, fontWeight: '800' },
  error: { textAlign: 'center' },
  heading: { marginTop: 14, fontSize: 17, fontWeight: '700' },
  body: { lineHeight: 22 },
  chapter: {
    minHeight: 44,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  primary: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retry: {
    minHeight: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  primaryText: { color: '#fff', fontWeight: '700' },
});
