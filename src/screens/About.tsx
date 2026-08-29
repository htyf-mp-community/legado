import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import jssdk from '@htyf-mp/js-sdk';
import appConfig from '../../app.json';
import { PageHeader } from '../components/PageHeader';
import { APP_STORAGE_ID } from '../data/storage';
import { buildAppDiagnostics } from '../core/appDiagnostics';
import { useAppTheme } from '../theme/AppTheme';

const PROJECT = 'https://github.com/LegadoTeam/legado';
const links = {
  contributors: `${PROJECT}/graphs/contributors`,
  privacyPolicy: `${PROJECT}/blob/master/app/src/main/assets/privacyPolicy.md`,
  license: `${PROJECT}/blob/master/LICENSE`,
  disclaimer: `${PROJECT}/blob/master/app/src/main/assets/disclaimer.md`,
};

export function About({ back, openLogs }: { back: () => void; openLogs: () => void }) {
  const { colors, t } = useAppTheme();
  const diagnostics = buildAppDiagnostics({
    appName: appConfig.displayName,
    appVersion: appConfig.htyf.version,
    appId: appConfig.htyf.appid,
    storageId: APP_STORAGE_ID,
    platform: Platform.OS,
    platformVersion: Platform.Version,
    reactNativeVersion: Platform.constants.reactNativeVersion,
  });
  const open = async (url: string) => {
    try { if (!(await Linking.canOpenURL(url))) throw new Error(t('cannotOpenLink')); await Linking.openURL(url); }
    catch (error) { void jssdk.showToast({ type: 'error', title: t('cannotOpenLink'), description: error instanceof Error ? error.message : String(error) }); }
  };
  const share = async () => { try { await Share.share({ title: appConfig.displayName, message: `${t('aboutDescription')}\n${PROJECT}` }); } catch (error) { void jssdk.showToast({ type: 'error', title: t('shareFailed'), description: error instanceof Error ? error.message : String(error) }); } };
  const copy = () => { Clipboard.setString(diagnostics); void jssdk.showToast({ type: 'success', title: t('diagnosticsCopied') }); };
  return <View style={[s.flex, { backgroundColor: colors.background }]}><PageHeader title={t('about')} onBack={back} action={<Pressable accessibilityRole="button" accessibilityLabel={t('share')} style={s.headerAction} onPress={() => void share()}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t('share')}</Text></Pressable>}/><ScrollView contentContainerStyle={s.content}>
    <View style={[s.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text accessibilityRole="header" style={[s.name, { color: colors.text }]}>{appConfig.displayName}</Text><Text style={{ color: colors.muted }}>{t('versionLabel', { version: appConfig.htyf.version })}</Text><Text style={[s.description, { color: colors.text }]}>{t('aboutDescription')}</Text><Text style={{ color: colors.muted }}>{t('updateFeaturesExcluded')}</Text></View>
    <AboutRow label={t('projectHomepage')} action={() => void open(PROJECT)}/><AboutRow label={t('contributors')} action={() => void open(links.contributors)}/><AboutRow label={t('privacyPolicy')} action={() => void open(links.privacyPolicy)}/><AboutRow label={t('license')} action={() => void open(links.license)}/><AboutRow label={t('disclaimer')} action={() => void open(links.disclaimer)}/><AboutRow label={t('logs')} action={openLogs}/><AboutRow label={t('copyDiagnostics')} action={copy}/>
    <Text selectable style={[s.diagnostics, { color: colors.muted, borderColor: colors.border }]}>{diagnostics}</Text>
  </ScrollView></View>;
}

function AboutRow({ label, action }: { label: string; action: () => void }) { const { colors } = useAppTheme(); return <Pressable accessibilityRole="button" accessibilityLabel={label} style={[s.row, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={action}><Text style={{ color: colors.text, fontWeight: '600' }}>{label}</Text><Text style={{ color: colors.muted }}>›</Text></Pressable>; }
const s = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, paddingBottom: 40, gap: 10 }, headerAction: { minWidth: 52, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, hero: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 8 }, name: { fontSize: 23, fontWeight: '800' }, description: { lineHeight: 22 }, row: { minHeight: 54, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, diagnostics: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), lineHeight: 20 } });
