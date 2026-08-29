import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { loadSources, saveSources, upsertBookSource } from '../data/sources';
import type { BookSource } from '../types';
import { buildEditedBookSource, SourceEditorError } from '../core/sourceEditor';
import { useAppTheme } from '../theme/AppTheme';
import { loadGeneralPreferences } from '../data/generalPreferences';
import { KeyboardAssistInput } from '../components/KeyboardAssistInput';

const createEmptySource = (): BookSource => ({
  bookSourceName: '',
  bookSourceUrl: '',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
});

function advancedFields(source: BookSource): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...source };
  for (const key of [
    'bookSourceName',
    'bookSourceUrl',
    'bookSourceGroup',
    'searchUrl',
    'exploreUrl',
    'loginUrl',
    'bookSourceComment',
    'enabled',
    'enabledExplore',
    'enabledCookieJar',
  ])
    delete copy[key];
  return copy;
}

export function SourceEditor({
  sourceUrl,
  back,
  saved,
  search,
}: {
  sourceUrl?: string;
  back: () => void;
  saved: () => void;
  search: (sourceUrl: string) => void;
}) {
  const { colors, t } = useAppTheme();
  const maxLines = loadGeneralPreferences().sourceEditMaxLine;
  const [source, setSource] = useState<BookSource>(createEmptySource);
  const [advanced, setAdvanced] = useState('{}');
  const [loading, setLoading] = useState(!!sourceUrl);
  useEffect(() => {
    if (!sourceUrl) return;
    void loadSources()
      .then(sources => {
        const found = sources.find(item => item.bookSourceUrl === sourceUrl);
        if (!found) throw new Error(t('sourceDeleted'));
        setSource(found);
        setAdvanced(JSON.stringify(advancedFields(found), null, 2));
      })
      .catch(error => {
        void jssdk.showToast({
          type: 'error',
          title: t('sourceLoadFailed'),
          description: error instanceof Error ? error.message : String(error),
        });
        back();
      })
      .finally(() => setLoading(false));
  }, [back, sourceUrl, t]);
  const set = (key: keyof BookSource, value: unknown) =>
    setSource(current => ({ ...current, [key]: value }));
  const commit = async (after?: (sourceUrl: string) => void) => {
    try {
      const normalized = buildEditedBookSource(source, advanced);
      await saveSources(
        upsertBookSource(await loadSources(), normalized, sourceUrl),
      );
      void jssdk.showToast({ type: 'success', title: t('sourceSaved') });
      if (after) after(normalized.bookSourceUrl);
      else saved();
    } catch (error) {
      void jssdk.showToast({
        type: 'error',
        title: t('sourceSaveFailed'),
        description:
          error instanceof SourceEditorError
            ? t(error.code)
            : error instanceof Error
              ? error.message
              : String(error),
      });
    }
  };
  if (loading)
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[s.muted, { color: colors.muted }]}>
          {t('loadingSource')}
        </Text>
      </View>
    );
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={sourceUrl ? t('editSource') : t('newSource')}
        onBack={back}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('saveSource')}
            style={s.saveTouch}
            onPress={() => void commit()}
          >
            <Text style={[s.save, { color: colors.primary }]}>
              {t('saveSource')}
            </Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={s.form}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          label={t('sourceName')}
          value={source.bookSourceName}
          onChange={value => set('bookSourceName', value)}
        />
        <Field
          label={t('sourceUniqueUrl')}
          value={source.bookSourceUrl}
          onChange={value => set('bookSourceUrl', value)}
        />
        <Field
          label={t('sourceGroup')}
          value={source.bookSourceGroup ?? ''}
          onChange={value => set('bookSourceGroup', value)}
        />
        <Field
          label={t('sourceSearchUrl')}
          value={source.searchUrl ?? ''}
          onChange={value => set('searchUrl', value)}
        />
        <Field
          label={t('sourceExploreUrl')}
          value={source.exploreUrl ?? ''}
          onChange={value => set('exploreUrl', value)}
        />
        <Field
          label={t('loginUrl')}
          value={String(source.loginUrl ?? '')}
          onChange={value => set('loginUrl', value)}
        />
        <Field
          label={t('sourceComment')}
          value={source.bookSourceComment ?? ''}
          onChange={value => set('bookSourceComment', value)}
          multiline
          numberOfLines={maxLines}
        />
        <Toggle
          label={t('enableSource')}
          value={source.enabled}
          onChange={value => set('enabled', value)}
        />
        <Toggle
          label={t('enableExplore')}
          value={source.enabledExplore}
          onChange={value => set('enabledExplore', value)}
        />
        <Toggle
          label={t('enableCookieManagement')}
          value={source.enabledCookieJar === true}
          onChange={value => set('enabledCookieJar', value)}
        />
        <Text style={[s.label, { color: colors.text }]}>
          {t('advancedSourceJson')}
        </Text>
        <KeyboardAssistInput
          accessibilityLabel={t('advancedSourceJson')}
          value={advanced}
          onChangeText={setAdvanced}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.muted}
          style={[
            s.input,
            s.code,
            {
              borderColor: colors.border,
              color: colors.text,
              backgroundColor: colors.surface,
            },
          ]}
        />
        {source.searchUrl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('saveAndSearchSource')}
            style={[s.searchButton, { borderColor: colors.primary }]}
            onPress={() => void commit(search)}
          >
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {t('saveAndSearchSource')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  numberOfLines,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  numberOfLines?: number;
}) {
  const { colors } = useAppTheme();
  const visibleLines =
    numberOfLines ?? loadGeneralPreferences().sourceEditMaxLine;
  return (
    <View>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <KeyboardAssistInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        numberOfLines={multiline ? visibleLines : undefined}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.muted}
        style={[
          s.input,
          multiline && s.multiline,
          {
            borderColor: colors.border,
            color: colors.text,
            backgroundColor: colors.surface,
          },
        ]}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: {},
  form: { padding: 16, gap: 15, paddingBottom: 40 },
  saveTouch: {
    minWidth: 60,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  save: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  multiline: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
  code: {
    minHeight: 260,
    paddingTop: 12,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  toggle: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
