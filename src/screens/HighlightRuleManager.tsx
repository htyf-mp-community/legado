import { useEffect, useState } from 'react';
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
  exportHighlightRules,
  loadHighlightRules,
  mergeHighlightRules,
  normalizeHighlightRule,
  parseHighlightRules,
  saveHighlightRules,
} from '../data/highlightRules';
import type { HighlightRule } from '../types';
import { useAppTheme } from '../theme/AppTheme';

const empty = (): HighlightRule => ({
  id: Date.now(),
  uuid: '',
  name: '',
  pattern: '',
  isRegex: false,
  isEnabled: true,
  style: '{"fill":2164195702}',
  order: 0,
  timeoutMillisecond: 3000,
  applyToTitle: false,
  applyToBody: true,
});
export function HighlightRuleManager({
  back,
  initialRuleId,
}: {
  back: () => void;
  initialRuleId?: number;
}) {
  const { colors, t } = useAppTheme();
  const [rules, setRules] = useState(loadHighlightRules),
    [editing, setEditing] = useState<HighlightRule | null>(null),
    [remove, setRemove] = useState<HighlightRule | null>(null);
  useEffect(() => {
    if (initialRuleId === undefined) return;
    const selected = loadHighlightRules().find(
      rule => rule.id === initialRuleId,
    );
    if (selected) setEditing({ ...selected });
  }, [initialRuleId]);
  const commit = (next: HighlightRule[]) => {
    setRules(next);
    saveHighlightRules(next);
  };
  const toast = (
    type: 'success' | 'error',
    title: string,
    description?: string,
  ) => void jssdk.showToast({ type, title, description });
  const importRules = async () => {
    try {
      const incoming = parseHighlightRules(await Clipboard.getString());
      commit(mergeHighlightRules(rules, incoming));
      toast('success', t('ruleItemsImported', { count: incoming.length }));
    } catch (error) {
      toast(
        'error',
        t('importFailed'),
        error instanceof Error ? error.message : String(error),
      );
    }
  };
  const save = () => {
    if (!editing) return;
    try {
      const rule = normalizeHighlightRule(
        editing as unknown as Record<string, unknown>,
        editing.id,
      );
      commit(
        mergeHighlightRules(
          rules.filter(item => item.uuid !== editing.uuid),
          [rule],
        ),
      );
      setEditing(null);
    } catch (error) {
      toast(
        'error',
        t('saveFailed'),
        error instanceof Error ? error.message : String(error),
      );
    }
  };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('highlightRuleTitle', { count: rules.length })}
        onBack={back}
        action={
          <View style={s.row}>
            <Pressable
              accessibilityRole="button"
              style={s.touch}
              accessibilityLabel={t('exportHighlightRules')}
              onPress={() => {
                Clipboard.setString(exportHighlightRules(rules));
                toast('success', t('ruleCopied'));
              }}
            >
              <Text style={[s.icon, { color: colors.primary }]}>⇧</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.touch}
              accessibilityLabel={t('importHighlightRules')}
              onPress={() => void importRules()}
            >
              <Text style={[s.icon, { color: colors.primary }]}>↓</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.touch}
              accessibilityLabel={t('createHighlightRule')}
              onPress={() => setEditing(empty())}
            >
              <Text style={[s.icon, { color: colors.primary }]}>＋</Text>
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={s.list}>
        {rules.map(rule => (
          <View
            key={rule.uuid || rule.id}
            style={[s.item, { borderColor: colors.border }]}
          >
            <Pressable
              accessibilityRole="button"
              style={s.text}
              onPress={() => setEditing({ ...rule })}
            >
              <Text style={[s.name, { color: colors.text }]}>
                {rule.name || rule.pattern}
              </Text>
              <Text numberOfLines={1} style={[s.meta, { color: colors.muted }]}>
                {rule.isRegex ? t('regex') : t('textRule')} ·{' '}
                {rule.applyToTitle ? `${t('titleTarget')} ` : ''}
                {rule.applyToBody ? t('bodyTarget') : ''} · {rule.pattern}
              </Text>
            </Pressable>
            <Switch
              accessibilityLabel={t('ruleEnabledNamed', {
                name: rule.name || rule.pattern,
              })}
              value={rule.isEnabled}
              onValueChange={isEnabled =>
                commit(
                  rules.map(item =>
                    item.uuid === rule.uuid ? { ...item, isEnabled } : item,
                  ),
                )
              }
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('deleteNamed', {
                name: rule.name || rule.pattern,
              })}
              style={s.touch}
              onPress={() => setRemove(rule)}
            >
              <Text style={[s.delete, { color: colors.danger }]}>×</Text>
            </Pressable>
          </View>
        ))}
        {!rules.length ? (
          <Text style={[s.empty, { color: colors.muted }]}>
            {t('noHighlightRules')}
          </Text>
        ) : null}
      </ScrollView>
      <InTreeSheet visible={!!editing} onDismiss={() => setEditing(null)}>
        {editing ? (
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[s.title, { color: colors.text }]}>
              {t('editHighlightRule')}
            </Text>
            <Field
              label={t('name')}
              value={editing.name}
              change={name => setEditing({ ...editing, name })}
            />
            <Field
              label={t('matchContent')}
              value={editing.pattern}
              change={pattern => setEditing({ ...editing, pattern })}
              multi
            />
            <Field
              label={t('ruleScope')}
              value={editing.scope ?? ''}
              change={scope => setEditing({ ...editing, scope })}
            />
            <Field
              label={t('highlightStyleJson')}
              value={editing.style}
              change={style => setEditing({ ...editing, style })}
              multi
            />
            <View style={s.option}>
              <Text style={{ color: colors.text }}>
                {t('regularExpression')}
              </Text>
              <Switch
                accessibilityLabel={t('regularExpression')}
                value={editing.isRegex}
                onValueChange={isRegex => setEditing({ ...editing, isRegex })}
              />
            </View>
            <View style={s.option}>
              <Text style={{ color: colors.text }}>{t('applyToTitle')}</Text>
              <Switch
                accessibilityLabel={t('applyToTitle')}
                value={editing.applyToTitle}
                onValueChange={applyToTitle =>
                  setEditing({ ...editing, applyToTitle })
                }
              />
            </View>
            <View style={s.option}>
              <Text style={{ color: colors.text }}>{t('applyToBody')}</Text>
              <Switch
                accessibilityLabel={t('applyToBody')}
                value={editing.applyToBody}
                onValueChange={applyToBody =>
                  setEditing({ ...editing, applyToBody })
                }
              />
            </View>
            <Pressable
              accessibilityRole="button"
              style={[s.primary, { backgroundColor: colors.primary }]}
              onPress={save}
            >
              <Text style={s.primaryText}>{t('save')}</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </InTreeSheet>
      <InTreeSheet visible={!!remove} onDismiss={() => setRemove(null)}>
        <Text style={[s.title, { color: colors.text }]}>
          {t('deleteHighlightRuleTitle')}
        </Text>
        <Text style={[s.remove, { color: colors.text }]}>
          {remove?.name || remove?.pattern}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={[s.danger, { backgroundColor: colors.danger }]}
          onPress={() => {
            if (remove) commit(rules.filter(item => item.uuid !== remove.uuid));
            setRemove(null);
          }}
        >
          <Text style={s.primaryText}>{t('delete')}</Text>
        </Pressable>
      </InTreeSheet>
    </View>
  );
}
function Field({
  label,
  value,
  change,
  multi = false,
}: {
  label: string;
  value: string;
  change: (value: string) => void;
  multi?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        multiline={multi}
        style={[
          s.input,
          { borderColor: colors.border, color: colors.text },
          multi && s.multi,
        ]}
      />
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 23 },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  item: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 5 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12 },
  delete: { fontSize: 28 },
  empty: { marginTop: 60, textAlign: 'center', fontSize: 17 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 14 },
  field: { marginBottom: 12 },
  label: { fontWeight: '600', marginBottom: 6 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multi: { minHeight: 92, textAlignVertical: 'top' },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  remove: { marginBottom: 18 },
  danger: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
