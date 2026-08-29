import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import jssdk from '@htyf-mp/js-sdk';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import { queryDictionary } from '../core/dictionary';
import { exportDictRules, loadDictRules, mergeDictRules, normalizeDictRule, parseDictRules, saveDictRules } from '../data/dictRules';
import type { DictRule } from '../types';
import { useAppTheme } from '../theme/AppTheme';

const emptyRule = (): DictRule => ({ name: '', urlRule: '', showRule: '', enabled: true, sortNumber: 0 });
export function DictRuleManager({ back }: { back: () => void }) {
  const { colors, t } = useAppTheme();
  const [rules, setRules] = useState(loadDictRules), [editing, setEditing] = useState<DictRule | null>(null),
    [originalName, setOriginalName] = useState(''), [word, setWord] = useState(''), [result, setResult] = useState(''),
    [running, setRunning] = useState(false), [remove, setRemove] = useState<DictRule | null>(null);
  const sorted = useMemo(() => [...rules].sort((a, b) => b.sortNumber - a.sortNumber || a.name.localeCompare(b.name)), [rules]);
  const commit = (next: DictRule[]) => { setRules(next); saveDictRules(next); };
  const toast = (type: 'success' | 'error', title: string, description?: string) => void jssdk.showToast({ type, title, description });
  const importRules = async () => {
    try { const incoming = parseDictRules(await Clipboard.getString()); commit(mergeDictRules(rules, incoming)); toast('success', t('ruleItemsImported',{count:incoming.length})); }
    catch (error) { toast('error', t('importFailed'), error instanceof Error ? error.message : String(error)); }
  };
  const save = () => {
    if (!editing) return;
    try {
      const normalized = normalizeDictRule(editing as unknown as Record<string, unknown>), base = originalName ? rules.filter(rule => rule.name !== originalName) : rules;
      commit(mergeDictRules(base, [normalized])); setEditing(null); toast('success', t('dictRuleSaved'));
    } catch (error) { toast('error', t('saveFailed'), error instanceof Error ? error.message : String(error)); }
  };
  const query = async (rule: DictRule) => {
    setRunning(true); setResult('');
    try { setResult((await queryDictionary(rule, word)) || t('dictionaryNoContent')); }
    catch (error) { setResult(error instanceof Error ? error.message : String(error)); }
    finally { setRunning(false); }
  };
  return <View style={[s.flex,{backgroundColor:colors.background}]}>
    <PageHeader title={t('dictRuleTitle',{count:rules.length})} onBack={back} action={<View style={s.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('exportDictRules')} style={s.touch} onPress={() => { Clipboard.setString(exportDictRules(rules)); toast('success', t('ruleCopied')); }}><Text style={[s.icon,{color:colors.primary}]}>⇧</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('importDictRules')} style={s.touch} onPress={() => void importRules()}><Text style={[s.icon,{color:colors.primary}]}>↓</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('createDictRule')} style={s.touch} onPress={() => { setOriginalName(''); setEditing(emptyRule()); }}><Text style={[s.icon,{color:colors.primary}]}>＋</Text></Pressable>
    </View>} />
    <View style={s.query}><TextInput accessibilityLabel={t('dictionaryQueryWord')} value={word} onChangeText={setWord} placeholder={t('dictionaryQueryPlaceholder')} placeholderTextColor={colors.muted} style={[s.input,{backgroundColor:colors.surface,color:colors.text}]} /></View>
    <ScrollView contentContainerStyle={s.list}>{sorted.map(rule => <View key={rule.name} style={[s.item,{borderColor:colors.border}]}>
      <Pressable accessibilityRole="button" accessibilityState={{disabled:running}} style={s.text} onPress={() => void query(rule)} disabled={running}><Text style={[s.name,{color:colors.text}]}>{rule.name}</Text><Text numberOfLines={1} style={[s.meta,{color:colors.muted}]}>{rule.urlRule}</Text></Pressable>
      <Switch accessibilityLabel={t('ruleEnabledNamed',{name:rule.name})} value={rule.enabled} onValueChange={enabled => commit(rules.map(item => item.name === rule.name ? { ...item, enabled } : item))} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('editNamed',{name:rule.name})} style={s.touch} onPress={() => { setOriginalName(rule.name); setEditing({ ...rule }); }}><Text style={[s.edit,{color:colors.primary}]}>✎</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('deleteNamed',{name:rule.name})} style={s.touch} onPress={() => setRemove(rule)}><Text style={[s.delete,{color:colors.danger}]}>×</Text></Pressable>
    </View>)}{!rules.length ? <Text style={[s.empty,{color:colors.muted}]}>{t('noDictRules')}</Text> : null}</ScrollView>
    {(running || result) ? <InTreeSheet visible onDismiss={() => !running && setResult('')}><Text style={[s.sheetTitle,{color:colors.text}]}>{t('dictionaryQuery')}</Text>{running ? <ActivityIndicator style={s.loading} /> : <ScrollView style={s.result}><Text selectable style={{color:colors.text}}>{result}</Text></ScrollView>}</InTreeSheet> : null}
    <InTreeSheet visible={!!editing} onDismiss={() => setEditing(null)}>{editing ? <ScrollView keyboardShouldPersistTaps="handled"><Text style={[s.sheetTitle,{color:colors.text}]}>{t('editDictRule')}</Text>
      <Field label={t('name')} value={editing.name} change={name => setEditing({ ...editing, name })} />
      <Field label={t('requestRule')} value={editing.urlRule} change={urlRule => setEditing({ ...editing, urlRule })} multiline />
      <Field label={t('displayRule')} value={editing.showRule} change={showRule => setEditing({ ...editing, showRule })} multiline />
      <Field label={t('sort')} value={String(editing.sortNumber)} change={value => setEditing({ ...editing, sortNumber: Number(value) || 0 })} />
      <Pressable accessibilityRole="button" style={[s.primary,{backgroundColor:colors.primary}]} onPress={save}><Text style={s.primaryText}>{t('save')}</Text></Pressable></ScrollView> : null}</InTreeSheet>
    <InTreeSheet visible={!!remove} onDismiss={() => setRemove(null)}><Text style={[s.sheetTitle,{color:colors.text}]}>{t('deleteDictRuleTitle')}</Text><Text style={[s.removeName,{color:colors.text}]}>{remove?.name}</Text><Pressable accessibilityRole="button" style={[s.danger,{backgroundColor:colors.danger}]} onPress={() => { if (remove) commit(rules.filter(rule => rule.name !== remove.name)); setRemove(null); }}><Text style={s.primaryText}>{t('delete')}</Text></Pressable></InTreeSheet>
  </View>;
}
function Field({ label, value, change, multiline = false }: { label: string; value: string; change: (value: string) => void; multiline?: boolean }) {
  const{colors}=useAppTheme();return <View style={s.field}><Text style={[s.label,{color:colors.text}]}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} multiline={multiline} style={[s.fieldInput,{borderColor:colors.border,color:colors.text}, multiline && s.multiline]} /></View>;
}
const s = StyleSheet.create({ flex:{flex:1},row:{flexDirection:'row'},touch:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},icon:{fontSize:23},query:{padding:12},input:{height:46,borderRadius:23,paddingHorizontal:18},list:{paddingHorizontal:12,paddingBottom:24},item:{minHeight:72,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth},text:{flex:1,gap:5},name:{fontSize:16,fontWeight:'700'},meta:{fontSize:12},edit:{fontSize:21},delete:{fontSize:28},empty:{textAlign:'center',marginTop:60,fontSize:16},sheetTitle:{fontSize:20,fontWeight:'700',marginBottom:14},loading:{marginVertical:30},result:{maxHeight:380},field:{marginBottom:13},label:{fontWeight:'600',marginBottom:6},fieldInput:{minHeight:46,borderWidth:1,borderRadius:10,paddingHorizontal:12,paddingVertical:10},multiline:{minHeight:100,textAlignVertical:'top'},primary:{minHeight:48,borderRadius:24,alignItems:'center',justifyContent:'center',marginTop:8},primaryText:{color:'#fff',fontWeight:'700'},removeName:{marginBottom:18},danger:{minHeight:48,borderRadius:24,alignItems:'center',justifyContent:'center'} });
