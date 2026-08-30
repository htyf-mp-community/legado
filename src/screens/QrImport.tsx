import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Camera, CameraType } from 'react-native-camera-kit';
import { launchImageLibrary } from 'react-native-image-picker';
import ImageCodeScanner from 'react-native-image-code-scanner';
import { check, openSettings, PERMISSIONS, RESULTS, request } from 'react-native-permissions';
import jssdk from '@htyf-mp/js-sdk';
import { PageHeader } from '../components/PageHeader';
import { classifyQrPayload, type QrRuleKind } from '../core/qrPayload';
import { qrPermissionAction, shouldRequestCameraOnContinue } from '../core/qrPermission';
import { importQrRules } from '../data/qrImport';
import { importBookSourcesInput } from '../core/sourceImport';
import { loadSources, mergeBookSources, saveSources } from '../data/sources';
import { importRssSourcesInput } from '../core/rssSourceImport';
import { loadRssSources, mergeRssSources, saveRssSources } from '../data/rss';
import type { MessageKey } from '../i18n';
import { useAppTheme } from '../theme/AppTheme';

const ruleKeys: Record<QrRuleKind, MessageKey> = {
  bookSource: 'qrBookSource',
  rssSource: 'qrRssSource',
  replaceRule: 'qrReplaceRule',
  txtTocRule: 'qrTxtTocRule',
  dictRule: 'qrDictRule',
  highlightRule: 'qrHighlightRule',
  autoTask: 'qrAutoTask',
  ruleSubscription: 'qrRuleSubscription',
};
type Notice = { key: MessageKey; values?: Record<string, string | number> } | { raw: string };
const cameraPermission = () => Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;

export function QrImport({ back, initialValue, expectedKind }: { back: () => void; initialValue?: string; expectedKind?: 'bookSource' | 'rssSource' }) {
  const { colors, t } = useAppTheme();
  const [permission, setPermission] = useState<string>('checking');
  const [value, setValue] = useState(initialValue ?? '');
  const [notice, setNotice] = useState<Notice>();
  const [scanningImage, setScanningImage] = useState(false);
  const [acting, setActing] = useState(false);
  const locked = useRef(!!initialValue);
  const payload = classifyQrPayload(value);
  const requestCamera = async () => {
    setPermission('checking');
    try { setPermission(await request(cameraPermission())); } catch { setPermission(RESULTS.UNAVAILABLE); }
  };
  useEffect(() => { if (!initialValue) void requestCamera(); }, [initialValue]);
  useEffect(() => {
    if (permission !== RESULTS.BLOCKED) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void check(cameraPermission()).then(setPermission).catch(() => setPermission(RESULTS.UNAVAILABLE));
    });
    return () => subscription.remove();
  }, [permission]);
  const accept = (content: string) => {
    if (locked.current || !content.trim()) return;
    locked.current = true;
    setValue(content);
    setNotice(undefined);
  };
  const scanImage = async () => {
    if (scanningImage) return;
    setScanningImage(true);
    setNotice(undefined);
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
      if (result.didCancel) return;
      if (result.errorCode) throw new Error(result.errorMessage || result.errorCode);
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      const codes = await ImageCodeScanner.scan({ path: uri });
      if (codes[0]?.content) { locked.current = false; accept(codes[0].content); }
      else setNotice({ key: 'noQrInImage' });
    } catch (error) {
      setNotice({ key: 'imageScanFailed', values: { error: error instanceof Error ? error.message : String(error) } });
    } finally {
      setScanningImage(false);
    }
  };
  const ruleKind = payload.kind !== 'url' && payload.kind !== 'text' ? payload.kind : undefined;
  const act = async () => {
    if (acting) return;
    setActing(true);
    try {
      if (payload.kind === 'url' && expectedKind === 'bookSource') {
        const incoming = await importBookSourcesInput(payload.value), current = await loadSources();
        await saveSources(mergeBookSources(current, incoming));
        setNotice({ key: 'rulesImported', values: { count: incoming.length, type: t('qrBookSource') } });
      } else if (payload.kind === 'url' && expectedKind === 'rssSource') {
        const incoming = await importRssSourcesInput(payload.value);
        saveRssSources(mergeRssSources(loadRssSources(), incoming));
        setNotice({ key: 'rulesImported', values: { count: incoming.length, type: t('qrRssSource') } });
      } else if (payload.kind === 'url') await Linking.openURL(payload.value);
      else if (ruleKind) {
        const count = await importQrRules(ruleKind, payload.value), type = t(ruleKeys[ruleKind]);
        setNotice({ key: 'rulesImported', values: { count, type } });
        void jssdk.showToast({ type: 'success', title: t('rulesImported', { count, type }) });
      } else {
        Clipboard.setString(payload.value);
        setNotice({ key: 'contentCopied' });
      }
    } catch (error) {
      setNotice({ raw: error instanceof Error ? error.message : String(error) });
    } finally {
      setActing(false);
    }
  };
  const continueScanning = () => {
    locked.current = false;
    setValue('');
    setNotice(undefined);
    if (shouldRequestCameraOnContinue(permission)) void requestCamera();
  };
  const cameraReady = permission === RESULTS.GRANTED || permission === RESULTS.LIMITED;
  const permissionAction = qrPermissionAction(permission);
  const message = notice ? ('raw' in notice ? notice.raw : t(notice.key, notice.values)) : '';

  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('qrImport')} onBack={back} />
      {!value ? (
        <View style={s.flex}>
          {cameraReady ? <Camera style={s.camera} cameraType={CameraType.Back} scanBarcode onReadCode={event => accept(event.nativeEvent.codeStringValue)} showFrame /> : (
            <View style={s.center}>
              <Text style={{ color: colors.text, textAlign: 'center' }}>{permission === 'checking' ? t('checkingCameraPermission') : permission === RESULTS.UNAVAILABLE ? t('cameraUnavailable') : t('cameraPermissionMissing')}</Text>
              {permissionAction !== 'none' ? (
                <Pressable accessibilityRole="button" style={s.permissionButton} onPress={() => void (permissionAction === 'settings' ? openSettings('application') : requestCamera())}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t(permissionAction === 'settings' ? 'openSystemSettings' : 'requestPermissionAgain')}</Text></Pressable>
              ) : null}
            </View>
          )}
          {message ? <Text style={[s.scanMessage, { color: colors.danger }]}>{message}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: scanningImage }} disabled={scanningImage} style={[s.gallery, { backgroundColor: colors.surface, borderColor: colors.border }, scanningImage && s.disabled]} onPress={() => void scanImage()}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t(scanningImage ? 'scanningImage' : 'scanFromGallery')}</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.result}>
          <Text accessibilityRole="header" style={[s.kind, { color: colors.text }]}>{ruleKind ? t('qrRulesSummary', { type: t(ruleKeys[ruleKind]), count: payload.count ?? 0 }) : payload.kind === 'url' ? t('link') : t('textContent')}</Text>
          <Text selectable style={[s.value, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}>{payload.value}</Text>
          {message ? <Text style={[s.message, { color: colors.primary }]}>{message}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: acting }} disabled={acting} style={[s.primary, { backgroundColor: colors.primary }, acting && s.disabled]} onPress={() => void act()}><Text style={s.primaryText}>{ruleKind ? t('importNamed', { type: t(ruleKeys[ruleKind]) }) : payload.kind === 'url' && expectedKind ? t('importNamed', { type: t(expectedKind === 'bookSource' ? 'qrBookSource' : 'qrRssSource') }) : payload.kind === 'url' ? t('openLink') : t('copyContent')}</Text></Pressable>
          <Pressable accessibilityRole="button" style={s.again} onPress={continueScanning}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t('continueScanning')}</Text></Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 }, camera: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }, permissionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  gallery: { minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' }, scanMessage: { paddingHorizontal: 18, paddingVertical: 8, textAlign: 'center' }, disabled: { opacity: 0.42 },
  result: { padding: 22, gap: 16 }, kind: { fontSize: 20, fontWeight: '800' }, value: { padding: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, lineHeight: 21 }, message: { fontWeight: '700' },
  primary: { minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, again: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
