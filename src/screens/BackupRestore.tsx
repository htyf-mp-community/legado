import { useState } from 'react';
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
import Clipboard from '@react-native-clipboard/clipboard';
import { errorCodes, isErrorWithCode, pick } from '@react-native-documents/picker';
import jssdk from '@htyf-mp/js-sdk';
import { InTreeSheet } from '../components/InTreeSheet';
import { PageHeader } from '../components/PageHeader';
import {
  createBackup,
  parseBackup,
  restoreBackup,
  type BackupPayload,
} from '../data/backup';
import {
  downloadWebDavBackup,
  downloadWebDavBackupEntry,
  listWebDavBackups,
  loadWebDavConfig,
  saveWebDavConfig,
  testWebDav,
  uploadWebDavBackup,
  type WebDavCredentials,
  type RemoteBackupEntry,
} from '../data/remoteBackup';
import { activateLegacyMedia, commitLegacyMedia, discardLegacyMedia, inspectLegacyBackupArchive, type LegacyMediaPlan } from '../core/legacyBackupArchive';
import { inspectBackupArchive, saveBackupArchive } from '../core/backupArchive';
import { useAppTheme } from '../theme/AppTheme';
import { backupCategories, loadBackupPreferences, saveBackupPreferences, type BackupCategory } from '../data/backupPreferences';

const backupCategoryLabel:Record<BackupCategory,'backupBookshelf'|'backupAnnotations'|'backupSources'|'backupRules'|'backupHistory'|'backupSettings'|'backupCookies'|'backupSourceVariables'>={bookshelf:'backupBookshelf',annotations:'backupAnnotations',sources:'backupSources',rules:'backupRules',history:'backupHistory',settings:'backupSettings',cookies:'backupCookies',sourceVariables:'backupSourceVariables'};

export function BackupRestore({
  back,
  onRestored,
  openDirectLink,
}: {
  back: () => void;
  onRestored: () => Promise<void>;
  openDirectLink: () => void;
}) {
  const { colors, t } = useAppTheme();
  const [pending, setPending] = useState<{
    raw: string;
    payload: BackupPayload;
    legacyFiles?: string[];
    warnings?: string[];
    mediaPlan?: LegacyMediaPlan;
  } | null>(null);
  const [webDav, setWebDav] = useState<WebDavCredentials>(loadWebDavConfig);
  const [backupPreferences,setBackupPreferences]=useState(loadBackupPreferences);
  const [legacyPassword, setLegacyPassword] = useState('');
  const [running, setRunning] = useState('');
  const [remoteBackups,setRemoteBackups]=useState<RemoteBackupEntry[]|null>(null);
  const exportToClipboard = () => {
    try {
      const raw = createBackup();
      Clipboard.setString(raw);
      void jssdk.showToast({ type: 'success', title: t('fullBackupCopied') });
    } catch (error) {
      void jssdk.showToast({
        type: 'error',
        title: t('backupFailed'),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const inspectClipboard = async () => {
    try {
      const raw = await Clipboard.getString();
      setPending({ raw, payload: parseBackup(raw) });
    } catch (error) {
      void jssdk.showToast({
        type: 'error',
        title: t('cannotImportBackup'),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const confirmRestore = async () => {
    if (!pending) return;
    const current = pending;
    let committed = false;
    try {
      if (current.mediaPlan) await activateLegacyMedia(current.mediaPlan);
      restoreBackup(current.raw);
      if (current.mediaPlan) await commitLegacyMedia(current.mediaPlan);
      committed = true;
      setPending(null);
      await onRestored();
      void jssdk.showToast({ type: 'success', title: t('restoreComplete') });
    } catch (error) {
      if (!committed && current.mediaPlan) await discardLegacyMedia(current.mediaPlan);
      void jssdk.showToast({
        type: 'error',
        title: t('restoreFailed'),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const inspectLegacyBackup = async () => {
    setRunning(t('readingLegacyBackup'));
    try {
      const files = await pick({ type: ['application/zip'], allowMultiSelection: false, mode: 'import' }),
        file = files[0], preview = await inspectLegacyBackupArchive(file.uri, file.name ?? 'backup.zip', legacyPassword),
        raw = JSON.stringify(preview.payload);
      setPending({ raw, payload: preview.payload, legacyFiles: preview.importedFiles, warnings: preview.warnings, mediaPlan: preview.mediaPlan });
    } catch (error) {
      if (!(isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED))
        void jssdk.showToast({ type: 'error', title: t('cannotReadLegacyBackup'), description: error instanceof Error ? error.message : String(error) });
    } finally { setRunning(''); }
  };
  const saveZip = async () => { setRunning(t('creatingZipBackup')); try { await saveBackupArchive(); void jssdk.showToast({type:'success',title:t('backupSaved')}); } catch(error) { if (!(isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED)) void jssdk.showToast({type:'error',title:t('saveBackupFailed'),description:error instanceof Error?error.message:String(error)}); } finally { setRunning(''); } };
  const inspectHtyfZip = async () => { setRunning(t('readingZipBackup')); try { const files=await pick({type:['application/zip'],allowMultiSelection:false,mode:'import'}),file=files[0],preview=await inspectBackupArchive(file.uri,file.name??'backup.zip'); setPending(preview); } catch(error) { if (!(isErrorWithCode(error)&&error.code===errorCodes.OPERATION_CANCELED)) void jssdk.showToast({type:'error',title:t('cannotReadBackup'),description:error instanceof Error?error.message:String(error)}); } finally { setRunning(''); } };
  const remoteAction = async (
    name: string,
    action: (config: WebDavCredentials) => Promise<void>,
  ) => {
    setRunning(name);
    try {
      const config = saveWebDavConfig(webDav);
      setWebDav(config);
      await action(config);
      void jssdk.showToast({ type: 'success', title: t('actionSuccess',{name}) });
    } catch (error) {
      void jssdk.showToast({
        type: 'error',
        title: t('actionFailed',{name}),
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRunning('');
    }
  };
  return (
    <View style={[s.flex,{backgroundColor:colors.background}]}>
      <PageHeader title={t('backupRestore')} onBack={back} />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={[s.title,{color:colors.text}]}>{t('fullLocalData')}</Text>
        <Text style={[s.description,{color:colors.muted}]}>{t('backupDescription')}</Text>
        <Text style={[s.title,{color:colors.text}]}>{t('backupContent')}</Text>
        {backupCategories.map(category=><View key={category} style={[s.switchRow,{borderColor:colors.border}]}><Text style={[s.switchLabel,{color:colors.text}]}>{t(backupCategoryLabel[category])}</Text><Switch accessibilityLabel={t(backupCategoryLabel[category])} value={backupPreferences.categories[category]} onValueChange={enabled=>setBackupPreferences(saveBackupPreferences({...backupPreferences,categories:{...backupPreferences.categories,[category]:enabled}}))}/></View>)}
        <View style={[s.switchRow,{borderColor:colors.border}]}><Text style={[s.switchLabel,{color:colors.text}]}>{t('automaticBackup')}</Text><Switch accessibilityLabel={t('automaticBackup')} value={backupPreferences.autoBackup} onValueChange={autoBackup=>setBackupPreferences(saveBackupPreferences({...backupPreferences,autoBackup}))}/></View>
        <View style={[s.switchRow,{borderColor:colors.border}]}><Text style={[s.switchLabel,{color:colors.text}]}>{t('checkNewRemoteBackup')}</Text><Switch accessibilityLabel={t('checkNewRemoteBackup')} value={backupPreferences.autoCheckNewBackup} onValueChange={autoCheckNewBackup=>setBackupPreferences(saveBackupPreferences({...backupPreferences,autoCheckNewBackup}))}/></View>
        <View style={[s.switchRow,{borderColor:colors.border}]}><Text style={[s.switchLabel,{color:colors.text}]}>{t('onlyLatestBackup')}</Text><Switch accessibilityLabel={t('onlyLatestBackup')} value={backupPreferences.onlyLatest} onValueChange={onlyLatest=>setBackupPreferences(saveBackupPreferences({...backupPreferences,onlyLatest}))}/></View>
        <Pressable accessibilityRole="button" style={s.primary} onPress={exportToClipboard}>
          <Text style={s.primaryText}>{t('copyFullBackup')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!!running} style={s.primary} onPress={() => void saveZip()}>
          <Text style={s.primaryText}>{t('saveZipBackup')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={[s.secondary, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => void inspectClipboard()}>
          <Text style={[s.secondaryText,{color:colors.text}]}>{t('restoreClipboard')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!!running} style={[s.secondary, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => void inspectLegacyBackup()}>
          <Text style={[s.secondaryText,{color:colors.text}]}>{t('importAndroidBackup')}</Text>
        </Pressable>
        <TextInput accessibilityLabel={t('legacyPassword')} secureTextEntry placeholder={t('legacyPasswordHint')} placeholderTextColor={colors.muted} value={legacyPassword} onChangeText={setLegacyPassword} style={[s.input,{color:colors.text,borderColor:colors.border}]} />
        <Pressable accessibilityRole="button" disabled={!!running} style={[s.secondary, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => void inspectHtyfZip()}>
          <Text style={[s.secondaryText,{color:colors.text}]}>{t('restoreHtyfZip')}</Text>
        </Pressable>
        <Text style={[s.warning,{color:colors.danger}]}>{t('restoreWarning')}</Text>
        <View style={[s.divider,{backgroundColor:colors.border}]} />
        <Text style={[s.title,{color:colors.text}]}>WebDAV</Text>
        <Text style={[s.description,{color:colors.muted}]}>{t('webDavHelp')}</Text>
        <Field
          label={t('serverUrl')}
          value={webDav.url}
          placeholder="https://dav.example.com/"
          onChange={url => setWebDav(value => ({ ...value, url }))}
        />
        <Field
          label={t('account')}
          value={webDav.username}
          onChange={username => setWebDav(value => ({ ...value, username }))}
        />
        <Field
          label={t('appPassword')}
          value={webDav.password}
          secure
          onChange={password => setWebDav(value => ({ ...value, password }))}
        />
        <Field
          label={t('remoteDirectory')}
          value={webDav.directory}
          placeholder="legado"
          onChange={directory => setWebDav(value => ({ ...value, directory }))}
        />
        <Field label={t('webDavDeviceName')} value={backupPreferences.deviceName} onChange={deviceName=>setBackupPreferences(saveBackupPreferences({...backupPreferences,deviceName}))}/>
        <View style={[s.switchRow,{borderColor:colors.border}]}><Text style={[s.switchLabel,{color:colors.text}]}>{t('syncBookProgress')}</Text><Switch accessibilityLabel={t('syncBookProgress')} value={backupPreferences.syncBookProgress} onValueChange={syncBookProgress=>setBackupPreferences(saveBackupPreferences({...backupPreferences,syncBookProgress,syncBookProgressPlus:syncBookProgress?backupPreferences.syncBookProgressPlus:false}))}/></View>
        <View style={[s.switchRow,{borderColor:colors.border,opacity:backupPreferences.syncBookProgress?1:.5}]}><Text style={[s.switchLabel,{color:colors.text}]}>{t('syncBookProgressPlus')}</Text><Switch accessibilityLabel={t('syncBookProgressPlus')} disabled={!backupPreferences.syncBookProgress} value={backupPreferences.syncBookProgressPlus} onValueChange={syncBookProgressPlus=>setBackupPreferences(saveBackupPreferences({...backupPreferences,syncBookProgressPlus}))}/></View>
        <View style={[s.switchRow,{borderColor:colors.border}]}><Text style={[s.switchLabel,{color:colors.text}]}>{t('webDavBookAutoRestore')}</Text><Switch accessibilityLabel={t('webDavBookAutoRestore')} value={backupPreferences.webDavBookAutoRestore} onValueChange={webDavBookAutoRestore=>setBackupPreferences(saveBackupPreferences({...backupPreferences,webDavBookAutoRestore}))}/></View>
        <Text style={[s.secretNote,{color:colors.muted}]}>{t('secretNote')}</Text>
        {running ? <ActivityIndicator /> : null}
        <View style={s.remoteActions}>
          <Pressable accessibilityRole="button"
            disabled={!!running}
            style={[s.secondary, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() =>
              void remoteAction(t('connectionTest'), config => testWebDav(config))
            }
          >
            <Text style={[s.secondaryText,{color:colors.text}]}>{t('test')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button"
            disabled={!!running}
            style={[s.secondary, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() =>
              void remoteAction(t('uploadBackup'), config =>
                uploadWebDavBackup(config, createBackup()),
              )
            }
          >
            <Text style={[s.secondaryText,{color:colors.text}]}>{t('upload')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button"
            disabled={!!running}
            style={[s.secondary, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() =>
              void remoteAction(t('downloadBackup'), async config => {
                const raw = await downloadWebDavBackup(config);
                setPending({ raw, payload: parseBackup(raw) });
              })
            }
          >
            <Text style={[s.secondaryText,{color:colors.text}]}>{t('download')}</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" disabled={!!running} style={[s.secondary,{backgroundColor:colors.surface,borderColor:colors.border}]} onPress={()=>void remoteAction(t('browseRemoteBackups'),async config=>setRemoteBackups(await listWebDavBackups(config)))}><Text style={[s.secondaryText,{color:colors.text}]}>{t('browseRemoteBackups')}</Text></Pressable>
        <Pressable accessibilityRole="button" style={[s.secondary, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={openDirectLink}>
          <Text style={[s.secondaryText,{color:colors.text}]}>{t('configureDirectLink')}</Text>
        </Pressable>
      </ScrollView>
      <InTreeSheet visible={!!pending} onDismiss={() => { const plan=pending?.mediaPlan;setPending(null);if(plan)void discardLegacyMedia(plan); }}>
        <Text style={[s.sheetTitle,{color:colors.text}]}>{t('confirmRestore')}</Text>
        <Text style={[s.description,{color:colors.muted}]}>
          {pending
            ? t('backupSummary',{date:new Date(pending.payload.createdAt).toLocaleString(),count:Object.keys(pending.payload.entries).length})
            : ''}
        </Text>
        {pending?.legacyFiles?<Text style={[s.description,{color:colors.muted}]}>{t('recognizedFiles',{files:pending.legacyFiles.join(', ')})}</Text>:null}
        {pending?.warnings?.map(message=><Text key={message} style={[s.warning,{color:colors.danger}]}>{message}</Text>)}
        <View style={s.actions}>
          <Pressable accessibilityRole="button" style={[s.secondary, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => { const plan=pending?.mediaPlan;setPending(null);if(plan)void discardLegacyMedia(plan); }}>
            <Text style={[s.secondaryText,{color:colors.text}]}>{t('cancel')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={s.danger} onPress={() => void confirmRestore()}>
            <Text style={s.primaryText}>{t('replaceAndRestore')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
      <InTreeSheet visible={remoteBackups!==null} onDismiss={()=>setRemoteBackups(null)}><Text style={[s.sheetTitle,{color:colors.text}]}>{t('remoteBackups')}</Text>{remoteBackups?.length?remoteBackups.map(entry=><Pressable accessibilityRole="button" key={entry.url} style={[s.remoteEntry,{borderColor:colors.border}]} onPress={()=>void remoteAction(t('downloadBackup'),async config=>{const raw=await downloadWebDavBackupEntry(config,entry);setRemoteBackups(null);setPending({raw,payload:parseBackup(raw)})})}><Text style={{color:colors.text,fontWeight:'700'}}>{entry.name}</Text><Text style={{color:colors.muted}}>{new Date(entry.modifiedAt).toLocaleString()}</Text></Pressable>):<Text style={{color:colors.muted}}>{t('noRemoteBackups')}</Text>}</InTreeSheet>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secure = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secure?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.muted}
        style={[s.input, { color: colors.text, borderColor: colors.border }]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 20, fontWeight: '700', color: '#222' },
  description: { fontSize: 15, lineHeight: 23, color: '#666' },
  switchRow:{minHeight:54,borderBottomWidth:StyleSheet.hairlineWidth,flexDirection:'row',alignItems:'center',gap:12},
  switchLabel:{flex:1},
  remoteEntry:{minHeight:58,borderBottomWidth:StyleSheet.hairlineWidth,justifyContent:'center',gap:3},
  primary: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#285d42',
  },
  secondary: {
    minHeight: 48,
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#eee',
  },
  danger: {
    minHeight: 48,
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a13b3b',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryText: { color: '#333', fontWeight: '700' },
  warning: { color: '#a13b3b', fontSize: 13 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ccc',
    marginVertical: 10,
  },
  label: { color: '#333', fontWeight: '600', marginBottom: 6 },
  input: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#aaa',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  secretNote: { color: '#777', fontSize: 12, lineHeight: 18 },
  remoteActions: { flexDirection: 'row', gap: 8 },
});
