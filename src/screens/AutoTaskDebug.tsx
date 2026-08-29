import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PageHeader } from '../components/PageHeader';
import { runAutoTask } from '../core/autoTask';
import { loadAutoTasks } from '../data/autoTasks';
import { useAppTheme } from '../theme/AppTheme';

export function AutoTaskDebug({ taskId, back }: { taskId: string; back: () => void }) {
  const { colors, t } = useAppTheme(), task = loadAutoTasks().find(item => item.id === taskId);
  const [output, setOutput] = useState(''), [running, setRunning] = useState(false);
  const run = async () => { if (!task || running) return; setRunning(true); setOutput(t('runningNamedTask', { name: task.name })); try { const result = await runAutoTask(task); setOutput(result.log); } finally { setRunning(false); } };
  useEffect(() => { void run(); }, []);
  return <View style={[s.flex, { backgroundColor: colors.background }]}><PageHeader title={t('debugTask')} onBack={back} /><View style={s.heading}><Text style={[s.name, { color: colors.text }]}>{task?.name ?? t('taskNotFound')}</Text><Pressable accessibilityRole="button" accessibilityState={{ disabled: !task || running }} disabled={!task || running} style={[s.run, { backgroundColor: colors.primary }, (!task || running) && s.disabled]} onPress={() => void run()}><Text style={s.runText}>{t('runAgain')}</Text></Pressable></View><ScrollView contentContainerStyle={s.output}>{running ? <ActivityIndicator color={colors.primary} /> : null}<Text selectable style={[s.log, { color: colors.text }]}>{output}</Text></ScrollView></View>;
}
const s = StyleSheet.create({ flex: { flex: 1 }, heading: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, name: { fontSize: 18, fontWeight: '800', flex: 1 }, run: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center' }, runText: { color: '#fff', fontWeight: '700' }, disabled: { opacity: 0.42 }, output: { padding: 16, gap: 12 }, log: { fontFamily: 'monospace', lineHeight: 21 } });
