import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import jssdk from '@htyf-mp/js-sdk';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import { useAppTheme } from '../theme/AppTheme';
import type {
  AppPreferences,
  LanguageMode,
  ThemeMode,
} from '../data/appPreferences';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  applyThemePreset,
  exportThemePreset,
  loadThemePresets,
  mergeThemePresets,
  parseThemePresets,
  saveThemePresets,
  themePresetFromPreferences,
  type ThemePreset,
} from '../data/themePresets';
type ColorKey =
  | 'dayPrimary'
  | 'dayAccent'
  | 'dayBackground'
  | 'dayBottomBackground'
  | 'nightPrimary'
  | 'nightAccent'
  | 'nightBackground'
  | 'nightBottomBackground';
export function AppearanceSettings({ back, openBottomBarSkins }: { back: () => void; openBottomBarSkins: () => void }) {
  const { preferences, setPreferences, colors, t, dark } = useAppTheme(),
    [presetVisible, setPresetVisible] = useState(false),
    [presetName, setPresetName] = useState(''),
    [presets, setPresets] = useState(loadThemePresets),
    [removePreset, setRemovePreset] = useState<ThemePreset>(),
    theme: Array<[ThemeMode, string]> = [
      ['system', t('themeSystem')],
      ['light', t('themeLight')],
      ['dark', t('themeDark')],
    ],
    languages: Array<[LanguageMode, string]> = [
      ['system', t('languageSystem')],
      ['zh-CN', t('languageZh')],
      ['en', t('languageEn')],
    ],
    set = (patch: Partial<AppPreferences>) =>
      setPreferences({ ...preferences, ...patch }),
    commitPresets = (next: ThemePreset[]) => {
      const saved = saveThemePresets(next);
      setPresets(saved);
      return saved;
    },
    importPreset = async () => {
      try {
        const incoming = parseThemePresets(await Clipboard.getString());
        commitPresets(mergeThemePresets(presets, incoming));
        void jssdk.showToast({ type: 'success', title: t('themesImported', { count: incoming.length }) });
      } catch (error) {
        void jssdk.showToast({ type: 'error', title: t('themeImportFailed'), description: error instanceof Error ? error.message : String(error) });
      }
    },
    saveCurrentPreset = () => {
      const name = presetName.trim();
      if (!name) return;
      commitPresets(mergeThemePresets(presets, [themePresetFromPreferences(name, preferences, dark)]));
      setPresetName('');
    };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('appearance')} onBack={back} />
      <ScrollView contentContainerStyle={s.content}>
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('theme')}
        </Text>
        {theme.map(([value, label]) => (
          <Choice
            key={value}
            label={label}
            selected={preferences.themeMode === value}
            select={() => set({ themeMode: value })}
          />
        ))}
        <Pressable accessibilityRole="button" style={[s.manageThemes, { borderColor: colors.primary }]} onPress={() => setPresetVisible(true)}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t('themeList')}</Text></Pressable>
        <Pressable accessibilityRole="button" style={[s.manageThemes, { borderColor: colors.primary }]} onPress={openBottomBarSkins}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t('bottomBarSkins')}</Text></Pressable>
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('language')}
        </Text>
        {languages.map(([value, label]) => (
          <Choice
            key={value}
            label={label}
            selected={preferences.language === value}
            select={() => set({ language: value })}
          />
        ))}
        <View style={[s.option, { borderColor: colors.border }]}> 
          <Text style={{ color: colors.text }}>{t('highContrast')}</Text>
          <Switch
            accessibilityLabel={t('highContrast')}
            value={preferences.highContrast}
            onValueChange={highContrast => set({ highContrast })}
          />
        </View>
        <View style={[s.option, { borderColor: colors.border }]}><Text style={{ color: colors.text }}>{t('barElevation')}</Text><View style={s.elevationControls}><Pressable accessibilityRole="button" accessibilityLabel={t('decrease', { name: t('barElevation') })} style={s.elevationButton} onPress={() => set({ barElevation: Math.max(0, preferences.barElevation - 1) })}><Text style={{ color: colors.primary }}>−</Text></Pressable><Text style={{ color: colors.text, minWidth: 28, textAlign: 'center' }}>{preferences.barElevation}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('increase', { name: t('barElevation') })} style={s.elevationButton} onPress={() => set({ barElevation: Math.min(32, preferences.barElevation + 1) })}><Text style={{ color: colors.primary }}>＋</Text></Pressable></View></View>
        {/* TODO(htyf-native): Exact application font-scale override, wallpaper-derived dynamic colors and runtime status-bar transparency require the native work documented in docs/htyf-migration-gaps.md. */}
        <Text style={{ color: colors.muted }}>{t('themeNativeSystemFieldsNote')}</Text>
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('dayTheme')}
        </Text>
        <ColorField
          name="dayPrimary"
          label={t('primaryColor')}
          value={preferences.dayPrimary}
          save={set}
        />
        <ColorField
          name="dayAccent"
          label={t('accentColor')}
          value={preferences.dayAccent}
          save={set}
        />
        <ColorField
          name="dayBackground"
          label={t('backgroundColor')}
          value={preferences.dayBackground}
          save={set}
        />
        <ColorField
          name="dayBottomBackground"
          label={t('bottomBarColor')}
          value={preferences.dayBottomBackground}
          save={set}
        />
        <BackgroundPicker label={t('appBackgroundImage')} value={preferences.dayBackgroundImage} save={dayBackgroundImage=>set({dayBackgroundImage})}/>
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('nightTheme')}
        </Text>
        <ColorField
          name="nightPrimary"
          label={t('primaryColor')}
          value={preferences.nightPrimary}
          save={set}
        />
        <ColorField
          name="nightAccent"
          label={t('accentColor')}
          value={preferences.nightAccent}
          save={set}
        />
        <ColorField
          name="nightBackground"
          label={t('backgroundColor')}
          value={preferences.nightBackground}
          save={set}
        />
        <ColorField
          name="nightBottomBackground"
          label={t('bottomBarColor')}
          value={preferences.nightBottomBackground}
          save={set}
        />
        <BackgroundPicker label={t('appBackgroundImage')} value={preferences.nightBackgroundImage} save={nightBackgroundImage=>set({nightBackgroundImage})}/>
        <Text style={{ color: colors.muted }}>{t('hexColorHelp')}</Text>
      </ScrollView>
      <InTreeSheet visible={presetVisible} onDismiss={() => setPresetVisible(false)}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>{t('themeList')}</Text>
        {/* TODO(htyf-native): ThemeConfig transparent navigation-bar and bitmap-blur fields are preserved but not applied; see docs/htyf-migration-gaps.md. */}
        <Text style={{ color: colors.muted }}>{t('themePresetPlatformFieldsNote')}</Text>
        <View style={s.savePresetRow}>
          <TextInput accessibilityLabel={t('themeName')} value={presetName} onChangeText={setPresetName} placeholder={t('themeName')} placeholderTextColor={colors.muted} style={[s.presetInput, { color: colors.text, borderColor: colors.border }]} />
          <Pressable accessibilityRole="button" disabled={!presetName.trim()} style={s.sheetButton} onPress={saveCurrentPreset}><Text style={{ color: colors.primary }}>{t('saveCurrentTheme')}</Text></Pressable>
        </View>
        <Pressable accessibilityRole="button" style={s.sheetButton} onPress={() => void importPreset()}><Text style={{ color: colors.primary }}>{t('importThemeClipboard')}</Text></Pressable>
        <ScrollView style={s.presetList}>
          {presets.map(preset => <View key={preset.themeName} style={[s.presetRow, { borderColor: colors.border }]}><Pressable accessibilityRole="button" accessibilityLabel={t('applyNamedTheme', { name: preset.themeName })} style={s.presetName} onPress={() => { setPreferences(applyThemePreset(preferences, preset)); setPresetVisible(false); }}><View style={[s.swatch, { backgroundColor: preset.primaryColor }]} /><Text style={{ color: colors.text, fontWeight: '700' }}>{preset.themeName}</Text><Text style={{ color: colors.muted }}>{preset.isNightTheme ? t('themeDark') : t('themeLight')}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t('shareNamedTheme', { name: preset.themeName })} style={s.iconButton} onPress={() => void Share.share({ title: t('themeShareTitle'), message: exportThemePreset(preset) })}><Text style={{ color: colors.primary }}>⇧</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t('deleteNamed', { name: preset.themeName })} style={s.iconButton} onPress={() => setRemovePreset(preset)}><Text style={{ color: colors.danger }}>×</Text></Pressable></View>)}
          {!presets.length ? <Text style={{ color: colors.muted }}>{t('noThemePresets')}</Text> : null}
        </ScrollView>
      </InTreeSheet>
      <InTreeSheet visible={!!removePreset} onDismiss={() => setRemovePreset(undefined)}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>{t('deleteThemePreset')}</Text>
        <Text style={{ color: colors.muted }}>{removePreset?.themeName}</Text>
        <Pressable accessibilityRole="button" style={[s.deletePreset, { backgroundColor: colors.danger }]} onPress={() => { if (removePreset) commitPresets(presets.filter(item => item.themeName !== removePreset.themeName)); setRemovePreset(undefined); }}><Text style={{ color: '#fff', fontWeight: '700' }}>{t('delete')}</Text></Pressable>
      </InTreeSheet>
    </View>
  );
}
function BackgroundPicker({label,value,save}:{label:string;value:string;save:(value:string)=>void}){const{colors,t}=useAppTheme(),choose=async()=>{const result=await launchImageLibrary({mediaType:'photo',selectionLimit:1});const uri=result.assets?.[0]?.uri;if(uri)save(uri)};return <View style={[s.backgroundRow,{borderColor:colors.border}]}><Text style={[s.backgroundLabel,{color:colors.text}]}>{label}</Text><Pressable accessibilityRole="button" style={[s.smallButton,{borderColor:colors.primary}]} onPress={()=>void choose()}><Text style={{color:colors.primary}}>{t('chooseImage')}</Text></Pressable>{value?<Pressable accessibilityRole="button" style={[s.smallButton,{borderColor:colors.danger}]} onPress={()=>save('')}><Text style={{color:colors.danger}}>{t('clear')}</Text></Pressable>:null}</View>}
function ColorField({
  name,
  label,
  value,
  save,
}: {
  name: ColorKey;
  label: string;
  value: string;
  save: (patch: Partial<AppPreferences>) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        key={`${name}-${value}`}
        accessibilityLabel={label}
        defaultValue={value}
        autoCapitalize="none"
        autoCorrect={false}
        onEndEditing={event => save({ [name]: event.nativeEvent.text })}
        style={[
          s.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      />
    </View>
  );
}
function Choice({
  label,
  selected,
  select,
}: {
  label: string;
  selected: boolean;
  select: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        s.choice,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
      onPress={select}
    >
      <Text style={{ color: colors.text }}>{label}</Text>
      <Text style={{ color: colors.primary }}>{selected ? '●' : '○'}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 10 },
  heading: { fontSize: 17, fontWeight: '800', marginTop: 10 },
  label: { fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  choice: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  option: {
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  elevationControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  elevationButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backgroundRow:{minHeight:54,borderBottomWidth:StyleSheet.hairlineWidth,flexDirection:'row',alignItems:'center',gap:8},
  backgroundLabel:{flex:1,fontWeight:'600'},
  smallButton:{minHeight:44,borderWidth:1,borderRadius:8,paddingHorizontal:10,alignItems:'center',justifyContent:'center'},
  manageThemes: { minHeight: 48, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10 },
  savePresetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  presetInput: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  sheetButton: { minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  presetList: { maxHeight: 360 },
  presetRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  presetName: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 24, height: 24, borderRadius: 12 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  deletePreset: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
});
