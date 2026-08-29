import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import jssdk from '@htyf-mp/js-sdk';
import { InTreeSheet } from '../components/InTreeSheet';
import { PageHeader } from '../components/PageHeader';
import { buildHttpTtsRequest } from '../core/httpTts';
import {
  exportHttpTtsRules,
  loadHttpTtsRules,
  mergeHttpTtsRules,
  normalizeHttpTtsRule,
  parseHttpTtsRules,
  saveHttpTtsRules,
} from '../data/httpTtsRules';
import type { HttpTtsRule } from '../types';
import { useAppTheme } from '../theme/AppTheme';

const emptyRule = (): HttpTtsRule => ({
  id: Date.now(),
  name: '',
  url: '',
  pauseDuration: 0,
  enabledCookieJar: false,
  lastUpdateTime: Date.now(),
});

export function HttpTtsRuleManager({ back }: { back: () => void }) {
  const { colors, t } = useAppTheme();
  const [rules, setRules] = useState(loadHttpTtsRules);
  const [editing, setEditing] = useState<HttpTtsRule | null>(null);
  const [remove, setRemove] = useState<HttpTtsRule | null>(null);
  const [preview, setPreview] = useState('');
  const commit = (next: HttpTtsRule[]) => {
    setRules(next);
    saveHttpTtsRules(next);
  };
  const toast = (
    type: 'success' | 'error',
    title: string,
    description?: string,
  ) => void jssdk.showToast({ type, title, description });
  const importRules = async () => {
    try {
      const incoming = parseHttpTtsRules(await Clipboard.getString());
      commit(mergeHttpTtsRules(rules, incoming));
      toast('success', t('ruleItemsImported', { count: incoming.length }));
    } catch (error) {
      toast('error', t('importFailed'), error instanceof Error ? error.message : String(error));
    }
  };
  const save = () => {
    if (!editing) return;
    try {
      const normalized = normalizeHttpTtsRule(
        editing as unknown as Record<string, unknown>,
        editing.id,
      );
      commit(mergeHttpTtsRules(rules.filter(item => item.id !== editing.id), [normalized]));
      setEditing(null);
      toast('success', t('httpTtsRuleSaved'));
    } catch (error) {
      toast('error', t('saveFailed'), error instanceof Error ? error.message : String(error));
    }
  };
  const testRule = (rule: HttpTtsRule) => {
    try {
      const request = buildHttpTtsRequest(rule, t('httpTtsTestText'), 10);
      setPreview(`${request.method} ${request.url}\n\n${request.body ?? ''}`);
    } catch (error) {
      setPreview(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('httpTtsRuleTitle', { count: rules.length })}
        onBack={back}
        action={
          <View style={s.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('exportHttpTtsRules')} style={s.touch} onPress={() => { Clipboard.setString(exportHttpTtsRules(rules)); toast('success', t('ruleCopied')); }}><Text style={[s.icon, { color: colors.primary }]}>⇧</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('importHttpTtsRules')} style={s.touch} onPress={() => void importRules()}><Text style={[s.icon, { color: colors.primary }]}>↓</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('createHttpTtsRule')} style={s.touch} onPress={() => setEditing(emptyRule())}><Text style={[s.icon, { color: colors.primary }]}>＋</Text></Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={s.list}>
        {rules.map(rule => (
          <View key={rule.id} style={[s.item, { borderColor: colors.border }]}>
            <Pressable accessibilityRole="button" style={s.text} onPress={() => testRule(rule)}>
              <Text style={[s.name, { color: colors.text }]}>{rule.name}</Text>
              <Text numberOfLines={1} style={[s.meta, { color: colors.muted }]}>{rule.url}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('editNamed', { name: rule.name })} style={s.touch} onPress={() => setEditing({ ...rule })}><Text style={[s.edit, { color: colors.primary }]}>✎</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('deleteNamed', { name: rule.name })} style={s.touch} onPress={() => setRemove(rule)}><Text style={[s.delete, { color: colors.danger }]}>×</Text></Pressable>
          </View>
        ))}
        {!rules.length ? <Text style={[s.empty, { color: colors.muted }]}>{t('noHttpTtsRules')}</Text> : null}
      </ScrollView>
      <InTreeSheet visible={!!preview} onDismiss={() => setPreview('')}>
        <Text style={[s.title, { color: colors.text }]}>{t('requestPreview')}</Text>
        <Text selectable style={{ color: colors.text }}>{preview}</Text>
      </InTreeSheet>
      <InTreeSheet visible={!!editing} onDismiss={() => setEditing(null)}>
        {editing ? (
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[s.title, { color: colors.text }]}>{t('editHttpTtsRule')}</Text>
            <Field label={t('name')} value={editing.name} change={name => setEditing({ ...editing, name })} />
            <Field label={t('urlRequestRule')} value={editing.url} change={url => setEditing({ ...editing, url })} multi />
            <Field label={t('requestHeaderJsonShort')} value={editing.header ?? ''} change={header => setEditing({ ...editing, header })} multi />
            <Field label={t('responseContentType')} value={editing.contentType ?? ''} change={contentType => setEditing({ ...editing, contentType })} />
            <Field label={t('pauseDurationMs')} value={String(editing.pauseDuration)} change={value => setEditing({ ...editing, pauseDuration: Number(value) || 0 })} />
            <Field label={t('concurrencyRateShort')} value={editing.concurrentRate ?? ''} change={concurrentRate => setEditing({ ...editing, concurrentRate })} />
            <Field label={t('loginAddress')} value={editing.loginUrl ?? ''} change={loginUrl => setEditing({ ...editing, loginUrl })} />
            <Field label={t('loginUiJsonShort')} value={editing.loginUi ?? ''} change={loginUi => setEditing({ ...editing, loginUi })} multi />
            <View style={s.option}><Text style={{ color: colors.text }}>{t('enableCookieJar')}</Text><Switch accessibilityLabel={t('enableCookieJar')} value={editing.enabledCookieJar} onValueChange={enabledCookieJar => setEditing({ ...editing, enabledCookieJar })} /></View>
            <Pressable accessibilityRole="button" style={[s.primary, { backgroundColor: colors.primary }]} onPress={save}><Text style={s.primaryText}>{t('save')}</Text></Pressable>
          </ScrollView>
        ) : null}
      </InTreeSheet>
      <InTreeSheet visible={!!remove} onDismiss={() => setRemove(null)}>
        <Text style={[s.title, { color: colors.text }]}>{t('deleteHttpTtsRuleTitle')}</Text>
        <Text style={[s.remove, { color: colors.text }]}>{remove?.name}</Text>
        <Pressable accessibilityRole="button" style={[s.danger, { backgroundColor: colors.danger }]} onPress={() => { if (remove) commit(rules.filter(item => item.id !== remove.id)); setRemove(null); }}><Text style={s.primaryText}>{t('delete')}</Text></Pressable>
      </InTreeSheet>
    </View>
  );
}

function Field({ label, value, change, multi = false }: { label: string; value: string; change: (value: string) => void; multi?: boolean }) {
  const { colors } = useAppTheme(); return <View style={s.field}><Text style={[s.label, { color: colors.text }]}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} multiline={multi} style={[s.input, { borderColor: colors.border, color: colors.text }, multi && s.multi]} /></View>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, row: { flexDirection: 'row' }, touch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, icon: { fontSize: 23 }, list: { paddingHorizontal: 12, paddingBottom: 24 }, item: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth }, text: { flex: 1, gap: 5 }, name: { fontSize: 16, fontWeight: '700' }, meta: { fontSize: 12 }, edit: { fontSize: 21 }, delete: { fontSize: 28 }, empty: { textAlign: 'center', marginTop: 60, fontSize: 16 }, title: { fontSize: 20, fontWeight: '700', marginBottom: 14 }, field: { marginBottom: 12 }, label: { fontWeight: '600', marginBottom: 6 }, input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }, multi: { minHeight: 92, textAlignVertical: 'top' }, option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, primary: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, primaryText: { color: '#fff', fontWeight: '700' }, remove: { marginBottom: 18 }, danger: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
