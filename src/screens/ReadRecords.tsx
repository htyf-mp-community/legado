import { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { InTreeSheet } from '../components/InTreeSheet';
import { PageHeader } from '../components/PageHeader';
import { SourceIcon } from '../components/SourceIcon';
import {
  clearReadRecords,
  formatNativeReadDuration,
  formatReadRecordDate,
  loadReadRecords,
  loadReadRecordSort,
  readRecordEnabled,
  removeReadRecordsByName,
  saveReadRecordEnabled,
  saveReadRecordSort,
  selectReadRecords,
  totalReadRecordTime,
  type ReadRecordShow,
  type ReadRecordSort,
} from '../data/readRecords';
import { useAppTheme } from '../theme/AppTheme';
import { useCapsule } from '../hooks/useCapsule';
import { readRecordMenuFrame } from '../layout/readRecordMenu';

/** Source reading records: native name aggregation, local menus and confirmed delete-by-name. */
export function ReadRecords({
  back,
  open,
}: {
  back: () => void;
  open: (record: ReadRecordShow) => void;
}) {
  const { colors, t, dark } = useAppTheme(),
    { header, capsule, window, insets } = useCapsule();
  const [records, setRecords] = useState(loadReadRecords),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('');
  const [sort, setSort] = useState(loadReadRecordSort),
    [enabled, setEnabled] = useState(readRecordEnabled);
  const [remove, setRemove] = useState<ReadRecordShow | null>(null),
    [clear, setClear] = useState(false),
    [menu, setMenu] = useState<'sort' | 'more' | null>(null);
  // Native initAllTime runs once on activity creation. Deleting/sorting refreshes only the list.
  const [total] = useState(() => totalReadRecordTime(records));
  const [searchFocused, setSearchFocused] = useState(false);
  const visible = useMemo(
    () => selectReadRecords(records, filter, sort),
    [records, filter, sort],
  );
  useEffect(() => {
    if (!menu) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setMenu(null);
        return true;
      },
    );
    return () => subscription.remove();
  }, [menu]);
  const [menuSize, setMenuSize] = useState<{
    type: 'sort' | 'more' | null;
    height: number;
  }>({ type: null, height: 0 });
  const closeMenu = () => setMenu(null);
  const chooseSort = (value: ReadRecordSort) => {
    setSort(saveReadRecordSort(value));
    setRecords(loadReadRecords());
    setFilter('');
    closeMenu();
  };
  const menuFrame = readRecordMenuFrame(
    window,
    header.bottom,
    insets.bottom,
    capsule,
    menuSize.type === menu ? menuSize.height : 0,
  );
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('readRecords')}
        onBack={back}
        action={
          <View style={s.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('sort')}
              style={s.touch}
              onPress={() => {
                Keyboard.dismiss();
                setMenu('sort');
              }}
            >
              <SourceIcon name="ic_baseline_sort_24" color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('moreSourceActions')}
              style={s.touch}
              onPress={() => {
                Keyboard.dismiss();
                setEnabled(readRecordEnabled());
                setMenu('more');
              }}
            >
              <SourceIcon name="ic_more_vert" color={colors.text} />
            </Pressable>
          </View>
        }
      />
      <View style={[s.searchRow, { backgroundColor: colors.surface }]}>
        <TextInput
          accessibilityLabel={t('searchReadRecords')}
          value={query}
          onChangeText={value => {
            setQuery(value);
            setRecords(loadReadRecords());
            setFilter(value);
          }}
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
          placeholder={t('search')}
          placeholderTextColor="transparent"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          hitSlop={{ top: 7, bottom: 7 }}
          style={[
            s.input,
            {
              color: colors.text,
              backgroundColor: dark ? '#ffffff10' : '#00000010',
            },
          ]}
        />
        {!query ? (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            style={s.searchHint}
          >
            <SourceIcon
              name="ic_search_hint"
              size={14 * (window.fontScale ?? 1)}
              color={colors.muted}
            />
            <Text style={{ color: colors.muted, fontSize: 14, marginLeft: 4 }}>
              {t('search')}
            </Text>
          </View>
        ) : null}
        {query || searchFocused ? (
          <View style={s.searchActions}>
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('clearReadRecordSearch')}
                style={s.touch}
                onPress={() => {
                  setQuery('');
                  setRecords(loadReadRecords());
                  setFilter('');
                }}
              >
                <SourceIcon
                  name="ic_baseline_close"
                  size={20}
                  color={colors.muted}
                />
              </Pressable>
            ) : null}
            {searchFocused ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('search')}
                style={s.touch}
                onPress={() => Keyboard.dismiss()}
              >
                <SourceIcon name="ic_search" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={s.summary}>
        <View style={s.textColumn}>
          <Text style={[s.cell, { color: colors.text }]}>
            {t('totalReadingTime')}
          </Text>
          <Text style={[s.cell, { color: colors.muted }]}>
            {formatNativeReadDuration(total)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('clearReadRecords')}
          style={s.touch}
          onPress={() => setClear(true)}
        >
          <Text style={{ color: colors.text }}>{t('readRecordClear')}</Text>
        </Pressable>
      </View>
      <FlatList
        data={visible}
        keyExtractor={item => item.bookName}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            key={item.bookName}
            accessibilityRole="button"
            accessibilityLabel={t('openReadRecord', { name: item.bookName })}
            accessibilityValue={{
              text: [
                item.displayAuthor
                  ? t('readRecordAuthor', { author: item.displayAuthor })
                  : '',
                `${t('readRecordDurationLabel')}${formatNativeReadDuration(item.readTime)}`,
                `${t('readRecordLastReadLabel')}${formatReadRecordDate(item.lastRead)}`,
              ]
                .filter(Boolean)
                .join(', '),
            }}
            accessibilityActions={[
              {
                name: 'delete',
                label: t('deleteNamed', { name: item.bookName }),
              },
            ]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (nativeEvent.actionName === 'delete') setRemove(item);
            }}
            style={s.item}
            onPress={() => open(item)}
          >
            <View style={s.textColumn}>
              <Text numberOfLines={1} style={[s.cell, { color: colors.text }]}>
                {item.bookName}
              </Text>
              {item.displayAuthor ? (
                <Text
                  numberOfLines={1}
                  style={[s.cell, { color: colors.muted }]}
                >
                  {t('readRecordAuthor', { author: item.displayAuthor })}
                </Text>
              ) : null}
              <View style={s.detailRow}>
                <Text
                  numberOfLines={1}
                  style={[s.cell, { color: colors.muted }]}
                >
                  {t('readRecordDurationLabel')}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[s.cell, s.flex, { color: colors.muted }]}
                >
                  {formatNativeReadDuration(item.readTime)}
                </Text>
              </View>
              <View style={s.detailRow}>
                <Text
                  numberOfLines={1}
                  style={[s.cell, { color: colors.muted }]}
                >
                  {t('readRecordLastReadLabel')}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[s.cell, s.flex, { color: colors.muted }]}
                >
                  {formatReadRecordDate(item.lastRead)}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('deleteNamed', { name: item.bookName })}
              style={s.touch}
              onPress={() => setRemove(item)}
            >
              <Text style={{ color: colors.text }}>{t('readRecordClear')}</Text>
            </Pressable>
          </Pressable>
        )}
      />
      {menu ? (
        <View
          style={s.overlay}
          accessibilityViewIsModal
          onAccessibilityEscape={closeMenu}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            onPress={closeMenu}
          />
          <View
            style={[
              s.popup,
              {
                ...menuFrame,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ScrollView
              contentContainerStyle={s.popupContent}
              onContentSizeChange={(_width, height) =>
                setMenuSize({ type: menu, height })
              }
            >
              {menu === 'sort' ? (
                (['name', 'duration', 'recent'] as const).map(value => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={t(
                      value === 'name'
                        ? 'readRecordSortName'
                        : value === 'duration'
                          ? 'readRecordSortDuration'
                          : 'readRecordSortRecent',
                    )}
                    accessibilityState={{ checked: sort === value }}
                    style={s.menuItem}
                    onPress={() => chooseSort(value)}
                  >
                    <Text style={{ color: colors.primary, width: 24 }}>
                      {sort === value ? '●' : '○'}
                    </Text>
                    <Text style={[s.flex, { color: colors.text }]}>
                      {t(
                        value === 'name'
                          ? 'readRecordSortName'
                          : value === 'duration'
                            ? 'readRecordSortDuration'
                            : 'readRecordSortRecent',
                      )}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={t('enableReadRecord')}
                  accessibilityState={{ checked: enabled }}
                  style={s.menuItem}
                  onPress={() => {
                    setEnabled(saveReadRecordEnabled(!enabled));
                    closeMenu();
                  }}
                >
                  <Text style={{ color: colors.primary, width: 24 }}>
                    {enabled ? '✓' : ''}
                  </Text>
                  <Text style={{ color: colors.text }}>
                    {t('enableReadRecord')}
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </View>
      ) : null}
      <InTreeSheet visible={!!remove} onDismiss={() => setRemove(null)}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          {t('deleteReadRecordTitle', { name: remove?.bookName ?? '' })}
        </Text>
        <View style={s.sheetActions}>
          <Pressable
            accessibilityRole="button"
            style={s.sheetButton}
            onPress={() => setRemove(null)}
          >
            <Text style={{ color: colors.text }}>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[s.sheetButton, { backgroundColor: colors.danger }]}
            onPress={() => {
              if (remove) {
                setRecords(removeReadRecordsByName(remove.bookName));
                setFilter('');
              }
              setRemove(null);
            }}
          >
            <Text style={s.dangerText}>{t('delete')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
      <InTreeSheet visible={clear} onDismiss={() => setClear(false)}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          {t('clearReadRecordsTitle')}
        </Text>
        <Text style={{ color: colors.muted }}>{t('clearReadRecordsHelp')}</Text>
        <View style={s.sheetActions}>
          <Pressable
            accessibilityRole="button"
            style={s.sheetButton}
            onPress={() => setClear(false)}
          >
            <Text style={{ color: colors.text }}>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[s.sheetButton, { backgroundColor: colors.danger }]}
            onPress={() => {
              setRecords(clearReadRecords());
              setFilter('');
              setClear(false);
            }}
          >
            <Text style={s.dangerText}>{t('clear')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row' },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  searchRow: { height: 50, justifyContent: 'center' },
  input: {
    height: 30,
    borderRadius: 35,
    paddingVertical: 0,
    paddingLeft: 16,
    paddingRight: 88,
    fontSize: 14,
  },
  searchHint: {
    position: 'absolute',
    left: 20,
    top: 10,
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchActions: {
    position: 'absolute',
    right: 0,
    top: 3,
    flexDirection: 'row',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  textColumn: { flex: 1, minWidth: 0 },
  cell: { padding: 6 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  detailRow: { flexDirection: 'row' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  popup: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
  },
  popupContent: { paddingVertical: 8 },
  menuItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetTitle: { fontSize: 19, fontWeight: '700', marginBottom: 8 },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  sheetButton: {
    minWidth: 86,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: { color: '#fff', fontWeight: '700' },
});
