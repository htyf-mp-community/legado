import { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import {
  exportReplaceRules,
  loadReplaceRules,
  mergeReplaceRules,
  parseReplaceRules,
  saveReplaceRules,
} from '../data/replaceRules';
import type { ReplaceRule } from '../types';
import { useAppTheme } from '../theme/AppTheme';

export function ReplaceRuleManager({
  back,
  edit,
}: {
  back: () => void;
  edit: (id?: number) => void;
}) {
  const { colors, t } = useAppTheme();
  const [rules, setRules] = useState<ReplaceRule[]>([]),
    [query, setQuery] = useState(''),
    [remove, setRemove] = useState<ReplaceRule | null>(null);
  useFocusEffect(useCallback(() => setRules(loadReplaceRules()), []));
  const commit = (next: ReplaceRule[]) => {
    setRules(next);
    saveReplaceRules(next);
  };
  const filtered = useMemo(() => {
    const key = query.trim().toLowerCase();
    return key
      ? rules.filter(rule =>
          `${rule.name} ${rule.group ?? ''} ${rule.pattern}`
            .toLowerCase()
            .includes(key),
        )
      : rules;
  }, [query, rules]);
  const importClipboard = async () => {
    try {
      const incoming = parseReplaceRules(await Clipboard.getString());
      commit(mergeReplaceRules(rules, incoming));
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
        title={t('replaceRuleTitle', { count: rules.length })}
        onBack={back}
        action={
          <View style={s.actions}>
            <Pressable accessibilityRole="button"
              accessibilityLabel={t('exportReplaceRules')}
              style={s.touch}
              onPress={() => {
                Clipboard.setString(exportReplaceRules(rules));
                void jssdk.showToast({ type: 'success', title: t('ruleCopied') });
              }}
            >
              <Text style={[s.icon, { color: colors.primary }]}>⇧</Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              accessibilityLabel={t('importReplaceRules')}
              style={s.touch}
              onPress={() => void importClipboard()}
            >
              <Text style={[s.icon, { color: colors.primary }]}>↓</Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              accessibilityLabel={t('createReplaceRule')}
              style={s.touch}
              onPress={() => edit()}
            >
              <Text style={[s.icon, { color: colors.primary }]}>＋</Text>
            </Pressable>
          </View>
        }
      />
      <View style={s.search}>
        <TextInput
          accessibilityLabel={t('filterReplaceRules')}
          value={query}
          onChangeText={setQuery}
          placeholder={t('filterReplacePlaceholder')}
          placeholderTextColor={colors.muted}
          style={[s.input, { backgroundColor: colors.surface, color: colors.text }]}
        />
      </View>
      {filtered.length ? (
        <ScrollView contentContainerStyle={s.list}>
          {filtered.map(rule => (
            <View key={rule.id} style={[s.item, { borderColor: colors.border }]}>
              <Pressable accessibilityRole="button" style={s.text} onPress={() => edit(rule.id)}>
                <Text style={[s.name, { color: colors.text }]}>{rule.name}</Text>
                <Text numberOfLines={1} style={[s.meta, { color: colors.muted }]}>
                  {rule.group || t('ungrouped')} · {rule.isRegex ? t('regex') : t('textRule')} ·{' '}
                  {rule.pattern}
                </Text>
              </Pressable>
              <Switch
                accessibilityLabel={t('ruleEnabledNamed', { name: rule.name })}
                value={rule.isEnabled}
                onValueChange={isEnabled =>
                  commit(
                    rules.map(item =>
                      item.id === rule.id ? { ...item, isEnabled } : item,
                    ),
                  )
                }
              />
              <Pressable accessibilityRole="button"
                accessibilityLabel={t('deleteNamed', { name: rule.name })}
                style={s.touch}
                onPress={() => setRemove(rule)}
              >
                <Text style={[s.delete, { color: colors.danger }]}>×</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={s.center}>
          <Text style={[s.empty, { color: colors.muted }]}>
            {t(query ? 'noMatchingRules' : 'noReplaceRules')}
          </Text>
        </View>
      )}
      <InTreeSheet visible={!!remove} onDismiss={() => setRemove(null)}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>{t('deleteReplaceRuleTitle')}</Text>
        <Text style={[s.sheetText, { color: colors.text }]}>{remove?.name}</Text>
        <View style={s.sheetActions}>
          <Pressable accessibilityRole="button" style={[s.cancel, { backgroundColor: colors.background }]} onPress={() => setRemove(null)}>
            <Text style={{ color: colors.text }}>{t('cancel')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button"
            style={[s.danger, { backgroundColor: colors.danger }]}
            onPress={() => {
              if (remove) commit(rules.filter(rule => rule.id !== remove.id));
              setRemove(null);
            }}
          >
            <Text style={s.dangerText}>{t('delete')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
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
  search: { padding: 12 },
  input: {
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 18,
  },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  item: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 6 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  delete: { fontSize: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 19, fontWeight: '700' },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  sheetText: { marginVertical: 16 },
  sheetActions: { flexDirection: 'row', gap: 12 },
  cancel: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  danger: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  dangerText: { color: '#fff', fontWeight: '700' },
});
