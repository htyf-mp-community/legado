import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import jssdk from '@htyf-mp/js-sdk';
import { PageHeader } from '../components/PageHeader';
import { clearAppLogs, exportAppLogs, loadAppLogs } from '../data/appLog';
import { clearHttpLogs, httpLogDetail, loadHttpLogs } from '../data/httpLog';
import { useAppTheme } from '../theme/AppTheme';

export function AppLogs({ back }: { back: () => void }) {
  const [logs, setLogs] = useState(loadAppLogs);
  const [httpLogs,setHttpLogs]=useState(loadHttpLogs),[kind,setKind]=useState<'app'|'http'>('app');
  const { colors, t } = useAppTheme();
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={`${t('logs')} (${kind==='app'?logs.length:httpLogs.length})`}
        onBack={back}
        action={(
          <View style={s.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('copy')} style={s.touch} onPress={() => { Clipboard.setString(kind==='app'?exportAppLogs(logs):httpLogs.map(httpLogDetail).join('\n\n')); void jssdk.showToast({ type: 'success', title: t('logsCopied') }); }}>
              <Text style={{ color: colors.primary }}>{t('copy')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('clear')} style={s.touch} onPress={() => { if(kind==='app'){clearAppLogs();setLogs([])}else{clearHttpLogs();setHttpLogs([])} }}>
              <Text style={{ color: colors.danger }}>{t('clear')}</Text>
            </Pressable>
          </View>
        )}
      />
      <View style={s.tabs}><Tab label={t('appLogsTab')} selected={kind==='app'} run={()=>setKind('app')}/><Tab label={t('httpLogsTab')} selected={kind==='http'} run={()=>setKind('http')}/></View>
      <ScrollView contentContainerStyle={s.list}>
        {kind==='app'?logs.slice().reverse().map(entry => (
          <View key={entry.id} style={[s.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.time, { color: colors.muted }]}>{new Date(entry.at).toLocaleString()}</Text>
            <Text selectable style={{ color: entry.level === 'error' ? colors.danger : colors.text }}>{entry.message}</Text>
            {entry.detail ? <Text selectable style={[s.detail, { color: colors.muted }]}>{entry.detail}</Text> : null}
          </View>
        )):httpLogs.map(entry=><View key={entry.id} style={[s.item,{backgroundColor:colors.surface,borderColor:colors.border}]}><Text style={[s.time,{color:colors.muted}]}>{new Date(entry.time).toLocaleString()} · {entry.duration}ms</Text><Text selectable style={{color:entry.error?colors.danger:colors.text,fontWeight:'700'}}>{entry.method} {entry.url} → {entry.statusCode}</Text><Text selectable style={[s.detail,{color:colors.muted}]}>{httpLogDetail(entry)}</Text></View>)}
        {!(kind==='app'?logs:httpLogs).length ? <Text style={[s.empty, { color: colors.muted }]}>{t('emptyLogs')}</Text> : null}
      </ScrollView>
    </View>
  );
}
function Tab({label,selected,run}:{label:string;selected:boolean;run:()=>void}){const{colors}=useAppTheme();return <Pressable accessibilityRole="tab" accessibilityState={{selected}} style={[s.tab,{borderColor:selected?colors.primary:colors.border}]} onPress={run}><Text style={{color:selected?colors.primary:colors.text,fontWeight:'700'}}>{label}</Text></Pressable>}

const s = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  tabs:{flexDirection:'row',gap:8,paddingHorizontal:14,paddingTop:10},
  tab:{minHeight:44,flex:1,borderWidth:1,borderRadius:22,alignItems:'center',justifyContent:'center'},
  touch: { minWidth: 52, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 14, gap: 10, paddingBottom: 40 },
  item: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6 },
  time: { fontSize: 12 },
  detail: { fontFamily: 'monospace', fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 60 },
});
