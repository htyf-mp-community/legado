import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PageHeader } from '../components/PageHeader';
import { useAppTheme } from '../theme/AppTheme';
import type { Book } from '../types';
import { importSupportedBook } from '../core/localBookImport';
import { reSegmentText, TXT_CHARSETS } from '../core/txtEncoding';
import { loadTxtTocRules } from '../data/txtTocRules';
import { editableBookCover, editBookCover } from '../core/bookCover';
import { displayBookIntro, editBookIntro } from '../core/bookMetadata';

export function BookEditor({
  book,
  back,
  saved,
}: {
  book?: Book;
  back: () => void;
  saved: (book: Book) => void;
}) {
  const { colors, t } = useAppTheme();
  const [name, setName] = useState(book?.name ?? ''),
    [author, setAuthor] = useState(book?.author ?? ''),
    [coverUrl, setCoverUrl] = useState(
      book ? (editableBookCover(book) ?? '') : '',
    ),
    [intro, setIntro] = useState(book ? displayBookIntro(book) : ''),
    [sourceType, setSourceType] = useState(book?.sourceType ?? 0),
    [chapterIndex, setChapterIndex] = useState(0),
    [chapters, setChapters] = useState(() => book?.chapters ?? []),
    [charset, setCharset] = useState(book?.charset ?? 'UTF-8'),
    [running, setRunning] = useState(false),
    [error, setError] = useState(''),
    chapter = chapters[chapterIndex],
    types = useMemo(
      () =>
        [
          [0, t('textBook')],
          [1, t('audioBook')],
          [2, t('imageBook')],
          [4, t('videoBookType')],
        ] as const,
      [t],
    );
  const commit = () => {
    if (!book) return;
    if (!name.trim()) {
      setError(t('bookNameRequired'));
      return;
    }
    saved({
      ...editBookIntro(editBookCover(book, coverUrl), intro),
      name: name.trim(),
      author: author.trim(),
      sourceType,
      charset,
      chapters,
      chapterTitle:
        chapters[book.currentChapterIndex ?? 0]?.title ?? book.chapterTitle,
      content: chapters[book.currentChapterIndex ?? 0]?.content ?? book.content,
      updatedAt: Date.now(),
    });
  };
  const reloadCharset = async (nextCharset: string) => {
    setCharset(nextCharset);
    if (!book?.localUri || !/\.txt(?:$|[?#])/i.test(book.localUri)) return;
    setRunning(true);
    setError('');
    try {
      const imported = await importSupportedBook(
        book.localUri,
        book.originName ?? `${book.name}.txt`,
        loadTxtTocRules(),
        nextCharset,
      );
      setChapters(imported.chapters ?? []);
      setChapterIndex(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  };
  if (!book)
    return (
      <View style={[s.flex, { backgroundColor: colors.background }]}>
        <PageHeader title={t('editBook')} onBack={back} />
        <Text style={[s.empty, { color: colors.muted }]}>
          {t('bookRemoved')}
        </Text>
      </View>
    );
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('editBook')}
        onBack={back}
        action={
          <Pressable accessibilityRole="button" style={s.save} onPress={commit}>
            <Text style={{ color: colors.primary }}>{t('save')}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={s.form}>
        <Field label={t('bookName')} value={name} setValue={setName} />
        <Field label={t('author')} value={author} setValue={setAuthor} />
        <Text style={[s.label, { color: colors.muted }]}>{t('bookType')}</Text>
        <View style={s.typeRow}>
          {types.map(([value, label]) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: sourceType === value }}
              key={value}
              style={[s.type, sourceType === value && s.typeActive]}
              onPress={() => setSourceType(value)}
            >
              <Text
                style={{ color: sourceType === value ? '#fff' : colors.text }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field label={t('coverUrl')} value={coverUrl} setValue={setCoverUrl} />
        <Field
          label={t('introduction')}
          value={intro}
          setValue={setIntro}
          multiline
        />
        {book.localUri && /\.txt(?:$|[?#])/i.test(book.localUri) ? (
          <>
            <Text style={[s.label, { color: colors.muted }]}>
              {t('txtCharset')}
            </Text>
            <View style={s.typeRow}>
              {TXT_CHARSETS.map(value => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: charset === value,
                    disabled: running,
                  }}
                  disabled={running}
                  key={value}
                  style={[s.type, charset === value && s.typeActive]}
                  onPress={() => void reloadCharset(value)}
                >
                  <Text
                    style={{ color: charset === value ? '#fff' : colors.text }}
                  >
                    {value}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        {chapters.length ? (
          <>
            <Text style={[s.label, { color: colors.muted }]}>
              {t('manualChapterContent')}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={[s.reSegment, { borderColor: colors.border }]}
              onPress={() =>
                setChapters(old =>
                  old.map(item => ({
                    ...item,
                    content: reSegmentText(item.content, item.title),
                  })),
                )
              }
            >
              <Text style={{ color: colors.primary }}>
                {t('reSegmentAllChapters')}
              </Text>
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {chapters.map((item, index) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: chapterIndex === index }}
                  key={item.id}
                  style={[s.chapter, chapterIndex === index && s.typeActive]}
                  onPress={() => setChapterIndex(index)}
                >
                  <Text
                    style={{
                      color: chapterIndex === index ? '#fff' : colors.text,
                    }}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              accessibilityLabel={t('chapterTitle')}
              value={chapter?.title ?? ''}
              onChangeText={value =>
                setChapters(old =>
                  old.map((item, index) =>
                    index === chapterIndex ? { ...item, title: value } : item,
                  ),
                )
              }
              style={[
                s.input,
                { color: colors.text, borderColor: colors.border },
              ]}
            />
            <TextInput
              accessibilityLabel={t('chapterContent')}
              multiline
              value={chapter?.content ?? ''}
              onChangeText={value =>
                setChapters(old =>
                  old.map((item, index) =>
                    index === chapterIndex ? { ...item, content: value } : item,
                  ),
                )
              }
              style={[
                s.input,
                s.content,
                { color: colors.text, borderColor: colors.border },
              ]}
            />
          </>
        ) : null}
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  setValue,
  multiline = false,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  multiline?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: colors.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        multiline={multiline}
        value={value}
        onChangeText={setValue}
        style={[
          s.input,
          multiline && s.multiline,
          { color: colors.text, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  form: { padding: 20, paddingBottom: 40, gap: 12 },
  save: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: 6 },
  label: { fontSize: 13 },
  input: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  multiline: { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' },
  content: { minHeight: 260, paddingTop: 12, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  type: {
    minHeight: 44,
    minWidth: 70,
    paddingHorizontal: 12,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ddd',
  },
  typeActive: { backgroundColor: '#285d42' },
  chapter: {
    minHeight: 44,
    maxWidth: 180,
    paddingHorizontal: 14,
    marginRight: 8,
    borderRadius: 22,
    justifyContent: 'center',
    backgroundColor: '#ddd',
  },
  reSegment: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { padding: 24 },
});
