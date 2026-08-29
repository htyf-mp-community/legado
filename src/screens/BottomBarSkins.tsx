import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import jssdk from '@htyf-mp/js-sdk';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import { useAppTheme } from '../theme/AppTheme';
import { deleteBottomBarSkinAssets, discardBottomBarSkinStage, exportBottomBarSkin, persistBottomBarSkin, pickAndStageBottomBarSkin, type BottomBarSkinStage } from '../core/bottomBarSkinArchive';
import { BOTTOM_BAR_SKIN_SLOTS, inferBottomBarSkinAssignments, loadActiveBottomBarSkinName, loadBottomBarSkins, saveActiveBottomBarSkinName, saveBottomBarSkins, type BottomBarSkin, type BottomBarSkinAssignment, type BottomBarSkinSlot } from '../data/bottomBarSkins';

type PickTarget = { slot: BottomBarSkinSlot; state: keyof BottomBarSkinAssignment };

export function BottomBarSkins({ back, changed }: { back: () => void; changed: () => void }) {
  const { colors, t } = useAppTheme();
  const [skins, setSkins] = useState(loadBottomBarSkins), [active, setActive] = useState(loadActiveBottomBarSkinName), [stage, setStage] = useState<BottomBarSkinStage>(), [editing, setEditing] = useState<BottomBarSkin>(), [name, setName] = useState(''), [assignments, setAssignments] = useState<Partial<Record<BottomBarSkinSlot, BottomBarSkinAssignment>>>({}), [picker, setPicker] = useState<PickTarget>(), [removing, setRemoving] = useState<BottomBarSkin>(), [busy, setBusy] = useState('');
  const paletteImages = stage?.images ?? [...new Set(Object.values(assignments).flatMap(item => item ? [item.selected, item.normal].filter((value): value is string => !!value) : []))];
  useEffect(() => () => { if (stage) void discardBottomBarSkinStage(stage); }, [stage]);
  const toast = (type: 'success' | 'error', title: string, description?: string) => void jssdk.showToast({ type, title, description });
  const importZip = async () => {
    setBusy(t('readingSkinZip'));
    try {
      if (stage) await discardBottomBarSkinStage(stage);
      const next = await pickAndStageBottomBarSkin();
      setStage(next); setEditing(undefined); setAssignments(inferBottomBarSkinAssignments(next.images)); setName('skin');
    } catch (error) { toast('error', t('bottomBarSkinImportFailed'), error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  };
  const save = async () => {
    if ((!stage && !editing) || !name.trim()) return;
    setBusy(t('savingBottomBarSkin'));
    try {
      const skin = await persistBottomBarSkin(name, assignments, skins, editing?.name), next = saveBottomBarSkins([...skins.filter(item => item.name !== editing?.name), skin]);
      saveActiveBottomBarSkinName(skin.name); setSkins(next); setActive(skin.name); changed();
      if (stage) await discardBottomBarSkinStage(stage); setStage(undefined); setEditing(undefined); setAssignments({}); setName('');
      toast('success', t('bottomBarSkinSaved'));
    } catch (error) { toast('error', t('bottomBarSkinSaveFailed'), error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  };
  const activate = (value: string) => { saveActiveBottomBarSkinName(value); setActive(value); changed(); };
  const edit = (skin: BottomBarSkin) => { setEditing(skin); setName(skin.name); setAssignments(skin.assignments); setStage(undefined); };
  const remove = async () => {
    if (!removing) return;
    await deleteBottomBarSkinAssets(removing);
    const next = saveBottomBarSkins(skins.filter(item => item.name !== removing.name));
    setSkins(next); if (active === removing.name) { setActive(''); changed(); } setRemoving(undefined);
  };
  return <View style={[s.flex, { backgroundColor: colors.background }]}>
    <PageHeader title={t('bottomBarSkins')} onBack={back} />
    <ScrollView contentContainerStyle={s.content}>
      <Text style={{ color: colors.muted }}>{t('bottomBarSkinHelp')}</Text>
      <Pressable accessibilityRole="button" disabled={!!busy} style={[s.primary, { backgroundColor: colors.primary }]} onPress={() => void importZip()}><Text style={s.primaryText}>{busy || t('importBottomBarSkin')}</Text></Pressable>
      <SkinRow name={t('defaultBottomBar')} selected={!active} colors={colors} activate={() => activate('')} />
      {skins.map(skin => <View key={skin.name} style={[s.row, { borderColor: colors.border }]}>
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: active === skin.name }} style={s.skinMain} onPress={() => activate(skin.name)}>
          <View style={s.previewRow}>{BOTTOM_BAR_SKIN_SLOTS.map(slot => skin.assignments[slot]?.selected ? <Image key={slot} source={{ uri: `file://${skin.assignments[slot]!.selected}` }} style={s.preview} /> : null)}</View>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{skin.name}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('editNamed', { name: skin.name })} style={s.icon} onPress={() => edit(skin)}><Text style={{ color: colors.primary }}>✎</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('exportBottomBarSkin', { name: skin.name })} style={s.icon} onPress={() => void exportBottomBarSkin(skin).then(() => toast('success', t('bottomBarSkinZipSaved'))).catch(error => toast('error', t('bottomBarSkinExportFailed'), String(error)))}><Text style={{ color: colors.primary }}>⇧</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('deleteBottomBarSkinNamed', { name: skin.name })} style={s.icon} onPress={() => setRemoving(skin)}><Text style={{ color: colors.danger }}>×</Text></Pressable>
      </View>)}
    </ScrollView>
    <InTreeSheet visible={!!stage || !!editing} onDismiss={() => { if (stage) void discardBottomBarSkinStage(stage); setStage(undefined); setEditing(undefined); }}>
      <Text style={[s.title, { color: colors.text }]}>{t('assignBottomBarImages')}</Text>
      <TextInput accessibilityLabel={t('bottomBarSkinName')} value={name} onChangeText={setName} placeholder={t('bottomBarSkinName')} placeholderTextColor={colors.muted} style={[s.input, { color: colors.text, borderColor: colors.border }]} />
      <ScrollView style={s.assignList}>{BOTTOM_BAR_SKIN_SLOTS.map(slot => <View key={slot} style={[s.assignRow, { borderColor: colors.border }]}><Text style={[s.slot, { color: colors.text }]}>{t(slot === 'bookshelf' ? 'tabSlotBookshelf' : slot === 'home' ? 'tabSlotExplore' : slot === 'notes' ? 'tabSlotRss' : 'tabSlotMine')}</Text><ImageChoice label={t('selectedImage')} uri={assignments[slot]?.selected} colors={colors} choose={() => setPicker({ slot, state: 'selected' })} /><ImageChoice label={t('normalImageOptional')} uri={assignments[slot]?.normal} colors={colors} choose={() => setPicker({ slot, state: 'normal' })} clear={() => setAssignments(old => ({ ...old, [slot]: old[slot] ? { ...old[slot]!, normal: undefined } : undefined }))} /></View>)}</ScrollView>
      <Pressable accessibilityRole="button" disabled={!name.trim() || !Object.values(assignments).some(item => item?.selected) || !!busy} style={[s.primary, { backgroundColor: colors.primary }]} onPress={() => void save()}><Text style={s.primaryText}>{busy || t('saveAndEnable')}</Text></Pressable>
    </InTreeSheet>
    <InTreeSheet visible={!!picker} onDismiss={() => setPicker(undefined)}><Text style={[s.title, { color: colors.text }]}>{t('chooseBottomBarImage')}</Text><ScrollView contentContainerStyle={s.palette}>{paletteImages.map(path => <Pressable accessibilityRole="button" accessibilityLabel={path.split('/').pop()} key={path} style={[s.paletteItem, { borderColor: colors.border }]} onPress={() => { if (picker) setAssignments(old => ({ ...old, [picker.slot]: { selected: picker.state === 'selected' ? path : old[picker.slot]?.selected ?? '', normal: picker.state === 'normal' ? path : old[picker.slot]?.normal } })); setPicker(undefined); }}><Image source={{ uri: `file://${path}` }} style={s.paletteImage} /><Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>{path.split('/').pop()}</Text></Pressable>)}</ScrollView></InTreeSheet>
    <InTreeSheet visible={!!removing} onDismiss={() => setRemoving(undefined)}><Text style={[s.title, { color: colors.text }]}>{t('deleteBottomBarSkin')}</Text><Text style={{ color: colors.muted }}>{removing?.name}</Text><Pressable accessibilityRole="button" style={[s.primary, { backgroundColor: colors.danger }]} onPress={() => void remove()}><Text style={s.primaryText}>{t('delete')}</Text></Pressable></InTreeSheet>
  </View>;
}

function SkinRow({ name, selected, colors, activate }: { name: string; selected: boolean; colors: { text: string; border: string; primary: string }; activate: () => void }) { return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} style={[s.row, { borderColor: selected ? colors.primary : colors.border }]} onPress={activate}><Text style={{ color: colors.text, fontWeight: '700' }}>{selected ? '● ' : '○ '}{name}</Text></Pressable>; }
function ImageChoice({ label, uri, colors, choose, clear }: { label: string; uri?: string; colors: { text: string; border: string; primary: string; danger: string }; choose: () => void; clear?: () => void }) { return <View style={s.choice}><Pressable accessibilityRole="button" style={[s.choiceButton, { borderColor: colors.border }]} onPress={choose}>{uri ? <Image source={{ uri: `file://${uri}` }} style={s.choiceImage} /> : null}<Text style={{ color: colors.primary }}>{label}</Text></Pressable>{uri && clear ? <Pressable accessibilityRole="button" style={s.clear} onPress={clear}><Text style={{ color: colors.danger }}>×</Text></Pressable> : null}</View>; }
const s = StyleSheet.create({ flex:{flex:1},content:{padding:20,gap:12,paddingBottom:40},primary:{minHeight:48,borderRadius:24,alignItems:'center',justifyContent:'center',paddingHorizontal:20},primaryText:{color:'#fff',fontWeight:'700'},row:{minHeight:60,borderWidth:1,borderRadius:12,padding:10,flexDirection:'row',alignItems:'center',gap:8},skinMain:{flex:1,minHeight:44,justifyContent:'center'},previewRow:{flexDirection:'row',gap:6},preview:{width:28,height:28,resizeMode:'contain'},icon:{width:44,height:44,alignItems:'center',justifyContent:'center'},title:{fontSize:20,fontWeight:'800'},input:{minHeight:48,borderWidth:1,borderRadius:10,paddingHorizontal:12},assignList:{maxHeight:430},assignRow:{borderBottomWidth:StyleSheet.hairlineWidth,paddingVertical:10,gap:8},slot:{fontWeight:'700'},choice:{flexDirection:'row',alignItems:'center'},choiceButton:{minHeight:52,flex:1,borderWidth:1,borderRadius:10,padding:6,flexDirection:'row',alignItems:'center',gap:10},choiceImage:{width:40,height:40,resizeMode:'contain'},clear:{width:44,height:44,alignItems:'center',justifyContent:'center'},palette:{flexDirection:'row',flexWrap:'wrap',gap:10},paletteItem:{width:'30%',minHeight:100,borderWidth:1,borderRadius:10,padding:6},paletteImage:{width:'100%',height:70,resizeMode:'contain'} });
