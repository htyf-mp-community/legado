import { useState } from 'react';
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
import { addBooksByUrls, type AddBookUrlResult } from '../core/addBookByUrl';
import { loadSources } from '../data/sources';
import { useAppTheme } from '../theme/AppTheme';
import type { Book } from '../types';

export function AddBookByUrl({
  back,
  books,
  completed,
}: {
  back: () => void;
  books: Book[];
  completed: (books: Book[]) => void;
}) {
  const { colors, t } = useAppTheme();
  const [value, setValue] = useState(''),
    [running, setRunning] = useState(false),
    [results, setResults] = useState<AddBookUrlResult[]>([]),
    add = async () => {
      if (!value.trim()) {
        setResults([{ url: '', status: 'failed', error: t('noBookUrls') }]);
        return;
      }
      setRunning(true);
      try {
        const result = await addBooksByUrls(value, await loadSources(), books);
        setResults(result.results);
        if (result.results.some(item => item.status === 'added'))
          completed(result.books);
      } finally {
        setRunning(false);
      }
    };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('addBookByUrl')} onBack={back} />
      <View style={s.form}>
        <Text style={[s.help, { color: colors.muted }]}>{t('bookUrlsHelp')}</Text>
        <TextInput
          accessibilityLabel={t('bookUrls')}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          value={value}
          onChangeText={setValue}
          placeholder={t('bookUrlsHint')}
          placeholderTextColor={colors.muted}
          style={[s.input, { color: colors.text, borderColor: colors.border }]}
        />
        <Pressable
          accessibilityRole="button"
          disabled={running}
          style={[s.primary, running && s.disabled]}
          onPress={() => void add()}
        >
          {running ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.primaryText}>{t('addBookUrls')}</Text>
          )}
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.results}>
        {results.map((result, index) => {
          const message =
            result.status === 'added'
              ? t('bookUrlAdded', { name: result.book?.name ?? result.url })
              : result.status === 'existing'
                ? t('bookUrlExisting', { name: result.book?.name ?? result.url })
                : result.error === 'NO_MATCHING_BOOK_SOURCE'
                  ? t('noMatchingBookSource', { url: result.url })
                  : t('bookUrlFailed', {
                      url: result.url,
                      error: result.error ?? '',
                    });
          return (
            <Text
              key={`${index}:${result.url}`}
              style={[s.result, { color: result.status === 'failed' ? colors.danger : colors.text }]}
            >
              {message}
            </Text>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  form: { padding: 20, gap: 14 },
  help: { lineHeight: 21 },
  input: {
    minHeight: 150,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    textAlignVertical: 'top',
  },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#285d42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  primaryText: { color: '#fff', fontWeight: '700' },
  results: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  result: { lineHeight: 21 },
});
