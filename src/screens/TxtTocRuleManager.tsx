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
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import {
  exportTxtTocRules,
  loadTxtTocRules,
  mergeTxtTocRules,
  normalizeTxtTocRule,
  parseTxtTocRules,
  saveTxtTocRules,
} from '../data/txtTocRules';
import type { TxtTocRule } from '../types';
import { useAppTheme } from '../theme/AppTheme';

const emptyRule = (): TxtTocRule => ({
  id: Date.now(),
  name: '',
  rule: '',
  replacement: '$1',
  serialNumber: 0,
  enable: true,
});
export function TxtTocRuleManager({ back }: { back: () => void }) {
  const { colors, t } = useAppTheme();
  const [rules, setRules] = useState(loadTxtTocRules),
    [editing, setEditing] = useState<TxtTocRule | null>(null),
    [remove, setRemove] = useState<TxtTocRule | null>(null);
  const commit = (next: TxtTocRule[]) => {
    setRules(next);
    saveTxtTocRules(next);
  };
  const saveEdit = () => {
    if (!editing) return;
    try {
      const rule = normalizeTxtTocRule(
        editing as unknown as Record<string, unknown>,
        editing.id,
      );
      commit(mergeTxtTocRules(rules, [rule]));
      setEditing(null);
    } catch (error) {
      void jssdk.showToast({
        type: 'error',
        title: t('invalidRule'),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const importClipboard = async () => {
    try {
      const incoming = parseTxtTocRules(await Clipboard.getString());
      commit(mergeTxtTocRules(rules, incoming));
      void jssdk.showToast({
        type: 'success',
        title: t('ruleItemsImported', { count: incoming.length }),
      });
    } catch (error) {
      void jssdk.showToast({
        type: 'error',
        title: t('importFailed'),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('txtTocRuleTitle', { count: rules.length })}
        onBack={back}
        action={
          <View style={s.actions}>
            <Pressable accessibilityRole="button"
              accessibilityLabel={t('exportTocRules')}
              style={s.touch}
              onPress={() => {
                Clipboard.setString(exportTxtTocRules(rules));
                void jssdk.showToast({ type: 'success', title: t('ruleCopied') });
              }}
            >
              <Text style={[s.icon, { color: colors.primary }]}>⇧</Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              accessibilityLabel={t('importTocRules')}
              style={s.touch}
              onPress={() => void importClipboard()}
            >
              <Text style={[s.icon, { color: colors.primary }]}>↓</Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              accessibilityLabel={t('createTocRule')}
              style={s.touch}
              onPress={() => setEditing(emptyRule())}
            >
              <Text style={[s.icon, { color: colors.primary }]}>＋</Text>
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={s.list}>
        {rules.map(rule => (
          <View key={rule.id} style={[s.item, { borderColor: colors.border }]}>
            <Pressable accessibilityRole="button" style={s.text} onPress={() => setEditing(rule)}>
              <Text style={[s.name, { color: colors.text }]}>{rule.name}</Text>
              <Text numberOfLines={1} style={[s.meta, { color: colors.text }]}>
                {rule.rule}
              </Text>
              {rule.example ? (
                <Text numberOfLines={1} style={[s.example, { color: colors.muted }]}>
                  {rule.example}
                </Text>
              ) : null}
            </Pressable>
            <Switch
              accessibilityLabel={t('ruleEnabledNamed', { name: rule.name })}
              value={rule.enable}
              onValueChange={enable =>
                commit(
                  rules.map(item =>
                    item.id === rule.id ? { ...item, enable } : item,
                  ),
                )
              }
            />
            <Pressable accessibilityRole="button" accessibilityLabel={t('deleteNamed', { name: rule.name })} style={s.touch} onPress={() => setRemove(rule)}>
              <Text style={[s.delete, { color: colors.danger }]}>×</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <InTreeSheet visible={!!editing} onDismiss={() => setEditing(null)}>
        {editing ? (
          <ScrollView>
            <Text style={[s.sheetTitle, { color: colors.text }]}>
              {rules.some(rule => rule.id === editing.id)
                ? t('editRule')
                : t('newRule')}
            </Text>
            <Field
              label={t('name')}
              value={editing.name}
              onChange={name => setEditing({ ...editing, name })}
            />
            <Field
              label={t('chapterRegex')}
              value={editing.rule}
              onChange={rule => setEditing({ ...editing, rule })}
              multiline
            />
            <Field
              label={t('titleReplacement')}
              value={editing.replacement}
              onChange={replacement => setEditing({ ...editing, replacement })}
            />
            <Field
              label={t('example')}
              value={editing.example ?? ''}
              onChange={example => setEditing({ ...editing, example })}
            />
            <Pressable accessibilityRole="button" style={[s.primary, { backgroundColor: colors.primary }]} onPress={saveEdit}>
              <Text style={s.primaryText}>{t('saveRule')}</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </InTreeSheet>
      <InTreeSheet visible={!!remove} onDismiss={() => setRemove(null)}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>{t('deleteTocRuleTitle')}</Text>
        <Text style={[s.sheetText, { color: colors.text }]}>{remove?.name}</Text>
        <Pressable accessibilityRole="button"
          style={[s.danger, { backgroundColor: colors.danger }]}
          onPress={() => {
            if (remove) commit(rules.filter(rule => rule.id !== remove.id));
            setRemove(null);
          }}
        >
          <Text style={s.primaryText}>{t('confirmDelete')}</Text>
        </Pressable>
      </InTreeSheet>
    </View>
  );
}
function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        style={[s.input, { borderColor: colors.border, color: colors.text }, multiline && s.multiline]}
      />
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row' },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 23 },
  list: { paddingHorizontal: 12, paddingBottom: 30 },
  item: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 5 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontFamily: 'monospace' },
  example: {},
  delete: { fontSize: 28 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 14 },
  sheetText: { marginBottom: 18 },
  field: { marginBottom: 12 },
  label: { fontWeight: '600', marginBottom: 6 },
  input: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  multiline: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  danger: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
});
