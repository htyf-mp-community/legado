import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import jssdk from '@htyf-mp/js-sdk';
import { unlink } from '@dr.pogodin/react-native-fs';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import { createBackupArchive } from '../core/backupArchive';
import { createBackup } from '../data/backup';
import {
  defaultDirectLinkRules,
  DirectLinkUploadError,
  loadDirectLinkRule,
  normalizeDirectLinkRule,
  parseDirectLinkRule,
  saveDirectLinkRule,
  uploadDirectLink,
  uploadDirectLinkFile,
  type DirectLinkRule,
  type DirectLinkUploadErrorCode,
} from '../data/directLinkUpload';
import type { MessageKey } from '../i18n';
import { useAppTheme } from '../theme/AppTheme';

const errorKeys: Record<DirectLinkUploadErrorCode, MessageKey> = {
  'invalid-upload-url': 'directInvalidUploadUrl',
  'missing-download-rule': 'directMissingDownloadRule',
  'missing-summary': 'directMissingSummary',
  'invalid-expiry': 'directInvalidExpiry',
  'invalid-json': 'directInvalidJson',
  'rule-not-object': 'directRuleNotObject',
  'invalid-options-json': 'directInvalidOptionsJson',
  'unsupported-js': 'directUnsupportedJs',
  'unsupported-method': 'directUnsupportedMethod',
  'upload-http': 'directUploadHttp',
  'missing-download-url': 'directMissingDownloadUrl',
  'multipart-required': 'directMultipartRequired',
};
const emptyRule = (): DirectLinkRule => ({ ...defaultDirectLinkRules[0] });

export function DirectLinkUpload({ back }: { back: () => void }) {
  const { colors, t } = useAppTheme();
  const [rule, setRule] = useState<DirectLinkRule>(() => loadDirectLinkRule() ?? emptyRule());
  const [running, setRunning] = useState<'test' | 'upload' | ''>('');
  const [result, setResult] = useState('');
  const errorText = (error: unknown) => error instanceof DirectLinkUploadError
    ? t(errorKeys[error.code], { detail: error.detail })
    : error instanceof Error ? error.message : String(error);
  const persist = (notify = true) => {
    try {
      const next = saveDirectLinkRule(rule);
      setRule(next);
      if (notify) void jssdk.showToast({ type: 'success', title: t('directLinkRuleSaved') });
      return next;
    } catch (error) {
      void jssdk.showToast({ type: 'error', title: t('invalidRule'), description: errorText(error) });
      return null;
    }
  };
  const importRule = async () => {
    try {
      setRule(parseDirectLinkRule(await Clipboard.getString()));
    } catch (error) {
      void jssdk.showToast({ type: 'error', title: t('importFailed'), description: errorText(error) });
    }
  };
  const upload = async (test: boolean) => {
    const next = persist(false);
    if (!next) return;
    setRunning(test ? 'test' : 'upload');
    try {
      let archive = '', url = '';
      try {
        if (test || !next.compress) {
          url = await uploadDirectLink(next, test ? 'test.json' : 'backup-htyf.json', test ? '{"test":true}' : createBackup());
        } else {
          archive = await createBackupArchive();
          url = await uploadDirectLinkFile(next, archive.split('/').pop() ?? 'backup-htyf.zip', archive);
        }
      } finally {
        if (archive) await unlink(archive).catch(() => undefined);
      }
      setResult(url);
      Clipboard.setString(url);
      void jssdk.showToast({ type: 'success', title: t(test ? 'testSucceededCopied' : 'backupUploadSucceededCopied') });
    } catch (error) {
      void jssdk.showToast({ type: 'error', title: t(test ? 'testFailed' : 'uploadFailed'), description: errorText(error) });
    } finally {
      setRunning('');
    }
  };
  const set = <K extends keyof DirectLinkRule>(key: K, value: DirectLinkRule[K]) => setRule(current => ({ ...current, [key]: value }));
  const disabled = !!running;

  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('directLinkUploadTitle')}
        onBack={back}
        action={(
          <View style={s.actions}>
            <Pressable accessibilityRole="button" style={s.touch} accessibilityLabel={t('copyRule')} onPress={() => {
              try {
                Clipboard.setString(JSON.stringify(normalizeDirectLinkRule(rule), null, 2));
                void jssdk.showToast({ type: 'success', title: t('ruleCopied') });
              } catch (error) {
                void jssdk.showToast({ type: 'error', title: t('invalidRule'), description: errorText(error) });
              }
            }}><Text style={[s.icon, { color: colors.primary }]}>⇧</Text></Pressable>
            <Pressable accessibilityRole="button" style={s.touch} accessibilityLabel={t('pasteRule')} onPress={() => void importRule()}><Text style={[s.icon, { color: colors.primary }]}>↓</Text></Pressable>
          </View>
        )}
      />
      <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <Field label={t('uploadAndParameters')} value={rule.uploadUrl} onChange={value => set('uploadUrl', value)} multiline />
        <Field label={t('downloadUrlRule')} value={rule.downloadUrlRule} onChange={value => set('downloadUrlRule', value)} multiline />
        <Field label={t('ruleDescription')} value={rule.summary} onChange={value => set('summary', value)} />
        <Field label={t('expiryDays')} value={String(rule.expiryDate)} onChange={value => set('expiryDate', Number(value.replace(/\D/g, '')) || 0)} keyboard="number-pad" />
        <View style={s.toggle}><Text style={[s.label, { color: colors.text }]}>{t('uploadCompressed')}</Text><Switch accessibilityLabel={t('uploadCompressed')} value={rule.compress} onValueChange={value => set('compress', value)} /></View>
        <Text style={[s.note, { color: colors.muted }]}>{t('directLinkCompatibilityNote')}</Text>
        <Text accessibilityRole="header" style={[s.label, { color: colors.text }]}>{t('builtInRules')}</Text>
        <View style={s.presets}>
          {defaultDirectLinkRules.map(item => (
            <Pressable accessibilityRole="button" accessibilityLabel={t('builtInRuleNamed', { name: item.summary })} key={item.uploadUrl} style={[s.preset, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setRule({ ...item })}>
              <Text style={[s.presetTitle, { color: colors.text }]}>{item.summary}</Text>
              <Text numberOfLines={1} style={{ color: colors.muted }}>{item.uploadUrl.split(',')[0]}</Text>
            </Pressable>
          ))}
        </View>
        {running ? <ActivityIndicator color={colors.primary} /> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} style={[s.secondary, { backgroundColor: colors.surface, borderColor: colors.border }, disabled && s.disabled]} onPress={() => persist()}><Text style={[s.secondaryText, { color: colors.text }]}>{t('saveConfiguration')}</Text></Pressable>
        <View style={s.buttonRow}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} style={[s.secondary, { backgroundColor: colors.surface, borderColor: colors.border }, disabled && s.disabled]} onPress={() => void upload(true)}><Text style={[s.secondaryText, { color: colors.text }]}>{t('testUpload')}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} style={[s.primary, { backgroundColor: colors.primary }, disabled && s.disabled]} onPress={() => void upload(false)}><Text style={s.primaryText}>{t('uploadCurrentBackup')}</Text></Pressable>
        </View>
      </ScrollView>
      <InTreeSheet visible={!!result} onDismiss={() => setResult('')}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>{t('uploadComplete')}</Text>
        <Text selectable style={[s.result, { color: colors.primary }]}>{result}</Text>
        <Pressable accessibilityRole="button" style={[s.primary, { backgroundColor: colors.primary }]} onPress={() => { Clipboard.setString(result); setResult(''); }}><Text style={s.primaryText}>{t('copyAndClose')}</Text></Pressable>
      </InTreeSheet>
    </View>
  );
}

function Field({ label, value, onChange, multiline = false, keyboard = 'default' }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; keyboard?: 'default' | 'number-pad' }) {
  const { colors } = useAppTheme();
  return <View><Text style={[s.label, { color: colors.text }]}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multiline} keyboardType={keyboard} autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.muted} style={[s.input, { color: colors.text, borderColor: colors.border }, multiline && s.multiline]} /></View>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, actions: { flexDirection: 'row' }, touch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, icon: { fontSize: 23 }, form: { padding: 18, gap: 14, paddingBottom: 50 },
  label: { fontWeight: '600', marginBottom: 6 }, input: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 12 }, multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' }, toggle: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, note: { fontSize: 13, lineHeight: 20 },
  presets: { gap: 8 }, preset: { minHeight: 58, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, justifyContent: 'center', gap: 3 }, presetTitle: { fontWeight: '700' }, buttonRow: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, secondary: { flex: 1, minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, primaryText: { color: '#fff', fontWeight: '700' }, secondaryText: { fontWeight: '700' }, disabled: { opacity: 0.42 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 }, result: { marginBottom: 18, lineHeight: 22 },
});
