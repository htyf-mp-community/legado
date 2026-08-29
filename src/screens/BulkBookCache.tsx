import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { InTreeSheet } from '../components/InTreeSheet';
import { PageHeader } from '../components/PageHeader';
import {
  cacheBookshelfSelection,
  filterBulkBooksByGroup,
  sortBulkBooks,
  type BulkBookGroupFilter,
  type BulkBookCacheFailure,
  type BulkBookCacheProgress,
} from '../core/bulkBookCache';
import {
  saveBulkBookExport,
  type BulkBookExportFormat,
} from '../core/bulkBookExport';
import {
  loadBookExportPreferences,
  saveBookExportPreferences,
  type BookExportPreferences,
  type ExportCharset,
} from '../data/exportPreferences';
import {
  loadBookGroups,
  loadBookGroupSort,
  saveBookGroupSort,
  type BookGroupSort,
} from '../data/bookshelf';
import { loadGeneralPreferences } from '../data/generalPreferences';
import { expandSelectionInterval } from '../core/selectionInterval';
import { loadSources } from '../data/sources';
import { addAppLog } from '../data/appLog';
import type { Book } from '../types';
import { useAppTheme } from '../theme/AppTheme';

export function BulkBookCache({
  books,
  back,
  update,
  replace,
  openLogs,
}: {
  books: Book[];
  back: () => void;
  update: (book: Book) => void;
  replace: (books: Book[]) => void;
  openLogs: () => void;
}) {
  const { colors, t } = useAppTheme();
  const groups = useMemo(loadBookGroups, []);
  const [group, setGroup] = useState<BulkBookGroupFilter>('all'),
    [groupMenu, setGroupMenu] = useState(false),
    [sort, setSort] = useState<BookGroupSort>(() => loadBookGroupSort('all')),
    [sortMenu, setSortMenu] = useState(false);
  const eligible = useMemo(
      () =>
        sortBulkBooks(
          filterBulkBooksByGroup(
            books.filter(book => book.sourceType !== 1),
            group,
          ),
          sort,
        ),
      [books, group, sort],
    ),
    cacheable = useMemo(
      () =>
        new Set(
          eligible
            .filter(
              book =>
                !!book.origin &&
                !!book.bookUrl &&
                !!book.chapters?.some(chapter => chapter.url),
            )
            .map(book => book.id),
        ),
      [eligible],
    );
  const [selected, setSelected] = useState(
      () => new Set(eligible.map(book => book.id)),
    ),
    [confirm, setConfirm] = useState<'current' | 'all'>(),
    [operation, setOperation] = useState<'cache' | 'export'>(),
    [exportFormat, setExportFormat] = useState<BulkBookExportFormat>(),
    [progress, setProgress] = useState<BulkBookCacheProgress>(),
    [failures, setFailures] = useState<BulkBookCacheFailure[]>([]),
    [message, setMessage] = useState(''),
    [exportPreferences, setExportPreferences] = useState(
      loadBookExportPreferences,
    );
  const selectedCacheable = useMemo(
    () => new Set([...selected].filter(id => cacheable.has(id))),
    [selected, cacheable],
  );
  const cancelled = useRef(false);
  const changeExportPreference = <K extends keyof BookExportPreferences>(
    key: K,
    value: BookExportPreferences[K],
  ) => {
    const next = { ...exportPreferences, [key]: value };
    setExportPreferences(saveBookExportPreferences(next));
  };
  const toggle = (id: string) =>
    setSelected(value => {
      const next = new Set(value);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const chooseGroup = (value: BulkBookGroupFilter) => {
    const nextSort = loadBookGroupSort(value),
      visible = sortBulkBooks(
        filterBulkBooksByGroup(
          books.filter(book => book.sourceType !== 1),
          value,
        ),
        nextSort,
      );
    setGroup(value);
    setSort(nextSort);
    setSelected(new Set(visible.map(book => book.id)));
    setGroupMenu(false);
  };
  const chooseSort = (value: BookGroupSort) => {
    setSort(saveBookGroupSort(group, value));
    setSortMenu(false);
  };
  const start = async (mode: 'current' | 'all') => {
    setConfirm(undefined);
    setOperation('cache');
    setFailures([]);
    setProgress(undefined);
    setMessage(t('preparingBulkCache'));
    cancelled.current = false;
    try {
      const result = await cacheBookshelfSelection(
        books,
        selectedCacheable,
        await loadSources(),
        {
          fromCurrent: mode === 'current',
          concurrency: loadGeneralPreferences().threadCount,
          cancelled: () => cancelled.current,
          onProgress: setProgress,
          onBookUpdated: update,
        },
      );
      replace(result.books);
      setFailures(result.failures);
      setMessage(
        t(
          result.cancelled
            ? 'bulkCacheStopped'
            : result.failures.length
              ? 'bulkCacheCompleteWithFailures'
              : 'bulkCacheComplete',
          {
            completed: result.completed,
            total: result.total,
            failed: result.failures.length,
          },
        ),
      );
      addAppLog(
        `Bulk cache completed: ${result.completed}/${result.total}, failures=${result.failures.length}`,
      );
    } catch (error) {
      addAppLog('Bulk cache failed', error);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setOperation(undefined);
    }
  };
  const exportSelected = async (format: BulkBookExportFormat) => {
    setExportFormat(undefined);
    setOperation('export');
    setProgress(undefined);
    setFailures([]);
    setMessage(t('preparingBulkExport'));
    try {
      const result = await saveBulkBookExport(
        books,
        selected,
        format,
        (completed, total, bookName) =>
          setMessage(
            t('bulkExportProgress', { completed, total, book: bookName }),
          ),
        exportPreferences,
      );
      setMessage(
        t(
          result.imageFailures
            ? 'bulkExportSavedWithImageFailures'
            : 'bulkExportSaved',
          {
            count: selected.size,
            format: format.toUpperCase(),
            failed: result.imageFailures,
          },
        ),
      );
      addAppLog(
        `Bulk ${format.toUpperCase()} export completed: books=${selected.size}, imageFailures=${result.imageFailures}`,
      );
    } catch (error) {
      addAppLog('Bulk book export failed', error);
      setMessage(
        error instanceof Error &&
          (error.message === 'INVALID_CHAPTER_SCOPE' ||
            error.message === 'EMPTY_CHAPTER_SCOPE')
          ? t(
              error.message === 'INVALID_CHAPTER_SCOPE'
                ? 'invalidChapterScope'
                : 'emptyChapterScope',
            )
          : error instanceof Error
            ? error.message
            : String(error),
      );
    } finally {
      setOperation(undefined);
    }
  };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('bulkBookCache')}
        onBack={back}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('logs')}
            style={s.touch}
            onPress={openLogs}
          >
            <Text style={{ color: colors.primary }}>{t('logs')}</Text>
          </Pressable>
        }
      />
      <View style={[s.toolbar, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text }}>
          {t('selectedBooks', { count: selected.size })}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={s.touch}
          onPress={() => setGroupMenu(true)}
        >
          <Text numberOfLines={1} style={{ color: colors.primary }}>
            {group === 'all'
              ? t('allBookGroups')
              : group === 'ungrouped'
                ? t('ungroupedBooks')
                : (groups.find(item => item.id === group)?.name ?? t('groups'))}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.touch}
          onPress={() => setSortMenu(true)}
        >
          <Text style={{ color: colors.primary }}>
            {t(
              (
                [
                  'sortReadTime',
                  'sortLatestChapter',
                  'sortBookName',
                  'sortManualOrder',
                  'sortRecentActivity',
                ] as const
              )[sort],
            )}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.touch}
          onPress={() => setSelected(new Set(eligible.map(book => book.id)))}
        >
          <Text style={{ color: colors.primary }}>{t('selectAll')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.touch}
          disabled={!selected.size}
          onPress={() => setSelected(expandSelectionInterval(eligible, selected, book => book.id))}
        >
          <Text style={{ color: colors.primary }}>{t('selectInterval')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.touch}
          onPress={() => setSelected(new Set())}
        >
          <Text style={{ color: colors.primary }}>{t('clearSelection')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.list}>
        {eligible.map(book => {
          const cached =
              book.chapters?.filter(
                chapter => chapter.isVolume || chapter.content,
              ).length ?? 0,
            total = book.chapters?.length ?? 0;
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: selected.has(book.id),
                disabled: !!operation,
              }}
              disabled={!!operation}
              key={book.id}
              style={[s.book, { borderColor: colors.border }]}
              onPress={() => toggle(book.id)}
            >
              <Text style={{ color: colors.primary, fontSize: 21 }}>
                {selected.has(book.id) ? '☑' : '☐'}
              </Text>
              <View style={s.bookBody}>
                <Text style={[s.name, { color: colors.text }]}>
                  {book.name}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {t('cacheStats', { cached, total })}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {!eligible.length ? (
          <Text style={{ color: colors.muted }}>
            {t('noOnlineBooksToCache')}
          </Text>
        ) : null}
      </ScrollView>
      <View
        style={[
          s.footer,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        {progress ? (
          <Text numberOfLines={2} style={{ color: colors.text }}>
            {t('bulkCacheProgress', {
              book: progress.bookName,
              books: progress.bookCompleted,
              bookTotal: progress.bookTotal,
              chapters: progress.chapterCompleted,
              chapterTotal: progress.chapterTotal,
            })}
            {'\n'}
            {progress.chapterTitle}
          </Text>
        ) : message ? (
          <Text style={{ color: colors.text }}>{message}</Text>
        ) : null}
        {operation === 'cache' ? (
          <Pressable
            accessibilityRole="button"
            style={[s.action, { backgroundColor: colors.danger }]}
            onPress={() => {
              cancelled.current = true;
              setMessage(t('stoppingCache'));
            }}
          >
            <Text style={s.primary}>{t('stopCache')}</Text>
          </Pressable>
        ) : operation !== 'export' ? (
          <>
            <View style={s.row}>
              <Pressable
                accessibilityRole="button"
                disabled={!selectedCacheable.size}
                accessibilityState={{ disabled: !selectedCacheable.size }}
                style={[
                  s.action,
                  { borderColor: colors.primary },
                  !selectedCacheable.size && s.disabled,
                ]}
                onPress={() => setConfirm('current')}
              >
                <Text style={{ color: colors.primary }}>
                  {t('cacheAfterCurrent')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!selectedCacheable.size}
                accessibilityState={{ disabled: !selectedCacheable.size }}
                style={[
                  s.action,
                  { backgroundColor: colors.primary },
                  !selectedCacheable.size && s.disabled,
                ]}
                onPress={() => setConfirm('all')}
              >
                <Text style={s.primary}>{t('cacheAllChapters')}</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={!selected.size}
              accessibilityState={{ disabled: !selected.size }}
              style={[
                s.action,
                { borderColor: colors.primary },
                !selected.size && s.disabled,
              ]}
              onPress={() => setExportFormat('txt')}
            >
              <Text style={{ color: colors.primary }}>
                {t('bulkExportSelected')}
              </Text>
            </Pressable>
          </>
        ) : null}
        {operation ? <ActivityIndicator color={colors.primary} /> : null}
        {failures.map(item => {
          const count = Number.parseInt(item.message, 10);
          return (
            <Text key={item.bookId} style={{ color: colors.danger }}>
              {item.bookName}:{' '}
              {item.message === 'source missing'
                ? t('sourceMissing')
                : Number.isFinite(count)
                  ? t('bulkChapterFailures', { count })
                  : item.message}
            </Text>
          );
        })}
      </View>
      <InTreeSheet visible={groupMenu} onDismiss={() => setGroupMenu(false)}>
        <Text style={[s.title, { color: colors.text }]}>
          {t('selectBookGroup')}
        </Text>
        <ScrollView>
          {(
            [
              { id: 'all', name: t('allBookGroups') },
              { id: 'ungrouped', name: t('ungroupedBooks') },
              ...groups.map(item => ({ id: item.id, name: item.name })),
            ] as Array<{ id: BulkBookGroupFilter; name: string }>
          ).map(item => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: group === item.id }}
              key={item.id}
              style={[s.groupRow, { borderColor: colors.border }]}
              onPress={() => chooseGroup(item.id)}
            >
              <Text
                style={{
                  color: group === item.id ? colors.primary : colors.text,
                }}
              >
                {group === item.id ? '● ' : '○ '}
                {item.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </InTreeSheet>
      <InTreeSheet visible={sortMenu} onDismiss={() => setSortMenu(false)}>
        <Text style={[s.title, { color: colors.text }]}>
          {t('selectBookSort')}
        </Text>
        {(
          [
            'sortReadTime',
            'sortLatestChapter',
            'sortBookName',
            'sortManualOrder',
            'sortRecentActivity',
          ] as const
        ).map((label, value) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: sort === value }}
            key={label}
            style={[s.groupRow, { borderColor: colors.border }]}
            onPress={() => chooseSort(value as BookGroupSort)}
          >
            <Text
              style={{ color: sort === value ? colors.primary : colors.text }}
            >
              {sort === value ? '● ' : '○ '}
              {t(label)}
            </Text>
          </Pressable>
        ))}
      </InTreeSheet>
      <InTreeSheet visible={!!confirm} onDismiss={() => setConfirm(undefined)}>
        <Text style={[s.title, { color: colors.text }]}>
          {t('confirmBulkCache')}
        </Text>
        <Text style={{ color: colors.muted }}>
          {t(
            confirm === 'all'
              ? 'confirmBulkCacheAll'
              : 'confirmBulkCacheCurrent',
            { count: selectedCacheable.size },
          )}
        </Text>
        <View style={s.row}>
          <Pressable
            accessibilityRole="button"
            style={[s.action, { borderColor: colors.border }]}
            onPress={() => setConfirm(undefined)}
          >
            <Text style={{ color: colors.text }}>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[s.action, { backgroundColor: colors.primary }]}
            onPress={() => confirm && void start(confirm)}
          >
            <Text style={s.primary}>{t('confirm')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
      <InTreeSheet
        visible={!!exportFormat}
        onDismiss={() => setExportFormat(undefined)}
      >
        <ScrollView contentContainerStyle={s.exportSettings}>
          <Text style={[s.title, { color: colors.text }]}>
            {t('chooseBulkExportFormat')}
          </Text>
          <Text style={{ color: colors.muted }}>
            {t('bulkExportZipHelp', { count: selected.size })}
          </Text>
          <ExportToggle
            label={t('exportUseReplace')}
            value={exportPreferences.useReplace}
            onChange={value => changeExportPreference('useReplace', value)}
          />
          <ExportToggle
            label={t('exportNoChapterName')}
            value={exportPreferences.noChapterName}
            onChange={value => changeExportPreference('noChapterName', value)}
          />
          <ExportToggle
            label={t('parallelExport')}
            value={exportPreferences.parallel}
            onChange={value => changeExportPreference('parallel', value)}
          />
          <ExportToggle
            label={t('exportToWebDav')}
            value={exportPreferences.exportToWebDav}
            onChange={value => changeExportPreference('exportToWebDav', value)}
          />
          <ExportToggle
            label={t('exportPictureFile')}
            value={exportPreferences.exportPictureFile}
            onChange={value =>
              changeExportPreference('exportPictureFile', value)
            }
          />
          <Text style={{ color: colors.text }}>
            {t('exportFileNamePattern')}
          </Text>
          <TextInput
            accessibilityLabel={t('exportFileNamePattern')}
            value={exportPreferences.fileNamePattern}
            onChangeText={value =>
              changeExportPreference('fileNamePattern', value)
            }
            placeholder="{name}_{author}"
            placeholderTextColor={colors.muted}
            style={[
              s.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
          <Text style={{ color: colors.text }}>{t('epubChapterScope')}</Text>
          <TextInput
            accessibilityLabel={t('epubChapterScope')}
            value={exportPreferences.epubChapterScope}
            onChangeText={value =>
              changeExportPreference('epubChapterScope', value)
            }
            placeholder="1-5,8,10-18"
            placeholderTextColor={colors.muted}
            style={[
              s.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
          <Text style={{ color: colors.text }}>{t('epubChaptersPerFile')}</Text>
          <TextInput
            accessibilityLabel={t('epubChaptersPerFile')}
            keyboardType="number-pad"
            value={String(exportPreferences.epubChaptersPerFile)}
            onChangeText={value =>
              changeExportPreference(
                'epubChaptersPerFile',
                Math.max(0, Math.min(10000, Number.parseInt(value, 10) || 0)),
              )
            }
            placeholder="0"
            placeholderTextColor={colors.muted}
            style={[
              s.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
          <Text style={{ color: colors.muted }}>{t('epubScopeHelp')}</Text>
          <Text style={{ color: colors.text }}>{t('exportCharset')}</Text>
          <View style={s.wrap}>
            {(
              [
                'UTF-8',
                'GB18030',
                'GBK',
                'BIG5',
                'UTF-16LE',
                'UTF-16BE',
              ] as ExportCharset[]
            ).map(charset => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{
                  checked: exportPreferences.charset === charset,
                }}
                key={charset}
                style={[
                  s.chip,
                  {
                    borderColor:
                      exportPreferences.charset === charset
                        ? colors.primary
                        : colors.border,
                  },
                ]}
                onPress={() => changeExportPreference('charset', charset)}
              >
                <Text
                  style={{
                    color:
                      exportPreferences.charset === charset
                        ? colors.primary
                        : colors.text,
                  }}
                >
                  {charset}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={s.row}>
            {(['txt', 'epub', 'pdf'] as const).map(format => (
              <Pressable
                accessibilityRole="button"
                key={format}
                style={[s.action, { borderColor: colors.primary }]}
                onPress={() => void exportSelected(format)}
              >
                <Text style={{ color: colors.primary }}>
                  {format.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </InTreeSheet>
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  toolbar: {
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: 4,
    gap: 10,
  },
  touch: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  groupRow: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  list: { padding: 14, paddingBottom: 180 },
  book: {
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookBody: { flex: 1, gap: 5 },
  name: { fontSize: 16, fontWeight: '700' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  row: { flexDirection: 'row', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exportSettings: { gap: 12, paddingBottom: 10 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  chip: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: { flex: 1 },
  action: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  primary: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.4 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 10 },
});

function ExportToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={s.toggle}>
      <Text style={[s.toggleLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}
