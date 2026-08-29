import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Book, LocalChapter } from '../types';
import { searchChapters, type ContentMatch } from '../core/contentSearch';
import { saveHighlight } from '../data/annotations';
import { InTreeSheet } from './InTreeSheet';
import { useAppTheme } from '../theme/AppTheme';
export function ContentSearchSheet({
  visible,
  book,
  chapters,
  onDismiss,
  onSelect,
}: {
  visible: boolean;
  book: Book;
  chapters: LocalChapter[];
  onDismiss: () => void;
  onSelect: (index: number) => void;
}) {
  const { colors, t } = useAppTheme();
  const [query, setQuery] = useState(''),
    [note, setNote] = useState(''),
    [message, setMessage] = useState(''),
    results = useMemo(() => searchChapters(chapters, query), [chapters, query]);
  const highlight = (item: ContentMatch) => {
    saveHighlight({
      id: `${book.id}:${item.chapterId}:${item.start}:${item.end}`,
      bookId: book.id,
      chapterId: item.chapterId,
      start: item.start,
      end: item.end,
      text: item.match,
      color: '#f2d35b',
      note: note.trim() || undefined,
      createdAt: Date.now(),
    });
    setMessage(t('highlightSaved'));
  };
  return (
    <InTreeSheet visible={visible} onDismiss={onDismiss}>
      <Text style={[s.title, { color: colors.text }]}>{t('contentSearchTitle')}</Text>
      <TextInput
        accessibilityLabel={t('searchBody')}
        value={query}
        onChangeText={value => {
          setQuery(value);
          setMessage('');
        }}
        placeholder={t('searchKeywordPlaceholder')}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        style={[s.input, { backgroundColor: colors.background, color: colors.text }]}
      />
      <TextInput
        accessibilityLabel={t('highlightNote')}
        value={note}
        onChangeText={setNote}
        placeholder={t('highlightNotePlaceholder')}
        placeholderTextColor={colors.muted}
        style={[s.input, { backgroundColor: colors.background, color: colors.text }]}
      />
      <Text accessibilityLiveRegion="polite" style={[s.meta, { color: colors.muted }]}>{message || t('searchResultCount', { count: results.length })}</Text>
      <ScrollView keyboardShouldPersistTaps="handled">
        {results.map(item => (
          <View key={`${item.chapterId}:${item.start}`} style={[s.result, { borderColor: colors.border }]}>
            <Text style={[s.chapter, { color: colors.text }]}>{item.chapterTitle}</Text>
            <Text style={[s.excerpt, { color: colors.text }]}>{item.excerpt}</Text>
            <View style={s.actions}>
              <Pressable accessibilityRole="button"
                style={s.button}
                onPress={() => {
                  onSelect(item.chapterIndex);
                  onDismiss();
                }}
              >
                <Text style={{ color: colors.text }}>{t('locate')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={[s.primary, { backgroundColor: colors.primary }]} onPress={() => highlight(item)}>
                <Text style={s.primaryText}>{t('highlight')}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </InTreeSheet>
  );
}
const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  input: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  meta: { marginBottom: 8 },
  result: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  chapter: { fontWeight: '700', fontSize: 16 },
  excerpt: { lineHeight: 22 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  button: {
    minWidth: 72,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    minWidth: 72,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
});
