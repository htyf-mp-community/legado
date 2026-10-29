import { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { BookSource } from '../types';
import { loadSources } from '../data/sources';
import { appStorage } from '../data/storage';
import { addAppLog } from '../data/appLog';
import {
  loadBatchSourceDelay,
  normalizeBatchSourceDelay,
  saveBatchSourceDelay,
} from '../data/batchSourcePreferences';
import {
  batchSourceDisplayName,
  selectableBatchSources,
} from '../core/batchSourcePicker';
import { useAppTheme } from '../theme/AppTheme';
import { useCapsule } from '../hooks/useCapsule';
import { PageHeader } from './PageHeader';
import { SourceIcon } from './SourceIcon';
import { InTreeSheet } from './InTreeSheet';
/** Native SourcePicker fills the page. Keep its virtual list inside the application's React tree. */
export function BatchSourcePicker({
  visible,
  dismiss,
  selected,
}: {
  visible: boolean;
  dismiss: () => void;
  selected: (source: BookSource) => void;
}) {
  const { colors, t } = useAppTheme(),
    { insets } = useCapsule();
  const [sources, setSources] = useState<BookSource[]>([]),
    [query, setQuery] = useState(''),
    [searching, setSearching] = useState(false),
    [menu, setMenu] = useState(false),
    [delay, setDelay] = useState<string>(),
    [delayError, setDelayError] = useState('');
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setQuery('');
    setSearching(false);
    setMenu(false);
    setDelay(undefined);
    setDelayError('');
    const refresh = () => {
      void loadSources()
        .then(value => {
          if (alive) setSources(value);
        })
        .catch(cause => addAppLog('书源选择界面获取书源数据失败', cause));
    };
    refresh();
    const listener = appStorage.addOnValueChangedListener(key => {
      if (key === 'sources.v1') refresh();
    });
    return () => {
      alive = false;
      listener.remove();
    };
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (delay !== undefined) setDelay(undefined);
      else if (menu) setMenu(false);
      else if (searching) {
        setSearching(false);
        setQuery('');
      } else dismiss();
      return true;
    });
    return () => listener.remove();
  }, [visible, delay, menu, searching, dismiss]);
  const items = useMemo(
    () => selectableBatchSources(sources, query),
    [sources, query],
  );
  if (!visible) return null;
  const button = (label: string, action: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={action}
      style={s.action}
    >
      <Text style={{ color: colors.accent, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
  const adjust = (offset: number) => {
    setDelay(String(normalizeBatchSourceDelay(Number(delay) + offset)));
    setDelayError('');
  };
  return (
    <View
      accessibilityViewIsModal
      style={[
        StyleSheet.absoluteFill,
        s.overlay,
        { backgroundColor: colors.background },
      ]}
    >
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <PageHeader
          sourceTone
          title={t('batchSourcePickTitle')}
          onBack={dismiss}
          titleContent={
            searching ? (
              <TextInput
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t('batchSourceSearch')}
                placeholder={t('batchSourceSearch')}
                placeholderTextColor={colors.toolbarText}
                value={query}
                onChangeText={setQuery}
                style={{
                  minHeight: 44,
                  color: colors.toolbarText,
                  fontSize: 16,
                }}
              />
            ) : undefined
          }
          action={
            <View style={s.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  searching ? t('clear') : t('batchSourceSearch')
                }
                style={s.action}
                onPress={() => {
                  if (searching) {
                    setQuery('');
                    setSearching(false);
                  } else setSearching(true);
                }}
              >
                {searching ? (
                  <Text style={{ color: colors.toolbarText, fontSize: 22 }}>
                    ×
                  </Text>
                ) : (
                  <SourceIcon
                    name="ic_search"
                    color={colors.toolbarText}
                    size={24}
                  />
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('batchSourceMenu')}
                style={s.action}
                onPress={() => setMenu(true)}
              >
                <Text style={{ color: colors.toolbarText, fontSize: 24 }}>
                  ⋮
                </Text>
              </Pressable>
            </View>
          }
        />
        <FlatList
          data={items}
          keyExtractor={source => source.bookSourceUrl}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={batchSourceDisplayName(item)}
              style={s.source}
              onPress={() => {
                selected(item);
                dismiss();
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: colors.text, fontSize: 16 }}
              >
                {batchSourceDisplayName(item)}
              </Text>
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>
      <InTreeSheet visible={menu} onDismiss={() => setMenu(false)}>
        {button(t('batchSourceDelay'), () => {
          setMenu(false);
          setDelayError('');
          setDelay(String(loadBatchSourceDelay()));
        })}
      </InTreeSheet>
      <InTreeSheet
        visible={delay !== undefined}
        onDismiss={() => setDelay(undefined)}
      >
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 20 }}
        >
          {t('batchSourceDelay')}
        </Text>
        <View style={[s.row, { justifyContent: 'center', marginVertical: 12 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('batchSourceDecreaseDelay')}
            onPress={() => adjust(-1)}
            style={s.action}
          >
            <Text style={{ color: colors.accent, fontSize: 24 }}>−</Text>
          </Pressable>
          <BottomSheetTextInput
            accessibilityLabel={t('batchSourceDelay')}
            value={delay}
            onChangeText={value => {
              setDelay(value);
              setDelayError('');
            }}
            keyboardType="number-pad"
            maxLength={4}
            style={{
              minWidth: 100,
              minHeight: 44,
              color: colors.text,
              fontSize: 20,
              textAlign: 'center',
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('batchSourceIncreaseDelay')}
            onPress={() => adjust(1)}
            style={s.action}
          >
            <Text style={{ color: colors.accent, fontSize: 24 }}>+</Text>
          </Pressable>
        </View>
        {delayError ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {delayError}
          </Text>
        ) : null}
        <View style={[s.row, { justifyContent: 'flex-end' }]}>
          {button(t('cancel'), () => setDelay(undefined))}
          {button(t('confirm'), () => {
            if (!/^\d{1,4}$/.test(delay ?? '')) {
              setDelayError(t('batchSourceDelayInvalid'));
              return;
            }
            saveBatchSourceDelay(Number(delay));
            setDelay(undefined);
          })}
        </View>
      </InTreeSheet>
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { zIndex: 1000, elevation: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  action: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  source: { padding: 16, minHeight: 48, justifyContent: 'center' },
});
