import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import jssdk from '@htyf-mp/js-sdk';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import { applyRuleSubscription, fetchRuleSubscription, subscriptionChangeCount, type SubscriptionPayload } from '../core/ruleSubscription';
import {
  exportRuleSubscriptions,
  loadRuleSubscriptions,
  moveRuleSubscription,
  normalizeRuleSubscription,
  parseRuleSubscriptions,
  RuleSubscriptionValidationError,
  saveRuleSubscriptions,
  setRuleSubscriptionAutoUpdate,
  setRuleSubscriptionInterval,
  upsertRuleSubscription,
  type RuleSubscription,
  type RuleSubscriptionType,
  type RuleSubscriptionValidationCode,
} from '../data/ruleSubscriptions';
import { addAppLog } from '../data/appLog';
import type { MessageKey } from '../i18n';
import { useAppTheme } from '../theme/AppTheme';

const typeKeys: Record<RuleSubscriptionType, MessageKey> = { 0: 'bookSourcesType', 1: 'rssSourcesType', 2: 'replacementRulesType' };
const errorKeys: Record<RuleSubscriptionValidationCode, MessageKey> = {
  'required-url': 'ruleSubRequiredUrl',
  'invalid-type': 'ruleSubInvalidType',
  'invalid-json': 'ruleSubInvalidJson',
  'empty-list': 'ruleSubEmptyList',
  'invalid-entry': 'ruleSubInvalidEntry',
  'duplicate-url': 'ruleSubDuplicateUrl',
};
const blank = (): RuleSubscription => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: '', url: '', type: 0, customOrder: 0, autoUpdate: false, lastUpdateAt: 0, updateInterval: 0, silentUpdate: false });

export function RuleSubscriptions({ back }: { back: () => void }) {
  const [tasks, setTasks] = useState(loadRuleSubscriptions);
  const [editing, setEditing] = useState<RuleSubscription | null>(null);
  const [remove, setRemove] = useState<RuleSubscription | null>(null);
  const [preview, setPreview] = useState<{ subscription: RuleSubscription; payload: SubscriptionPayload; changes: number } | null>(null);
  const [loading, setLoading] = useState('');
  const [applying, setApplying] = useState(false);
  const { colors, t } = useAppTheme();
  const commit = (next: RuleSubscription[]) => { setTasks(next); saveRuleSubscriptions(next); };
  const toast = (type: 'success' | 'error', title: string, description?: string) => void jssdk.showToast({ type, title, description });
  const errorText = (error: unknown) => error instanceof RuleSubscriptionValidationError
    ? t(errorKeys[error.code], { name: error.duplicateName ?? '' })
    : error instanceof Error ? error.message : String(error);
  const typeName = (type: RuleSubscriptionType) => t(typeKeys[type]);
  const save = () => {
    if (!editing) return;
    try {
      commit(upsertRuleSubscription(tasks, normalizeRuleSubscription(editing as unknown as Record<string, unknown>, editing.customOrder)));
      setEditing(null);
    } catch (error) {
      toast('error', t('saveFailed'), errorText(error));
    }
  };
  const open = async (subscription: RuleSubscription) => {
    if (subscription.js) {
      toast('error', t('subscriptionUpdateFailed'), t('preRequestJsBlocked'));
      return;
    }
    setLoading(subscription.id);
    try {
      const payload = await fetchRuleSubscription(subscription), changes = await subscriptionChangeCount(payload);
      setPreview({ subscription, payload, changes });
    } catch (error) {
      addAppLog(`Rule subscription failed: ${subscription.name}`, error);
      toast('error', t('subscriptionUpdateFailed'), errorText(error));
    } finally {
      setLoading('');
    }
  };
  const apply = async () => {
    if (!preview || applying) return;
    setApplying(true);
    try {
      const count = await applyRuleSubscription(preview.payload), now = Date.now();
      commit(tasks.map(item => item.id === preview.subscription.id ? { ...item, lastUpdateAt: now } : item));
      addAppLog(`Rule subscription applied: ${preview.subscription.name}`);
      toast('success', t('rulesMerged', { count, type: typeName(preview.payload.type) }));
      setPreview(null);
    } catch (error) {
      addAppLog(`Rule subscription apply failed: ${preview.subscription.name}`, error);
      toast('error', t('subscriptionApplyFailed'), errorText(error));
    } finally {
      setApplying(false);
    }
  };
  const importJson = async () => {
    try {
      const incoming = parseRuleSubscriptions(await Clipboard.getString());
      let next = tasks;
      incoming.forEach(item => { next = upsertRuleSubscription(next, item); });
      commit(next);
      toast('success', t('subscriptionsImported', { count: incoming.length }));
    } catch (error) {
      toast('error', t('importFailed'), errorText(error));
    }
  };
  const move = (id: string, direction: -1 | 1) => commit(moveRuleSubscription(tasks, id, direction));

  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('ruleSubscriptionTitle', { count: tasks.length })}
        onBack={back}
        action={(
          <View style={s.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('exportRuleSubscriptions')} style={s.touch} onPress={() => { Clipboard.setString(exportRuleSubscriptions(tasks)); toast('success', t('subscriptionsCopied')); }}><Text style={{ color: colors.primary }}>⇧</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('importRuleSubscriptions')} style={s.touch} onPress={() => void importJson()}><Text style={{ color: colors.primary }}>↓</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('addRuleSubscription')} style={s.touch} onPress={() => setEditing(blank())}><Text style={{ color: colors.primary, fontSize: 26 }}>＋</Text></Pressable>
          </View>
        )}
      />
      <ScrollView contentContainerStyle={s.list}>
        {tasks.map((item, index) => (
          <View key={item.id} style={[s.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('updateNamed', { name: item.name })} style={s.body} onPress={() => void open(item)}>
              <Text style={[s.name, { color: colors.text }]}>{item.name}</Text>
              <Text numberOfLines={1} style={{ color: colors.muted }}>{typeName(item.type)} · {item.url}</Text>
              <Text style={{ color: colors.muted }}>{item.lastUpdateAt ? t('lastUpdated', { date: new Date(item.lastUpdateAt).toLocaleString() }) : t('neverUpdated')}</Text>
            </Pressable>
            {loading === item.id ? <ActivityIndicator color={colors.primary} /> : (
              <Pressable accessibilityRole="button" accessibilityLabel={t('editNamed', { name: item.name })} style={s.touch} onPress={() => setEditing({ ...item })}><Text style={{ color: colors.primary }}>✎</Text></Pressable>
            )}
            <View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('moveUpNamed', { name: item.name })} accessibilityState={{ disabled: index === 0 }} disabled={index === 0} style={[s.orderTouch, index === 0 && s.disabled]} onPress={() => move(item.id, -1)}><Text style={{ color: colors.primary }}>↑</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('moveDownNamed', { name: item.name })} accessibilityState={{ disabled: index === tasks.length - 1 }} disabled={index === tasks.length - 1} style={[s.orderTouch, index === tasks.length - 1 && s.disabled]} onPress={() => move(item.id, 1)}><Text style={{ color: colors.primary }}>↓</Text></Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('deleteNamedItem', { name: item.name })} style={s.touch} onPress={() => setRemove(item)}><Text style={{ color: colors.danger, fontSize: 25 }}>×</Text></Pressable>
          </View>
        ))}
        {!tasks.length ? <Text style={[s.empty, { color: colors.muted }]}>{t('emptySubscriptions')}</Text> : null}
      </ScrollView>
      <InTreeSheet visible={!!editing} onDismiss={() => setEditing(null)}>
        {editing ? (
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[s.title, { color: colors.text }]}>{t('editRuleSubscription')}</Text>
            <Field label={t('name')} value={editing.name} change={name => setEditing({ ...editing, name })} />
            <Field label={t('subscriptionUrl')} value={editing.url} change={url => setEditing({ ...editing, url })} />
            <Text style={[s.label, { color: colors.text }]}>{t('ruleType')}</Text>
            <View style={s.types}>{([0, 1, 2] as RuleSubscriptionType[]).map(type => <Pressable accessibilityRole="radio" accessibilityState={{ selected: editing.type === type }} accessibilityLabel={typeName(type)} key={type} style={[s.type, { borderColor: editing.type === type ? colors.primary : colors.border }]} onPress={() => setEditing({ ...editing, type })}><Text style={{ color: colors.text }}>{typeName(type)}</Text></Pressable>)}</View>
            <Option label={t('autoCheckUpdates')} value={editing.autoUpdate} change={autoUpdate => setEditing(setRuleSubscriptionAutoUpdate(editing, autoUpdate))} />
            <Field label={t('updateIntervalHours')} value={String(editing.updateInterval)} change={value => setEditing(setRuleSubscriptionInterval(editing, value))} />
            <Option label={t('silentMergeUpdates')} value={editing.silentUpdate} disabled={!editing.autoUpdate} change={silentUpdate => setEditing({ ...editing, silentUpdate })} />
            <Field label={t('preRequestJsOptional')} value={editing.js ?? ''} change={js => setEditing({ ...editing, js })} multi />
            <Text style={[s.warning, { color: colors.danger }]}>{t('preRequestJsBlocked')}</Text>
            <Field label={t('showRuleOptional')} value={editing.showRule ?? ''} change={showRule => setEditing({ ...editing, showRule })} />
            <Field label={t('boundSourceUrlOptional')} value={editing.sourceUrl ?? ''} change={sourceUrl => setEditing({ ...editing, sourceUrl })} />
            <Pressable accessibilityRole="button" style={[s.primary, { backgroundColor: colors.primary }]} onPress={save}><Text style={s.primaryText}>{t('save')}</Text></Pressable>
          </ScrollView>
        ) : null}
      </InTreeSheet>
      <InTreeSheet visible={!!preview} onDismiss={() => { if (!applying) setPreview(null); }}>
        {preview ? <View><Text style={[s.title, { color: colors.text }]}>{preview.subscription.name}</Text><Text style={{ color: colors.text }}>{t('remoteRuleSummary', { total: preview.payload.rules.length, type: typeName(preview.payload.type), changes: preview.changes })}</Text><Pressable accessibilityRole="button" accessibilityState={{ disabled: applying }} disabled={applying} style={[s.primary, { backgroundColor: colors.primary }, applying && s.disabled]} onPress={() => void apply()}>{applying ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{t('confirmMerge')}</Text>}</Pressable></View> : null}
      </InTreeSheet>
      <InTreeSheet visible={!!remove} onDismiss={() => setRemove(null)}>
        {remove ? <View><Text style={[s.title, { color: colors.text }]}>{t('deleteSubscriptionTitle', { name: remove.name })}</Text><Pressable accessibilityRole="button" style={[s.danger, { backgroundColor: colors.danger }]} onPress={() => { commit(tasks.filter(item => item.id !== remove.id)); setRemove(null); }}><Text style={s.primaryText}>{t('delete')}</Text></Pressable></View> : null}
      </InTreeSheet>
    </View>
  );
}

function Field({ label, value, change, multi = false }: { label: string; value: string; change: (value: string) => void; multi?: boolean }) {
  const { colors } = useAppTheme();
  return <View style={s.field}><Text style={[s.label, { color: colors.text }]}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} multiline={multi} autoCapitalize="none" placeholderTextColor={colors.muted} style={[s.input, { color: colors.text, borderColor: colors.border }, multi && s.multi]} /></View>;
}
function Option({ label, value, change, disabled = false }: { label: string; value: boolean; change: (value: boolean) => void; disabled?: boolean }) {
  const { colors } = useAppTheme();
  return <View style={[s.option, disabled && s.disabled]}><Text style={{ color: colors.text }}>{label}</Text><Switch accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} value={value} onValueChange={change} /></View>;
}
const s = StyleSheet.create({
  flex: { flex: 1 }, row: { flexDirection: 'row' }, touch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, orderTouch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 14, gap: 10, paddingBottom: 36 }, item: { minHeight: 96, borderWidth: 1, borderRadius: 12, paddingLeft: 10, flexDirection: 'row', alignItems: 'center' }, body: { flex: 1, gap: 5, paddingVertical: 10 }, name: { fontSize: 16, fontWeight: '800' }, empty: { textAlign: 'center', marginTop: 60 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 14 }, field: { marginBottom: 12 }, label: { fontWeight: '700', marginBottom: 6 }, input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }, multi: { minHeight: 90, textAlignVertical: 'top' },
  types: { flexDirection: 'row', gap: 8, marginBottom: 12 }, type: { minHeight: 44, flex: 1, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, option: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, warning: { fontSize: 12, lineHeight: 18, marginTop: -6, marginBottom: 10 },
  primary: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, danger: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: '#fff', fontWeight: '800' }, disabled: { opacity: 0.42 },
});
