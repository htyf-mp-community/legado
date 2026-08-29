import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { InTreeSheet } from '../components/InTreeSheet';
import { PageHeader } from '../components/PageHeader';
import {
  clearReadRecords,
  formatReadDuration,
  loadReadRecords,
  removeReadRecord,
  selectReadRecords,
  type ReadRecord,
  type ReadRecordSort,
} from '../data/readRecords';
import { useAppTheme } from '../theme/AppTheme';

export function ReadRecords({
  back,
  open,
}: {
  back: () => void;
  open: (record: ReadRecord) => void;
}) {
  const { colors, t } = useAppTheme(),
    [records, setRecords] = useState(loadReadRecords),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState<ReadRecordSort>('name'),
    [remove, setRemove] = useState<ReadRecord | null>(null),
    [clear, setClear] = useState(false);
  const visible = useMemo(
      () => selectReadRecords(records, query, sort),
      [query, records, sort],
    ),
    total = records.reduce((sum, item) => sum + item.readTime, 0);
  const duration = (ms: number) => {
    const value = formatReadDuration(ms);
    return t('readDuration', {
      hours: value.hours,
      minutes: value.minutes,
      seconds: value.seconds,
    });
  };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('readRecords')}
        onBack={back}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('clearReadRecords')}
            disabled={!records.length}
            accessibilityState={{ disabled: !records.length }}
            style={s.touch}
            onPress={() => setClear(true)}
          >
            <Text
              style={{ color: records.length ? colors.danger : colors.muted }}
            >
              {t('clear')}
            </Text>
          </Pressable>
        }
      />
      <View style={[s.summary, { backgroundColor: colors.surface }]}>
        <Text style={[s.summaryTitle, { color: colors.text }]}>
          {t('totalReadingTime')}
        </Text>
        <Text style={{ color: colors.primary }}>{duration(total)}</Text>
      </View>
      <TextInput
        accessibilityLabel={t('searchReadRecords')}
        value={query}
        onChangeText={setQuery}
        placeholder={t('searchBookOrAuthor')}
        placeholderTextColor={colors.muted}
        style={[
          s.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
      />
      <View accessibilityRole="radiogroup" style={s.sorts}>
        {(['name', 'duration', 'recent'] as const).map(value => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: sort === value }}
            key={value}
            style={[
              s.sort,
              { borderColor: sort === value ? colors.primary : colors.border },
            ]}
            onPress={() => setSort(value)}
          >
            <Text
              style={{ color: sort === value ? colors.primary : colors.text }}
            >
              {t(
                value === 'name'
                  ? 'sortByName'
                  : value === 'duration'
                    ? 'sortByDuration'
                    : 'sortByRecent',
              )}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={s.list}>
        {visible.map(item => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('openReadRecord', { name: item.bookName })}
            key={item.bookId}
            style={[
              s.item,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => open(item)}
          >
            <View style={s.itemText}>
              <Text style={[s.title, { color: colors.text }]}>
                {item.bookName}
              </Text>
              {item.author ? (
                <Text style={{ color: colors.muted }}>{item.author}</Text>
              ) : null}
              <Text style={{ color: colors.muted }}>
                {duration(item.readTime)} ·{' '}
                {new Date(item.lastRead).toLocaleDateString()}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('deleteNamed', { name: item.bookName })}
              style={s.touch}
              onPress={() => setRemove(item)}
            >
              <Text style={{ color: colors.danger }}>×</Text>
            </Pressable>
          </Pressable>
        ))}
        {!visible.length ? (
          <Text style={[s.empty, { color: colors.muted }]}>
            {query ? t('noMatchingReadRecords') : t('emptyReadRecords')}
          </Text>
        ) : null}
      </ScrollView>
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
              if (remove) setRecords(removeReadRecord(remove.bookId));
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
  touch: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    marginHorizontal: 14,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryTitle: { fontWeight: '700' },
  input: {
    margin: 14,
    marginBottom: 8,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  sorts: { flexDirection: 'row', paddingHorizontal: 14, gap: 8 },
  sort: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: 14, gap: 10, paddingBottom: 50 },
  item: {
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemText: { flex: 1, gap: 4 },
  title: { fontSize: 17, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 50 },
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
