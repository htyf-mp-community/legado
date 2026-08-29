import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import jssdk from '@htyf-mp/js-sdk';
import { PageHeader } from '../components/PageHeader';
import { LauncherIconError, launcherIcons, loadLauncherIcon, setLauncherIcon, type LauncherIcon, type LauncherIconErrorCode } from '../data/launcherIcon';
import type { MessageKey } from '../i18n';
import { useAppTheme } from '../theme/AppTheme';

const nameKeys: Record<LauncherIcon, MessageKey> = {
  default: 'launcherDefault',
  green: 'launcherGreen',
  night: 'launcherNight',
  paper: 'launcherPaper',
};
const errorKeys: Record<LauncherIconErrorCode, MessageKey> = {
  invalid: 'launcherInvalid',
  'android-only': 'launcherAndroidOnly',
  'module-unavailable': 'launcherModuleUnavailable',
};

export function LauncherIconSettings({ back }: { back: () => void }) {
  const { colors, t } = useAppTheme();
  const [selected, setSelected] = useState(loadLauncherIcon);
  const [running, setRunning] = useState<LauncherIcon | null>(null);
  const choose = async (icon: LauncherIcon) => {
    setRunning(icon);
    try {
      setSelected(await setLauncherIcon(icon));
      void jssdk.showToast({ type: 'success', title: t('launcherChanged'), description: t('launcherRefreshHint') });
    } catch (error) {
      void jssdk.showToast({ type: 'error', title: t('launcherChangeFailed'), description: error instanceof LauncherIconError ? t(errorKeys[error.code]) : error instanceof Error ? error.message : String(error) });
    } finally {
      setRunning(null);
    }
  };
  const unavailable = Platform.OS !== 'android';

  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('launcherIcon')} onBack={back} />
      <View style={s.content}>
        <Text style={{ color: colors.muted }}>{t(unavailable ? 'launcherIosUnavailable' : 'launcherAndroidHelp')}</Text>
        {launcherIcons.map(icon => {
          const label = t(nameKeys[icon]);
          const disabled = unavailable || running !== null;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected: selected === icon, disabled }}
              disabled={disabled}
              key={icon}
              style={[s.item, { backgroundColor: colors.surface, borderColor: selected === icon ? colors.primary : colors.border, opacity: disabled ? 0.55 : 1 }]}
              onPress={() => void choose(icon)}
            >
              <View style={[s.preview, { backgroundColor: icon === 'green' ? '#285d42' : icon === 'night' ? '#111827' : icon === 'paper' ? '#eee7d3' : '#ffffff' }]}>
                <Text style={{ color: icon === 'paper' ? '#43382b' : icon === 'night' ? '#f6d365' : colors.primary }}>{t('launcherMark')}</Text>
              </View>
              <Text style={[s.name, { color: colors.text }]}>{label}{running === icon ? '…' : ''}</Text>
              <Text style={{ color: colors.primary }}>{selected === icon ? '●' : '○'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 12 },
  item: { minHeight: 64, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 17, fontWeight: '700' },
});
