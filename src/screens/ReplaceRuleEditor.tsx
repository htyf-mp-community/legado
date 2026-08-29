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
import jssdk from '@htyf-mp/js-sdk';
import { PageHeader } from '../components/PageHeader';
import {
  applyReplaceRules,
  loadReplaceRules,
  mergeReplaceRules,
  normalizeReplaceRule,
  saveReplaceRules,
} from '../data/replaceRules';
import type { ReplaceRule } from '../types';
import { useAppTheme } from '../theme/AppTheme';
import { KeyboardAssistInput } from '../components/KeyboardAssistInput';

const emptyRule = (): ReplaceRule => ({
  id: Date.now(),
  name: '',
  pattern: '',
  replacement: '',
  scopeTitle: false,
  scopeSource: false,
  scopeContent: true,
  isEnabled: true,
  isRegex: true,
  timeoutMillisecond: 3000,
  order: 0,
});
export function ReplaceRuleEditor({
  ruleId,
  back,
  saved,
}: {
  ruleId?: number;
  back: () => void;
  saved: () => void;
}) {
  const { colors, t } = useAppTheme();
  const [rule, setRule] = useState<ReplaceRule>(
      () => loadReplaceRules().find(item => item.id === ruleId) ?? emptyRule(),
    ),
    [preview, setPreview] = useState(() => t('replacePreviewDefault'));
  const set = <K extends keyof ReplaceRule>(key: K, value: ReplaceRule[K]) =>
    setRule(current => ({ ...current, [key]: value }));
  const commit = () => {
    try {
      const normalized = normalizeReplaceRule(
        rule as unknown as Record<string, unknown>,
        rule.id,
      );
      saveReplaceRules(mergeReplaceRules(loadReplaceRules(), [normalized]));
      void jssdk.showToast({ type: 'success', title: t('replaceRuleSaved') });
      saved();
    } catch (error) {
      void jssdk.showToast({
        type: 'error',
        title: t('cannotSaveRule'),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const result = rule.pattern
    ? applyReplaceRules(
        preview,
        [{ ...rule, isEnabled: true, scopeContent: true }],
        'content',
        { name: '', origin: '' },
      )
    : preview;
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t(ruleId ? 'editReplaceRule' : 'newReplaceRule')}
        onBack={back}
        action={
          <Pressable accessibilityRole="button"
            accessibilityLabel={t('saveReplaceRule')}
            style={s.saveTouch}
            onPress={commit}
          >
            <Text style={[s.save, { color: colors.primary }]}>{t('save')}</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={s.form}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          label={t('name')}
          value={rule.name}
          onChange={value => set('name', value)}
        />
        <Field
          label={t('group')}
          value={rule.group ?? ''}
          onChange={value => set('group', value || undefined)}
        />
        <Field
          label={t('matchContent')}
          value={rule.pattern}
          onChange={value => set('pattern', value)}
          multiline
        />
        <Field
          label={t('replacement')}
          value={rule.replacement}
          onChange={value => set('replacement', value)}
          multiline
        />
        <Field
          label={t('includeScope')}
          value={rule.scope ?? ''}
          onChange={value => set('scope', value || undefined)}
        />
        <Field
          label={t('excludeScope')}
          value={rule.excludeScope ?? ''}
          onChange={value => set('excludeScope', value || undefined)}
        />
        <Toggle
          label={t('enabled')}
          value={rule.isEnabled}
          onChange={value => set('isEnabled', value)}
        />
        <Toggle
          label={t('useRegex')}
          value={rule.isRegex}
          onChange={value => set('isRegex', value)}
        />
        <Toggle
          label={t('applyToContent')}
          value={rule.scopeContent}
          onChange={value => set('scopeContent', value)}
        />
        <Toggle
          label={t('applyToTitle')}
          value={rule.scopeTitle}
          onChange={value => set('scopeTitle', value)}
        />
        <Toggle
          label={t('applyToSource')}
          value={rule.scopeSource}
          onChange={value => set('scopeSource', value)}
        />
        <Text style={[s.label, { color: colors.text }]}>{t('previewOriginal')}</Text>
        <KeyboardAssistInput
          accessibilityLabel={t('replacePreviewText')}
          value={preview}
          onChangeText={setPreview}
          multiline
          style={[s.input, { borderColor: colors.border, color: colors.text }, s.multiline]}
        />
        <Text style={[s.label, { color: colors.text }]}>{t('replacementResult')}</Text>
        <Text selectable style={[s.preview, { backgroundColor: colors.surface, color: colors.text }]}>
          {result}
        </Text>
      </ScrollView>
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
    <View>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <KeyboardAssistInput
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
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={s.toggle}>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  form: { padding: 16, gap: 15, paddingBottom: 50 },
  saveTouch: {
    minWidth: 60,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  save: { fontWeight: '700', fontSize: 16 },
  label: { fontWeight: '600', marginBottom: 6 },
  input: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  multiline: { minHeight: 84, paddingTop: 12, textAlignVertical: 'top' },
  toggle: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preview: {
    minHeight: 80,
    padding: 12,
    borderRadius: 8,
    lineHeight: 22,
  },
});
