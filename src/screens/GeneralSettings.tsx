import { useEffect, useState } from 'react';
import jssdk from '@htyf-mp/js-sdk';
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
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import {
  loadGeneralPreferences,
  saveGeneralPreferences,
  type GeneralPreferences,
  type HomePage,
} from '../data/generalPreferences';
import { useAppTheme } from '../theme/AppTheme';
import { loadLocalPassword, saveLocalPassword } from '../data/localPassword';
import {
  cacheStats,
  clearApplicationCache,
  compactApplicationStorage,
} from '../core/cacheMaintenance';
import {
  loadDiagnosticPreferences,
  saveDiagnosticPreferences,
} from '../data/diagnosticPreferences';

export function GeneralSettings({
  back,
  changed,
}: {
  back: () => void;
  changed: (value: GeneralPreferences) => void;
}) {
  const { colors, t } = useAppTheme();
  const [preferences, setState] = useState(loadGeneralPreferences);
  const [diagnostics, setDiagnostics] = useState(loadDiagnosticPreferences);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(() => !!loadLocalPassword());
  const [cache, setCache] = useState({ bytes: 0, entries: 0 });
  const [confirmCache, setConfirmCache] = useState(false);
  const [maintaining, setMaintaining] = useState(false);
  useEffect(() => {
    void cacheStats()
      .then(setCache)
      .catch(() => undefined);
  }, []);
  const set = (patch: Partial<GeneralPreferences>) => {
    const next = saveGeneralPreferences({ ...preferences, ...patch });
    setState(next);
    changed(next);
  };
  const pages: Array<[HomePage, string]> = [
    ['bookshelf', t('bookshelf')],
    ...(preferences.showExplore
      ? [['explore', t('explore')] as [HomePage, string]]
      : []),
    ...(preferences.showRss
      ? [['rss', t('subscriptions')] as [HomePage, string]]
      : []),
    ['mine', t('mine')],
  ];
  const savePassword = () => {
    if (!password) {
      void jssdk.showToast({
        type: 'error',
        title: t('localPasswordRequired'),
      });
      return;
    }
    if (password !== confirmPassword) {
      void jssdk.showToast({ type: 'error', title: t('passwordMismatch') });
      return;
    }
    saveLocalPassword(password);
    setHasPassword(true);
    setPassword('');
    setConfirmPassword('');
    void jssdk.showToast({ type: 'success', title: t('localPasswordSaved') });
  };
  const clearPassword = () => {
    saveLocalPassword('');
    setHasPassword(false);
    setPassword('');
    setConfirmPassword('');
    void jssdk.showToast({ type: 'success', title: t('localPasswordCleared') });
  };
  const clearCache = async () => {
    setConfirmCache(false);
    setMaintaining(true);
    try {
      const removed = await clearApplicationCache();
      setCache({ bytes: 0, entries: 0 });
      void jssdk.showToast({
        type: 'success',
        title: t('cacheCleared'),
        description: t('cacheClearedDetail', {
          size: formatBytes(removed.bytes),
        }),
      });
    } catch (error) {
      void jssdk.showToast({
        type: 'error',
        title: t('cacheClearFailed'),
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setMaintaining(false);
    }
  };
  const compact = () => {
    try {
      compactApplicationStorage();
      void jssdk.showToast({ type: 'success', title: t('storageCompacted') });
    } catch (error) {
      void jssdk.showToast({
        type: 'error',
        title: t('storageCompactFailed'),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('otherSettings')} onBack={back} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('homeNavigation')}
        </Text>
        <Toggle
          label={t('autoRefreshBookshelf')}
          value={preferences.autoRefreshBookshelf}
          change={autoRefreshBookshelf => set({ autoRefreshBookshelf })}
        />
        {preferences.autoRefreshBookshelf ? (
          <Toggle
            label={t('onlyUpdateRead')}
            value={preferences.onlyUpdateRead}
            change={onlyUpdateRead => set({ onlyUpdateRead })}
          />
        ) : null}
        <Toggle
          label={t('defaultToRead')}
          value={preferences.defaultToRead}
          change={defaultToRead => set({ defaultToRead })}
        />
        <Toggle
          label={t('showExplore')}
          value={preferences.showExplore}
          change={showExplore => set({ showExplore })}
        />
        <Toggle
          label={t('showRss')}
          value={preferences.showRss}
          change={showRss => set({ showRss })}
        />
        <Text style={[s.label, { color: colors.text }]}>
          {t('defaultHomePage')}
        </Text>
        {pages.map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{
              selected: preferences.defaultHomePage === value,
            }}
            style={[
              s.choice,
              {
                backgroundColor: colors.surface,
                borderColor:
                  preferences.defaultHomePage === value
                    ? colors.primary
                    : colors.border,
              },
            ]}
            onPress={() => set({ defaultHomePage: value })}
          >
            <Text style={{ color: colors.text }}>{label}</Text>
            <Text style={{ color: colors.primary }}>
              {preferences.defaultHomePage === value ? '●' : '○'}
            </Text>
          </Pressable>
        ))}
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('network')}
        </Text>
        <Text style={[s.label, { color: colors.text }]}>{t('userAgent')}</Text>
        <TextInput
          accessibilityLabel={t('userAgent')}
          autoCapitalize="none"
          autoCorrect={false}
          value={preferences.userAgent}
          onChangeText={userAgent => set({ userAgent })}
          placeholder={t('systemDefault')}
          placeholderTextColor={colors.muted}
          style={[
            s.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        />
        <Text style={{ color: colors.muted }}>{t('userAgentHelp')}</Text>
        <NumberSetting
          label={t('threadCount')}
          value={preferences.threadCount}
          min={1}
          max={16}
          change={threadCount => set({ threadCount })}
        />
        <Text style={{ color: colors.muted }}>{t('threadCountHelp')}</Text>
        {/* TODO(htyf-native): Custom DNS/hosts and Cronet transport require the native networking work documented in docs/htyf-migration-gaps.md. */}
        <Text style={{ color: colors.muted }}>
          {t('networkNativeUnavailable')}
        </Text>
        <NumberSetting
          label={t('preDownloadNum')}
          value={preferences.preDownloadNum}
          min={0}
          max={10}
          change={preDownloadNum => set({ preDownloadNum })}
        />
        <Text style={{ color: colors.muted }}>{t('preDownloadHelp')}</Text>
        <Toggle
          label={t('autoChangeSource')}
          value={preferences.autoChangeSource}
          change={autoChangeSource => set({ autoChangeSource })}
        />
        <NumberSetting
          label={t('imageRetainNum')}
          value={preferences.imageRetainNum}
          min={0}
          max={100}
          change={imageRetainNum => set({ imageRetainNum })}
        />
        <Text style={{ color: colors.muted }}>{t('imageRetainHelp')}</Text>
        <Toggle
          label={t('showMangaUi')}
          value={preferences.showMangaUi}
          change={showMangaUi => set({ showMangaUi })}
        />
        <Toggle
          label={t('replaceEnableDefault')}
          value={preferences.replaceEnableDefault}
          change={replaceEnableDefault => set({ replaceEnableDefault })}
        />
        <NumberSetting
          label={t('sourceEditMaxLine')}
          value={preferences.sourceEditMaxLine}
          min={3}
          max={100}
          change={sourceEditMaxLine => set({ sourceEditMaxLine })}
        />
        <Toggle
          label={t('autoClearExpired')}
          value={preferences.autoClearExpired}
          change={autoClearExpired => set({ autoClearExpired })}
        />
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('diagnostics')}
        </Text>
        <Toggle
          label={t('recordAppLogs')}
          value={diagnostics.recordLog}
          change={recordLog =>
            setDiagnostics(
              saveDiagnosticPreferences({ ...diagnostics, recordLog }),
            )
          }
        />
        <Toggle
          label={t('recordHttpLogs')}
          value={diagnostics.recordHttpLog}
          change={recordHttpLog =>
            setDiagnostics(
              saveDiagnosticPreferences({ ...diagnostics, recordHttpLog }),
            )
          }
        />
        <Text style={{ color: colors.muted }}>{t('httpLogPrivacyHelp')}</Text>
        {/* TODO(htyf-native): Heap dumps and global native image-cache sizing require approved native diagnostics/image APIs; see docs/htyf-migration-gaps.md. */}
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('localPassword')}
        </Text>
        <Text style={{ color: colors.muted }}>{t('localPasswordHelp')}</Text>
        <Text style={{ color: hasPassword ? colors.primary : colors.muted }}>
          {t(
            hasPassword
              ? 'localPasswordConfigured'
              : 'localPasswordNotConfigured',
          )}
        </Text>
        <TextInput
          accessibilityLabel={t('newLocalPassword')}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
          placeholder={t('newLocalPassword')}
          placeholderTextColor={colors.muted}
          style={[
            s.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        />
        <TextInput
          accessibilityLabel={t('confirmLocalPassword')}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t('confirmLocalPassword')}
          placeholderTextColor={colors.muted}
          style={[
            s.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        />
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            style={[s.action, { backgroundColor: colors.primary }]}
            onPress={savePassword}
          >
            <Text style={s.actionText}>{t('saveLocalPassword')}</Text>
          </Pressable>
          {hasPassword ? (
            <Pressable
              accessibilityRole="button"
              style={[s.action, { borderColor: colors.danger, borderWidth: 1 }]}
              onPress={clearPassword}
            >
              <Text style={{ color: colors.danger, fontWeight: '700' }}>
                {t('clearLocalPassword')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('storageMaintenance')}
        </Text>
        <Text style={{ color: colors.muted }}>
          {t('cacheUsage', {
            size: formatBytes(cache.bytes),
            count: cache.entries,
          })}
        </Text>
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={maintaining}
            accessibilityState={{ disabled: maintaining }}
            style={[s.action, { backgroundColor: colors.primary }]}
            onPress={() => setConfirmCache(true)}
          >
            {maintaining ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.actionText}>{t('clearCache')}</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={maintaining}
            accessibilityState={{ disabled: maintaining }}
            style={[s.action, { borderColor: colors.primary, borderWidth: 1 }]}
            onPress={compact}
          >
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {t('compactStorage')}
            </Text>
          </Pressable>
        </View>
        {/* TODO(htyf-native): Global WebView website-data deletion is unavailable without an approved configured API; see docs/htyf-migration-gaps.md. */}
        <Text style={{ color: colors.muted }}>
          {t('webViewDataUnavailable')}
        </Text>
        {/* TODO(htyf-native): Do not expose legacy native-only switches until the work in docs/htyf-migration-gaps.md is authorized and testable. */}
        <Text
          style={[s.note, { color: colors.muted, borderColor: colors.border }]}
        >
          {t('nativeSettingsOmitted')}
        </Text>
      </ScrollView>
      <InTreeSheet
        visible={confirmCache}
        onDismiss={() => setConfirmCache(false)}
      >
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          {t('clearCacheConfirm')}
        </Text>
        <Text style={{ color: colors.muted }}>{t('clearCacheHelp')}</Text>
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            style={[s.action, { borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => setConfirmCache(false)}
          >
            <Text style={{ color: colors.text }}>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[s.action, { backgroundColor: colors.danger }]}
            onPress={() => void clearCache()}
          >
            <Text style={s.actionText}>{t('clearCache')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
    </View>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Toggle({
  label,
  value,
  change,
}: {
  label: string;
  value: boolean;
  change: (value: boolean) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[s.toggle, { borderColor: colors.border }]}>
      <Text style={{ color: colors.text }}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={change} />
    </View>
  );
}

function NumberSetting({
  label,
  value,
  min,
  max,
  change,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  change: (value: number) => void;
}) {
  const { colors, t } = useAppTheme();
  return (
    <View style={[s.numberRow, { borderColor: colors.border }]}>
      <Text style={{ color: colors.text, flex: 1 }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('decrease', { name: label })}
        disabled={value <= min}
        style={s.numberButton}
        onPress={() => change(Math.max(min, value - 1))}
      >
        <Text style={{ color: colors.primary, fontSize: 22 }}>−</Text>
      </Pressable>
      <Text
        accessibilityLabel={`${label}: ${value}`}
        style={[s.numberValue, { color: colors.text }]}
      >
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('increase', { name: label })}
        disabled={value >= max}
        style={s.numberButton}
        onPress={() => change(Math.min(max, value + 1))}
      >
        <Text style={{ color: colors.primary, fontSize: 22 }}>＋</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  heading: { fontSize: 17, fontWeight: '800', marginTop: 10 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10 },
  label: { fontWeight: '600', marginTop: 4 },
  choice: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggle: {
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  numberRow: {
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberValue: { minWidth: 36, textAlign: 'center', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  action: {
    minHeight: 48,
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: '#fff', fontWeight: '700' },
  note: {
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    lineHeight: 20,
  },
});
