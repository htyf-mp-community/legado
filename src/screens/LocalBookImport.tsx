import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';
import jssdk from '@htyf-mp/js-sdk';
import { PageHeader } from '../components/PageHeader';
import {
  importSupportedBook,
  SUPPORTED_BOOK_FILE,
} from '../core/localBookImport';
import { loadTxtTocRules } from '../data/txtTocRules';
import type { Book } from '../types';
import { useAppTheme } from '../theme/AppTheme';

export function LocalBookImport({
  back,
  imported,
  initialUri,
}: {
  back: () => void;
  imported: (books: Book[]) => void;
  initialUri?: string;
}) {
  const { colors, t } = useAppTheme();
  const [running, setRunning] = useState(false),
    [messages, setMessages] = useState<string[]>([]);
  const importFiles = async (
    files: Array<{ uri: string; name?: string | null }>,
  ) => {
    setRunning(true);
    try {
      const books: Book[] = [],
        nextMessages: string[] = [];
      for (const file of files) {
        const fileName = file.name ?? t('localBookDefault');
        // TODO(htyf-native): Add PDF import only after an approved, version-pinned in-tree renderer exists.
        if (!SUPPORTED_BOOK_FILE.test(fileName)) {
          nextMessages.push(t('unsupportedEbook', { name: fileName }));
          continue;
        }
        try {
          const book = await importSupportedBook(
            file.uri,
            fileName,
            loadTxtTocRules(),
          );
          books.push(book);
          nextMessages.push(
            t('chaptersRecognized', {
              name: fileName,
              count: book.chapters?.length ?? 1,
            }),
          );
        } catch (error) {
          nextMessages.push(
            `${fileName}：${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      setMessages(nextMessages);
      if (books.length) {
        imported(books);
        void jssdk.showToast({
          type: 'success',
          title: t('booksImported', { count: books.length }),
        });
      }
    } catch (error) {
      if (
        !(
          isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED
        )
      )
        setMessages([error instanceof Error ? error.message : String(error)]);
    } finally {
      setRunning(false);
    }
  };
  const choose = async () => {
    try {
      await importFiles(
        await pick({
          type: [
            types.plainText,
            'application/epub+zip',
            'application/x-mobipocket-ebook',
            'application/vnd.amazon.ebook',
          ],
          allowMultiSelection: true,
          mode: 'import',
        }),
      );
    } catch (error) {
      if (
        !(
          isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED
        )
      )
        setMessages([error instanceof Error ? error.message : String(error)]);
    }
  };
  useEffect(() => {
    if (initialUri) {
      const clean = decodeURIComponent(initialUri),
        name = clean.split('/').pop() ?? t('externalBookDefault');
      void importFiles([{ uri: clean, name }]);
    }
  }, [initialUri]);
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('localImportTitle')} onBack={back} />
      <View style={s.hero}>
        <Text style={[s.title, { color: colors.text }]}>
          {t('localImportHeading')}
        </Text>
        <Text style={[s.muted, { color: colors.muted }]}>
          {t('localImportHelp')}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={running}
          style={s.primary}
          onPress={() => void choose()}
        >
          {running ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.primaryText}>{t('chooseEbooks')}</Text>
          )}
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.results}>
        {messages.map((message, index) => (
          <Text
            key={`${index}:${message}`}
            style={[s.message, { color: colors.text }]}
          >
            {message}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  hero: { padding: 24, gap: 14 },
  title: { fontSize: 21, fontWeight: '700', color: '#222' },
  muted: { color: '#777', lineHeight: 22 },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#285d42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  results: { paddingHorizontal: 24, gap: 10 },
  message: { color: '#444', lineHeight: 21 },
});
