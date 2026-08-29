import { useState } from 'react';
import { errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import jssdk from '@htyf-mp/js-sdk';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { InTreeSheet } from '../components/InTreeSheet';
import { PageHeader } from '../components/PageHeader';
import { mergeBookshelf } from '../core/bookshelfTransfer';
import { pickBookshelfJson, saveBookshelfJson } from '../core/bookshelfTransferFile';
import type { Book } from '../types';
import { useAppTheme } from '../theme/AppTheme';

export function BookshelfTransfer({ books, back, imported }: { books: Book[]; back: () => void; imported: (books: Book[]) => void }) {
  const { colors, t } = useAppTheme();
  const [running, setRunning] = useState(false), [pending, setPending] = useState<Book[]>(), [message, setMessage] = useState('');
  const fail = (error: unknown) => {
    if (!(isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED))
      setMessage(error instanceof Error ? error.message : String(error));
  };
  const choose = async () => {
    setRunning(true); setMessage('');
    try { const incoming = await pickBookshelfJson(); setPending(incoming); setMessage(t('bookshelfImportPreview', { count: incoming.length })); }
    catch (error) { fail(error); }
    finally { setRunning(false); }
  };
  const merge = (overwrite: boolean) => {
    if (!pending) return;
    const result = mergeBookshelf(books, pending, overwrite);
    imported(result.books); setPending(undefined);
    setMessage(t('bookshelfImportComplete', { added: result.added, replaced: result.replaced, skipped: result.skipped }));
  };
  const save = async () => {
    setRunning(true); setMessage('');
    try { await saveBookshelfJson(books); setMessage(t('bookshelfDocumentSaved')); void jssdk.showToast({ type: 'success', title: t('bookshelfDocumentSaved') }); }
    catch (error) { fail(error); }
    finally { setRunning(false); }
  };
  return <View style={[s.flex, { backgroundColor: colors.background }]}><PageHeader title={t('bookshelfTransfer')} onBack={back}/><View style={s.content}>
    <Text style={[s.heading, { color: colors.text }]}>{t('bookshelfTransferCount', { count: books.length })}</Text>
    <Text style={{ color: colors.muted }}>{t('bookshelfTransferHelp')}</Text>
    {running ? <ActivityIndicator color={colors.primary}/> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: running }} disabled={running} style={[s.action, { backgroundColor: colors.primary }]} onPress={() => void save()}><Text style={s.primary}>{t('exportBookshelfJson')}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: running }} disabled={running} style={[s.action, { borderColor: colors.primary }]} onPress={() => void choose()}><Text style={{ color: colors.primary }}>{t('importBookshelfJson')}</Text></Pressable>
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>{message}</Text> : null}
  </View><InTreeSheet visible={!!pending} onDismiss={() => setPending(undefined)}><Text style={[s.heading, { color: colors.text }]}>{t('confirmBookshelfImport')}</Text><Text style={{ color: colors.muted }}>{t('bookshelfImportDuplicateHelp')}</Text><View style={s.row}><Pressable accessibilityRole="button" style={[s.choice, { borderColor: colors.border }]} onPress={() => setPending(undefined)}><Text style={{ color: colors.text }}>{t('cancel')}</Text></Pressable><Pressable accessibilityRole="button" style={[s.choice, { borderColor: colors.primary }]} onPress={() => merge(false)}><Text style={{ color: colors.primary }}>{t('skipDuplicates')}</Text></Pressable><Pressable accessibilityRole="button" style={[s.choice, { backgroundColor: colors.primary }]} onPress={() => merge(true)}><Text style={s.primary}>{t('overwriteDuplicates')}</Text></Pressable></View></InTreeSheet></View>;
}

const s = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 22, gap: 16 }, heading: { fontSize: 20, fontWeight: '800' }, action: { minHeight: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, primary: { color: '#fff', fontWeight: '700' }, row: { marginTop: 18, gap: 10 }, choice: { minHeight: 48, borderWidth: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 } });
