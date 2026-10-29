import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import jssdk from '@htyf-mp/js-sdk';
import { SourceIcon, type SourceIconName } from '../components/SourceIcon';
import { InTreeSheet } from '../components/InTreeSheet';
import { useAppTheme } from '../theme/AppTheme';
import type { ThemeMode } from '../data/appPreferences';
import {
  loadAutoTaskServiceEnabled,
  saveAutoTaskServiceEnabled,
} from '../data/autoTasks';
import { runDueAutoTasks } from '../core/autoTask';
import {
  localWebServiceStatus,
  startLocalWebService,
  stopLocalWebService,
} from '../data/localWebService';
import {
  mcpServiceStatus,
  startMcpService,
  stopMcpService,
} from '../data/mcpService';

export type MineDestination =
  | 'Sources'
  | 'AutoTasks'
  | 'TxtTocRules'
  | 'ReplaceRules'
  | 'DictRules'
  | 'Backup'
  | 'Appearance'
  | 'GeneralSettings'
  | 'Annotations'
  | 'ReadRecords'
  | 'FileManager'
  | 'About'
  | 'LocalWebService';

/** pref_main.xml order and view_preference.xml spacing, with real foreground service state. */
export function MineScreen({
  navigate,
}: {
  navigate: (screen: MineDestination) => void;
}) {
  const { colors, t, preferences, setPreferences } = useAppTheme();
  const focused = useIsFocused();
  const [tasks, setTasks] = useState(loadAutoTaskServiceEnabled);
  const [web, setWeb] = useState({ running: false, url: '' });
  const [mcp, setMcp] = useState({ running: false, url: '' });
  const [pending, setPending] = useState<'web' | 'mcp' | undefined>();
  const [error, setError] = useState('');
  const [themeMenu, setThemeMenu] = useState(false);
  const sync = useCallback(async () => {
    const values = await Promise.all([
      localWebServiceStatus(),
      mcpServiceStatus(),
    ]);
    setWeb(values[0]);
    setMcp(values[1]);
    setTasks(loadAutoTaskServiceEnabled());
  }, []);
  useEffect(() => {
    if (!focused) return;
    void sync().catch(e => setError(String(e)));
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void sync().catch(e => setError(String(e)));
    });
    return () => listener.remove();
  }, [focused, sync]);
  const toggleServer = async (kind: 'web' | 'mcp', enabled: boolean) => {
    if (pending) return;
    setPending(kind);
    setError('');
    try {
      if (kind === 'web')
        setWeb(
          await (enabled ? startLocalWebService() : stopLocalWebService()),
        );
      else setMcp(await (enabled ? startMcpService() : stopMcpService()));
    } catch (e) {
      setError(
        `${t('mineServiceFailed')}: ${e instanceof Error ? e.message : String(e)}`,
      );
      await sync().catch(() => undefined);
    } finally {
      setPending(undefined);
    }
  };
  const modeChoices: Array<[ThemeMode, string]> = [
    ['system', t('themeSystem')],
    ['light', t('themeLight')],
    ['dark', t('themeDark')],
    ['eink', t('mineThemeEink')],
  ];
  const entry = (
    icon: SourceIconName,
    title: string,
    summary: string,
    destination: MineDestination,
  ) => (
    <PreferenceRow
      key={destination}
      icon={icon}
      title={title}
      summary={summary}
      press={() => navigate(destination)}
    />
  );
  return (
    <View style={s.flex}>
      <ScrollView contentContainerStyle={s.content}>
        {entry(
          'ic_cfg_source',
          t('sourceManagement'),
          t('mineSourceSummary'),
          'Sources',
        )}
        {entry(
          'ic_auto_page',
          t('autoTasks'),
          t('mineTaskSummary'),
          'AutoTasks',
        )}
        <PreferenceRow
          icon="ic_auto_page"
          title={t('mineTaskService')}
          summary={t('mineTaskServiceSummary')}
          value={tasks}
          change={enabled => {
            setTasks(saveAutoTaskServiceEnabled(enabled));
            if (enabled) void runDueAutoTasks().catch(e => setError(String(e)));
          }}
        />
        {entry(
          'ic_cfg_source',
          t('txtTocRules'),
          t('mineTocSummary'),
          'TxtTocRules',
        )}
        {entry(
          'ic_cfg_replace',
          t('mineReplaceTitle'),
          t('mineReplaceSummary'),
          'ReplaceRules',
        )}
        {entry(
          'ic_translate',
          t('mineDictTitle'),
          t('mineDictSummary'),
          'DictRules',
        )}
        <PreferenceRow
          icon="ic_cfg_theme"
          title={t('mineThemeTitle')}
          summary={t('mineThemeSummary')}
          press={() => setThemeMenu(true)}
        />
        <PreferenceRow
          icon="ic_cfg_web"
          title={t('localWebService')}
          summary={
            web.running
              ? `${web.url}\n${t('mineLocalServiceScope')}`
              : t('mineWebSummary')
          }
          value={web.running}
          disabled={!!pending}
          change={value => void toggleServer('web', value)}
          longPress={() => navigate('LocalWebService')}
        />
        <PreferenceRow
          icon="ic_cfg_web"
          title={t('mcpService')}
          summary={
            mcp.running
              ? `${mcp.url}\n${t('mineLocalServiceScope')}`
              : t('mineMcpSummary')
          }
          value={mcp.running}
          disabled={!!pending}
          change={value => void toggleServer('mcp', value)}
          longPress={() => navigate('LocalWebService')}
        />
        {error ? (
          <Text
            accessibilityRole="alert"
            style={[s.error, { color: colors.danger }]}
          >
            {error}
          </Text>
        ) : null}
        <Category title={t('settings')} />
        {entry(
          'ic_cfg_backup',
          t('backupRestore'),
          t('mineBackupSummary'),
          'Backup',
        )}
        {entry(
          'ic_cfg_theme',
          t('mineThemeSettings'),
          t('mineThemeSettingsSummary'),
          'Appearance',
        )}
        {entry(
          'ic_cfg_other',
          t('mineOtherSettings'),
          t('mineOtherSettingsSummary'),
          'GeneralSettings',
        )}
        <Category title={t('mineOthers')} />
        {entry(
          'ic_bookmark',
          t('mineBookmarks'),
          t('mineBookmarksSummary'),
          'Annotations',
        )}
        {entry(
          'ic_history',
          t('readRecords'),
          t('mineReadSummary'),
          'ReadRecords',
        )}
        {entry(
          'ic_folder_outline',
          t('fileManager'),
          t('mineFilesSummary'),
          'FileManager',
        )}
        {entry('ic_cfg_about', t('about'), '', 'About')}
        <PreferenceRow
          icon="ic_exit"
          title={t('mineExit')}
          press={() => {
            void jssdk
              .closeApp()
              .then(closed => {
                if (!closed) setError(t('mineExitUnavailable'));
              })
              .catch(() => setError(t('mineExitUnavailable')));
          }}
        />
      </ScrollView>
      <InTreeSheet visible={themeMenu} onDismiss={() => setThemeMenu(false)}>
        <Text
          accessibilityRole="header"
          style={[s.menuTitle, { color: colors.text }]}
        >
          {t('mineThemeTitle')}
        </Text>
        {modeChoices.map(([mode, label]) => (
          <Pressable
            key={mode}
            accessibilityLabel={label}
            accessibilityRole="radio"
            accessibilityState={{ selected: preferences.themeMode === mode }}
            style={s.themeChoice}
            onPress={() => {
              setPreferences({ ...preferences, themeMode: mode });
              setThemeMenu(false);
            }}
          >
            <Text style={{ color: colors.accent }}>
              {preferences.themeMode === mode ? '◉' : '○'}
            </Text>
            <Text style={{ color: colors.text, fontSize: 16 }}>{label}</Text>
          </Pressable>
        ))}
      </InTreeSheet>
    </View>
  );
}
function Category({ title }: { title: string }) {
  const { colors } = useAppTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[s.category, { color: colors.accent }]}
    >
      {title}
    </Text>
  );
}
function PreferenceRow({
  icon,
  title,
  summary,
  press,
  longPress,
  value,
  change,
  disabled,
}: {
  icon: SourceIconName;
  title: string;
  summary?: string;
  press?: () => void;
  longPress?: () => void;
  value?: boolean;
  change?: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole={change ? 'switch' : 'button'}
      accessibilityLabel={title}
      accessibilityHint={summary}
      accessibilityState={change ? { checked: value, disabled } : undefined}
      disabled={disabled}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
      onPress={change ? () => change(!value) : press}
      onLongPress={longPress}
    >
      <View style={s.icon}>
        <SourceIcon name={icon} color={colors.accent} />
      </View>
      <View style={s.text}>
        <Text style={[s.title, { color: colors.text }]}>{title}</Text>
        {summary ? (
          <Text style={[s.summary, { color: colors.muted }]}>{summary}</Text>
        ) : null}
      </View>
      {change ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Switch
            accessibilityLabel={title}
            accessible={false}
            value={value}
            trackColor={{ true: colors.accent }}
            disabled={disabled}
          />
        </View>
      ) : null}
    </Pressable>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 16 },
  row: {
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: { backgroundColor: '#ACACAC63' },
  icon: { width: 24, height: 24, marginRight: 16 },
  text: { flex: 1, paddingRight: 8 },
  title: { fontSize: 16 },
  summary: { fontSize: 14, marginTop: 8 },
  category: {
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  error: { padding: 16 },
  menuTitle: { fontSize: 20, marginBottom: 8 },
  themeChoice: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});
