import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PageHeader } from '../components/PageHeader';
import { BookCover } from '../components/BookCover';
import { CollapsibleBookIntro } from '../components/CollapsibleBookIntro';
import { InTreeSheet } from '../components/InTreeSheet';
import { toLibraryBook } from '../core/onlineLibrary';
import { bookMetadataLabels } from '../core/bookMetadataLabels';
import { loadBookInfo, loadChapters } from '../core/webBook';
import { loadSources } from '../data/sources';
import { loadTxtTocRules } from '../data/txtTocRules';
import {
  describeWebFiles,
  prepareWebFile,
  type PreparedWebFile,
  type WebFileChoice,
} from '../core/webFileImport';
import type { Book, BookChapter, BookSource, SearchBook } from '../types';
import { useAppTheme } from '../theme/AppTheme';

export function OnlineBookDetail({
  initialBook,
  back,
  added,
  search,
}: {
  initialBook: SearchBook;
  back: () => void;
  added: (book: Book, readAfterImport?: boolean) => void;
  search: (sourceUrl: string, query: string) => void;
}) {
  const { colors, t } = useAppTheme();
  const [book, setBook] = useState(initialBook);
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [source, setSource] = useState<BookSource>();
  const [prepared, setPrepared] = useState<PreparedWebFile>();
  const [choices, setChoices] = useState<WebFileChoice[]>([]);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [readAfterImport, setReadAfterImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState('');
  const mounted = useRef(false);
  const choiceWanted = useRef(false);
  const pendingFile = useRef<PreparedWebFile | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pendingFile.current) void pendingFile.current.dispose();
      pendingFile.current = undefined;
    };
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void loadSources()
      .then(sources => {
        const source = sources.find(
          x => x.bookSourceUrl === initialBook.origin,
        );
        if (!source) throw new Error(t('sourceMissing'));
        return loadBookInfo(source, initialBook, controller.signal).then(
          async info =>
            source.bookSourceType === 3
              ? {
                  info,
                  items: [] as BookChapter[],
                  source,
                  files: await describeWebFiles(
                    source,
                    info,
                    info.downloadUrls ?? [],
                    controller.signal,
                  ),
                }
              : {
                  info,
                  items: await loadChapters(source, info, controller.signal),
                  source,
                  files: [] as WebFileChoice[],
                },
        );
      })
      .then(({ info, items, source: loadedSource, files }) => {
        if (!active) return;
        setBook(info);
        setChapters(items);
        setSource(loadedSource);
        setChoices(files);
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
      controller.abort();
    };
  }, [initialBook, retry, t]);
  const importFile = async (
    selection: PreparedWebFile,
    file: PreparedWebFile['files'][number],
  ) => {
    if (pendingFile.current === selection) pendingFile.current = undefined;
    setBusy(true);
    setFileError('');
    try {
      const imported = await selection.importFile(file, loadTxtTocRules());
      if (mounted.current) added(imported, readAfterImport);
    } catch (reason) {
      if (mounted.current)
        setFileError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      await selection.dispose();
      if (pendingFile.current === selection) pendingFile.current = undefined;
      if (mounted.current) {
        setPrepared(undefined);
        setBusy(false);
      }
    }
  };
  const download = async (value: string) => {
    if (!source || busy) return;
    setBusy(true);
    setFileError('');
    try {
      const result = await prepareWebFile(source, book, value);
      if (!mounted.current || !choiceWanted.current) {
        await result.dispose();
        return;
      }
      pendingFile.current = result;
      if (result.files.length === 1) {
        choiceWanted.current = false;
        setChoiceOpen(false);
        await importFile(result, result.files[0]);
      } else setPrepared(result);
    } catch (reason) {
      if (mounted.current)
        setFileError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const dismissChoice = () => {
    choiceWanted.current = false;
    setChoiceOpen(false);
    if (pendingFile.current) {
      void pendingFile.current.dispose();
      pendingFile.current = undefined;
      setPrepared(undefined);
    }
  };
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
          <Text
            accessibilityRole="alert"
            style={[styles.error, { color: colors.danger }]}
          >
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: colors.primary }]}
            onPress={() => setRetry(x => x + 1)}
          >
            <Text style={styles.primaryText}>{t('retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <BookCover
              name={book.name}
              author={book.author}
              book={{ origin: book.origin, coverUrl: book.coverUrl }}
              height={160}
              style={styles.cover}
            />
            <Text style={[styles.name, { color: colors.text }]}>
              {book.name}
            </Text>
            <View style={styles.labels}>
              {bookMetadataLabels(book).map((label, index) => (
                <Pressable
                  key={`${index}:${label}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('onlineSearchLabel', { label })}
                  onPress={() => search(book.origin, label)}
                  style={[styles.label, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.muted }}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: colors.muted }}>
              {t('onlineAuthor', { author: book.author || t('unknownAuthor') })}
            </Text>
            <Text style={{ color: colors.muted }}>
              {t('onlineOrigin', { source: book.originName })}
            </Text>
            {book.latestChapterTitle ? (
              <Text style={{ color: colors.muted }} numberOfLines={1}>
                {t('onlineLatest', { chapter: book.latestChapterTitle })}
              </Text>
            ) : null}
            {source?.bookSourceType !== 3 ? (
              <Text style={[styles.heading, { color: colors.text }]}>
                {t('chapterCount', { count: chapters.length })}
              </Text>
            ) : null}
            {book.intro?.trim() ? (
              <>
                <Text style={[styles.heading, { color: colors.text }]}>
                  {t('introduction')}
                </Text>
                <CollapsibleBookIntro text={book.intro} style={[styles.body, { color: colors.text }]} />
              </>
            ) : null}
            {chapters.slice(0, 50).map(chapter => (
              <Text
                key={`${chapter.index}:${chapter.url}`}
                style={[
                  styles.chapter,
                  { color: colors.text, borderBottomColor: colors.border },
                ]}
              >
                {chapter.title}
              </Text>
            ))}
            {chapters.length > 50 ? (
              <Text style={{ color: colors.muted }}>
                {t('remainingChaptersSaved')}
              </Text>
            ) : null}
            {source?.bookSourceType === 3 ? (
              <>
                {fileError ? (
                  <Text
                    accessibilityRole="alert"
                    style={{ color: colors.danger }}
                  >
                    {fileError}
                  </Text>
                ) : null}
                {busy ? <ActivityIndicator /> : null}
              </>
            ) : null}
          </ScrollView>
          {source?.bookSourceType !== 3 ? (
            <Pressable
              accessibilityRole="button"
              disabled={!chapters.length}
              accessibilityState={{ disabled: !chapters.length }}
              style={[
                styles.primary,
                { backgroundColor: colors.primary },
                !chapters.length && styles.disabled,
              ]}
              onPress={() => added(toLibraryBook(book, chapters), true)}
            >
              <Text style={styles.primaryText}>
                {chapters.length ? t('addAndRead') : t('noChaptersToAdd')}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.fileActions}>
              <Pressable
                accessibilityRole="button"
                disabled={busy || !choices.length}
                accessibilityState={{ disabled: busy || !choices.length }}
                style={[
                  styles.fileAction,
                  { borderColor: colors.primary },
                  (busy || !choices.length) && styles.disabled,
                ]}
                onPress={() => {
                  setReadAfterImport(false);
                  choiceWanted.current = true;
                  setChoiceOpen(true);
                }}
              >
                <Text style={{ color: colors.primary }}>
                  {t('webFileAddToShelf')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy || !choices.length}
                accessibilityState={{ disabled: busy || !choices.length }}
                style={[
                  styles.fileAction,
                  { backgroundColor: colors.primary },
                  (busy || !choices.length) && styles.disabled,
                ]}
                onPress={() => {
                  setReadAfterImport(true);
                  choiceWanted.current = true;
                  setChoiceOpen(true);
                }}
              >
                <Text style={styles.primaryText}>{t('startReading')}</Text>
              </Pressable>
            </View>
          )}
          <InTreeSheet visible={choiceOpen} onDismiss={dismissChoice}>
            <Text style={[styles.heading, { color: colors.text }]}>
              {t(prepared ? 'webFileChoose' : 'webFileDownloads')}
            </Text>
            {fileError ? (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {fileError}
              </Text>
            ) : null}
            {busy ? (
              <ActivityIndicator />
            ) : prepared ? (
              prepared.files.map(file => (
                <Pressable
                  key={file.relative}
                  accessibilityRole="button"
                  style={[styles.chapter, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    choiceWanted.current = false;
                    setChoiceOpen(false);
                    void importFile(prepared, file);
                  }}
                >
                  <Text style={{ color: colors.text }}>{file.relative}</Text>
                </Pressable>
              ))
            ) : (
              choices.map((file, index) => (
                <Pressable
                  key={`${index}:${file.url}`}
                  accessibilityRole="button"
                  style={[styles.chapter, { borderBottomColor: colors.border }]}
                  onPress={() => void download(file.url)}
                >
                  <Text style={{ color: colors.text }}>{file.name}</Text>
                </Pressable>
              ))
            )}
          </InTreeSheet>
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
  cover: { width: 110, alignSelf: 'center', marginTop: 8, borderRadius: 5 },
  name: { fontSize: 18, textAlign: 'center', marginTop: 8 },
  labels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
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
  fileActions: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    gap: 12,
  },
  fileAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
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
