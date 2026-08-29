import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { insertKeyboardAssist, loadKeyboardAssistLines, loadKeyboardAssists, type TextSelection } from '../data/keyboardAssists';
import { useAppTheme } from '../theme/AppTheme';

export function KeyboardAssistInput({ value, onChangeText, manage, style, ...props }: TextInputProps & { value: string; onChangeText: (value: string) => void; manage?: () => void }) {
  const { colors, t } = useAppTheme(), [focused, setFocused] = useState(false), [selection, setSelection] = useState<TextSelection>({ start: value.length, end: value.length }), [revision, setRevision] = useState(0), history = useRef<string[]>([value]), future = useRef<string[]>([]), lastEmitted = useRef(value);
  const navigation = useNavigation();
  useEffect(() => { if (value === lastEmitted.current) return; history.current = [value]; future.current = []; lastEmitted.current = value; setSelection({ start: value.length, end: value.length }); }, [value]);
  const emit = (next: string) => { lastEmitted.current = next; onChangeText(next); };
  const change = (next: string) => { if (next !== value) { history.current.push(next); if (history.current.length > 100) history.current.shift(); future.current = []; } emit(next); };
  const undo = () => { if (history.current.length < 2) return; const current = history.current.pop()!; future.current.push(current); emit(history.current.at(-1) ?? ''); setRevision(x => x + 1); };
  const redo = () => { const next = future.current.pop(); if (next === undefined) return; history.current.push(next); emit(next); setRevision(x => x + 1); };
  const insert = (snippet: string) => { const result = insertKeyboardAssist(value, selection, snippet); change(result.text); setSelection(result.selection); setRevision(x => x + 1); };
  const assists = focused ? loadKeyboardAssists().filter(item => item.type === 0) : [], lines = loadKeyboardAssistLines();
  const openManager = manage ?? (() => navigation.navigate('KeyboardAssists' as never));
  return <View><TextInput {...props} accessibilityLabel={props.accessibilityLabel} key={`assist-${revision}`} value={value} onChangeText={change} selection={selection} onSelectionChange={event => setSelection(event.nativeEvent.selection)} onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }} style={style} />{focused ? <View style={[s.bar, { borderColor: colors.border, backgroundColor: colors.surface }]}><ScrollView horizontal={lines === 1} keyboardShouldPersistTaps="always" contentContainerStyle={[s.tools, lines > 1 && s.wrap, { maxHeight: lines * 44 }]}><Tool label="↩" hint={t('undo')} run={undo} /><Tool label="↪" hint={t('redo')} run={redo} />{assists.map(item => <Tool key={`${item.type}:${item.key}`} label={item.key} hint={item.value} run={() => insert(item.value)} />)}<Tool label="⚙" hint={t('keyboardAssistConfig')} run={openManager} /></ScrollView></View> : null}</View>;
}
function Tool({ label, hint, run }: { label: string; hint: string; run: () => void }) { const { colors } = useAppTheme(); return <Pressable accessibilityRole="button" accessibilityLabel={hint} style={[s.tool, { borderColor: colors.border }]} onPress={run}><Text numberOfLines={1} style={{ color: colors.text }}>{label}</Text></Pressable>; }
const s = StyleSheet.create({ bar:{borderWidth:StyleSheet.hairlineWidth,borderRadius:8,marginTop:4},tools:{gap:6,padding:4},wrap:{flexDirection:'row',flexWrap:'wrap'},tool:{height:40,minWidth:44,paddingHorizontal:10,borderWidth:1,borderRadius:8,alignItems:'center',justifyContent:'center'} });
