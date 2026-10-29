import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { InTreeSheet } from './InTreeSheet';
import { useAppTheme } from '../theme/AppTheme';
import { useBookshelfPreferences } from '../hooks/useBookshelfPreferences';
import { saveBookshelfPreferences } from '../data/bookshelfPreferences';

const layouts = [
  'shelfLayoutList',
  'shelfLayoutCompact',
  'shelfLayout2',
  'shelfLayout3',
  'shelfLayout4',
  'shelfLayout5',
  'shelfLayout6',
] as const;
const sorts = [
  'shelfSortRead',
  'shelfSortUpdate',
  'shelfSortName',
  'shelfSortManual',
  'shelfSortActivity',
  'shelfSortAuthor',
] as const;
const names = ['shelfNameShow', 'shelfNameHide', 'shelfNameOverlay'] as const;
const groupStyles = ['shelfGroupsTab', 'shelfGroupsFolder'] as const;
const progressModes = [
  'shelfProgressHidden',
  'shelfProgressStandard',
  'shelfProgressEnhanced',
] as const;
const toggles = [
  ['showUnread', 'shelfShowUnread'],
  ['showLastUpdateTime', 'shelfShowUpdateTime'],
  ['showWaitUpCount', 'shelfShowWaitCount'],
  ['showFastScroller', 'shelfShowFastScroller'],
  ['showRecentReading', 'shelfShowRecent'],
  ['showStatistics', 'shelfShowStatistics'],
] as const;
export function BookshelfLayoutSheet({
  visible,
  dismiss,
}: {
  visible: boolean;
  dismiss: () => void;
}) {
  const { preferences, error } = useBookshelfPreferences(),
    { colors, t } = useAppTheme();
  const [draft, setDraft] = useState(preferences),
    [picker, setPicker] = useState<'groupStyle' | 'readProgressMode'>();
  useEffect(() => {
    if (visible) setDraft(preferences);
  }, [visible, preferences]);
  return (
    <>
      <InTreeSheet visible={visible} onDismiss={dismiss}>
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('shelfLayoutTitle')}
        </Text>
        {(['groupStyle', 'readProgressMode'] as const).map(key => (
          <Pressable
            accessibilityRole="button"
            key={key}
            onPress={() => setPicker(key)}
            style={s.row}
          >
            <Text style={[s.flex, { color: colors.text }]}>
              {t(
                key === 'groupStyle' ? 'shelfGroupStyle' : 'shelfReadProgress',
              )}
            </Text>
            <Text style={{ color: colors.text }}>
              {t(
                (key === 'groupStyle' ? groupStyles : progressModes)[
                  draft[key]
                ],
              )}{' '}
              ▾
            </Text>
          </Pressable>
        ))}
        {toggles.map(([key, label]) => (
          <View key={key} style={s.row}>
            <Text style={[s.flex, { color: colors.text }]}>{t(label)}</Text>
            <Switch
              style={s.switch}
              accessibilityLabel={t(label)}
              trackColor={{ true: colors.accent }}
              value={draft[key]}
              onValueChange={value =>
                setDraft(current => ({ ...current, [key]: value }))
              }
            />
          </View>
        ))}
        <View style={s.columns}>
          <View style={s.flex}>
            <Text style={[s.subtitle, { color: colors.accent }]}>
              {t('shelfView')}
            </Text>
            {layouts.map((label, index) => (
              <Radio
                key={label}
                label={t(label)}
                checked={draft.layout === index}
                choose={() =>
                  setDraft(current => ({ ...current, layout: index }))
                }
              />
            ))}
          </View>
          <View style={s.flex}>
            <Text style={[s.subtitle, { color: colors.accent }]}>
              {t('shelfGroupSort')}
            </Text>
            {sorts.map((label, index) => (
              <Radio
                key={label}
                label={t(label)}
                checked={draft.sort === index}
                choose={() =>
                  setDraft(current => ({
                    ...current,
                    sort: index as typeof current.sort,
                  }))
                }
              />
            ))}
          </View>
        </View>
        {draft.layout >= 2 ? (
          <>
            <Text style={[s.subtitle, { color: colors.accent }]}>
              {t('bookName')}
            </Text>
            <View style={s.columns}>
              {names.map((label, index) => (
                <Radio
                  key={label}
                  label={t(label)}
                  checked={draft.nameStyle === index}
                  choose={() =>
                    setDraft(current => ({ ...current, nameStyle: index }))
                  }
                />
              ))}
            </View>
          </>
        ) : null}
        <Text style={{ color: colors.text }}>
          {t('shelfMargin')} {draft.margin}
        </Text>
        <Slider
          accessibilityRole="adjustable"
          accessibilityValue={{ min: 0, max: 60, now: draft.margin }}
          accessibilityLabel={t('shelfMargin')}
          minimumValue={0}
          maximumValue={60}
          step={1}
          value={draft.margin}
          minimumTrackTintColor={colors.accent}
          thumbTintColor={colors.accent}
          onValueChange={margin =>
            setDraft(current => ({ ...current, margin }))
          }
        />
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {t('shelfPreferencesError')}
          </Text>
        ) : null}
        <View style={s.footer}>
          <Action label={t('cancel')} press={dismiss} />
          <Action
            label={t('confirm')}
            press={() => {
              if (!error) {
                saveBookshelfPreferences(draft);
                dismiss();
              }
            }}
          />
        </View>
      </InTreeSheet>
      <InTreeSheet
        visible={picker !== undefined}
        onDismiss={() => setPicker(undefined)}
      >
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t(picker === 'groupStyle' ? 'shelfGroupStyle' : 'shelfReadProgress')}
        </Text>
        {(picker === 'groupStyle' ? groupStyles : progressModes).map(
          (label, index) => (
            <Radio
              key={label}
              label={t(label)}
              checked={picker !== undefined && draft[picker] === index}
              choose={() => {
                if (picker)
                  setDraft(current => ({ ...current, [picker]: index }));
                setPicker(undefined);
              }}
            />
          ),
        )}
      </InTreeSheet>
    </>
  );
}
function Radio({
  label,
  checked,
  choose,
}: {
  label: string;
  checked: boolean;
  choose: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={choose}
      style={s.radio}
    >
      <View
        style={[
          s.radioOuter,
          { borderColor: checked ? colors.accent : colors.muted },
        ]}
      >
        {checked ? (
          <View style={[s.radioInner, { backgroundColor: colors.accent }]} />
        ) : null}
      </View>
      <Text style={{ color: colors.text, flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}
function Action({ label, press }: { label: string; press: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={press} style={s.action}>
      <Text style={{ color: colors.accent }}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  heading: { fontSize: 20, marginBottom: 12 },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  switch: { alignSelf: 'center' },
  columns: { flexDirection: 'row', gap: 12 },
  subtitle: { fontSize: 16, paddingVertical: 8 },
  radio: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  action: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
});
