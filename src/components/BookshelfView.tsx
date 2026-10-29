import { useEffect, useMemo, useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import jssdk from '@htyf-mp/js-sdk';
import { errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import {
  Pressable,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Book, BookGroup } from '../types';
import {
  loadActiveBookGroup,
  saveActiveBookGroup,
  saveBookGroups,
  loadBookshelfSort,
} from '../data/bookshelf';
import {
  booksInGroup,
  visibleBookGroups,
  sortShelfBooks,
} from '../core/bookshelfGroups';
import { useBookGroups } from '../hooks/useBookGroups';
import {
  BookGroupManageSheet,
  BookGroupEditorSheet,
} from './BookGroupSheets';
import { InTreeSheet } from './InTreeSheet';
import { PageHeader } from './PageHeader';
import { SourceIcon } from './SourceIcon';
import { BookshelfLayoutSheet } from './BookshelfLayoutSheet';
import { BookshelfContent, type ShelfItem } from './BookshelfContent';
import { BookshelfHeader } from './BookshelfHeader';
import { BookListImportSheet } from './BookListImportSheet';
import { saveBookList } from '../core/bookListFile';
import { importBookListInput } from '../services/bookList';
import { useBookshelfPreferences } from '../hooks/useBookshelfPreferences';
import { useBookshelfRefresh } from '../hooks/useBookshelfRefresh';
import { folderPreviewBooks, folderShelfSort } from '../core/bookshelfDisplay';
import { useAppTheme } from '../theme/AppTheme';
const emptySelection = new Set<string>();
export function BookshelfView({
  books,
  open,
  openDetails,
  search,
  onChange,
  importBooks,
  addByUrl,
  refresh,
  openRemote,
  openLogs,
  openBulkCache,
  openManage,
}: {
  books: Book[];
  open: (id: string) => void;
  openDetails: (id: string) => void;
  search: () => void;
  onChange: (books: Book[]) => void;
  importBooks: () => void;
  addByUrl: () => void;
  refresh: (group: BookGroup) => Promise<void>;
  openRemote: () => void;
  openLogs: () => void;
  openBulkCache: () => void;
  openManage: (groupId: string) => void;
}) {
  const { t, colors } = useAppTheme();
  const { groups, error: groupError } = useBookGroups();
  const { preferences, error: preferencesError } = useBookshelfPreferences();
  const refreshState = useBookshelfRefresh();
  const [active, setActive] = useState(loadActiveBookGroup),
    [folder, setFolder] = useState('-100'),
    [layoutSheet, setLayoutSheet] = useState(false),
    [bookListImport, setBookListImport] = useState(false),
    [exportPath, setExportPath] = useState<string>(),
    [manage, setManage] = useState(false),
    [mainMenu, setMainMenu] = useState(false),
    [editingGroup, setEditingGroup] = useState<BookGroup>(),
    [editGroup, setEditGroup] = useState(false),
    [error, setError] = useState(''),
    [refreshing, setRefreshing] = useState(false),
    visibleGroups = useMemo(
      () => visibleBookGroups(groups, books),
      [groups, books],
    ),
    currentGroup =
      preferences.groupStyle === 1
        ? (groups.find(group => group.id === folder) ?? {
            id: '-100',
            name: t('bookshelf'),
            order: 0,
            show: true,
            enableRefresh: true,
            bookSort: -1,
          })
        : (visibleGroups.find(group => group.id === active) ??
          visibleGroups[0] ??
          groups.find(group => group.id === '-1')!),
    visible = useMemo(
      () =>
        sortShelfBooks(
          booksInGroup(books, currentGroup.id, groups),
          preferences.groupStyle === 1
            ? folderShelfSort(
                currentGroup.bookSort === undefined || currentGroup.bookSort < 0
                  ? preferences.sort
                  : currentGroup.bookSort,
              )
            : currentGroup.bookSort === undefined || currentGroup.bookSort < 0
              ? loadBookshelfSort()
              : currentGroup.bookSort,
        ),
      [books, currentGroup, groups, preferences],
    );
  const folderGroups =
    preferences.groupStyle === 1 && currentGroup.id === '-100'
      ? visibleGroups
      : [];
  const shelfItems: ShelfItem[] = [
    ...folderGroups.map(group => ({
      key: `group:${group.id}`,
      group,
      preview: folderPreviewBooks(books, groups, group, preferences.sort),
    })),
    ...visible.map(book => ({ key: `book:${book.id}`, book })),
  ];
  useEffect(() => {
    setFolder('-100');
  }, [preferences.groupStyle]);
  useEffect(() => {
    if (preferences.groupStyle !== 1 || currentGroup.id === '-100') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setFolder('-100');
      return true;
    });
    return () => listener.remove();
  }, [preferences.groupStyle, currentGroup.id]);
  useEffect(() => {
    if (groupError || preferences.groupStyle === 1) return;
    if (!visibleGroups.length)
      saveBookGroups(
        groups.map(group =>
          group.id === '-1' ? { ...group, show: true } : group,
        ),
      );
    else if (currentGroup.id !== active)
      setActive(saveActiveBookGroup(currentGroup.id));
  }, [
    visibleGroups,
    currentGroup,
    groups,
    active,
    groupError,
    preferences.groupStyle,
  ]);
  const chooseGroup = (id: string) => setActive(saveActiveBookGroup(id));
  const runRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    void refresh(currentGroup)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setRefreshing(false));
  };
  const exportList = async () => {
    try {
      setError('');
      const result = await saveBookList(visible);
      setExportPath(result.uri);
    } catch (cause) {
      if (
        !(
          isErrorWithCode(cause) && cause.code === errorCodes.OPERATION_CANCELED
        )
      )
        setError(
          `${t('bookListExportError')}\n${cause instanceof Error ? cause.message : String(cause)}`,
        );
    }
  };
  const importList = (input: string) => {
    const groupId = currentGroup.id;
    void importBookListInput(input, groupId, cause => {
      setError(cause.message);
      void jssdk.showToast({ type: 'error', title: cause.message });
    })
      .then(() =>
        jssdk.showToast({ type: 'success', title: t('bookListSuccess') }),
      )
      .catch(cause => {
        void jssdk.showToast({
          type: 'error',
          title: cause instanceof Error ? cause.message : String(cause),
        });
        setError(
          `${t('bookListImportError')}\n${cause instanceof Error ? cause.message : String(cause)}`,
        );
      });
  };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        sourceTone
        title={
          preferences.groupStyle === 1 && currentGroup.id !== '-100'
            ? `${t('bookshelf')}(${currentGroup.name})`
            : t('bookshelf')
        }
        onBack={
          preferences.groupStyle === 1 && currentGroup.id !== '-100'
            ? () => setFolder('-100')
            : undefined
        }
        action={
          <View style={s.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('search')}
              style={s.toolButton}
              onPress={search}
            >
              <SourceIcon name="ic_search" color={colors.toolbarText} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('bookshelfActions')}
              style={s.toolButton}
              onPress={() => setMainMenu(true)}
            >
              <SourceIcon name="ic_more_vert" color={colors.toolbarText} />
            </Pressable>
          </View>
        }
      />
      {preferences.groupStyle === 0 ? (
        <View
          style={[s.toolbar, { backgroundColor: colors.toolbarBackground }]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
          >
            {visibleGroups.map(group => (
              <Chip
                key={group.id}
                label={group.name}
                active={currentGroup.id === group.id}
                onPress={() => chooseGroup(group.id)}
                onLongPress={() => {
                  setEditingGroup(group);
                  setEditGroup(true);
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <BookshelfHeader
        books={books}
        preferences={preferences}
        open={open}
        details={openDetails}
      />
      <BookshelfContent
        items={shelfItems}
        preferences={preferences}
        selected={emptySelection}
        running={refreshState.running}
        empty={
          currentGroup.id === '-1' || currentGroup.id === '-100'
            ? t('shelfEmpty')
            : t('emptyGroup')
        }
        open={book => open(book.id)}
        details={book => openDetails(book.id)}
        openGroup={group => setFolder(group.id)}
        editGroup={group => {
          setEditingGroup(group);
          setEditGroup(true);
        }}
        refresh={runRefresh}
        enableRefresh={currentGroup.enableRefresh && shelfItems.length > 0}
      />
      <BookshelfLayoutSheet
        visible={layoutSheet}
        dismiss={() => setLayoutSheet(false)}
      />
      <BookListImportSheet
        visible={bookListImport}
        dismiss={() => setBookListImport(false)}
        submit={importList}
      />
      <InTreeSheet
        visible={exportPath !== undefined}
        onDismiss={() => setExportPath(undefined)}
      >
        <Text
          accessibilityRole="header"
          style={[s.sheetTitle, { color: colors.text }]}
        >
          {t('bookListExportSuccess')}
        </Text>
        <TextInput
          accessibilityLabel={t('bookListPath')}
          value={exportPath ?? ''}
          editable={false}
          selectTextOnFocus
          style={{ color: colors.text, minHeight: 44 }}
        />
        <Pressable
          accessibilityRole="button"
          style={s.action}
          onPress={() => {
            Clipboard.setString(exportPath ?? '');
            setExportPath(undefined);
          }}
        >
          <Text>{t('confirm')}</Text>
        </Pressable>
      </InTreeSheet>
      {(error || groupError || preferencesError) && !manage ? (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.danger, padding: 8 }}
        >
          {groupError
            ? t('shelfGroupDataError')
            : preferencesError
              ? t('shelfPreferencesError')
              : error}
        </Text>
      ) : null}
      <BookGroupManageSheet
        visible={manage}
        books={books}
        onBooksChange={onChange}
        dismiss={() => setManage(false)}
      />
      <BookGroupEditorSheet
        visible={editGroup}
        group={editingGroup}
        books={books}
        onBooksChange={onChange}
        dismiss={() => setEditGroup(false)}
      />
      <InTreeSheet visible={mainMenu} onDismiss={() => setMainMenu(false)}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          {t('bookshelfActions')}
        </Text>
        {[
          { label: t('refreshBookshelf'), run: runRefresh },
          { label: t('importLocalBooks'), run: importBooks },
          { label: t('remoteBooks'), run: openRemote },
          { label: t('addBookByUrl'), run: addByUrl },
          { label: t('shelfManage'), run: () => openManage(currentGroup.id) },
          { label: t('bulkBookCache'), run: openBulkCache },
          { label: t('manageGroups'), run: () => setManage(true) },
          { label: t('shelfLayoutTitle'), run: () => setLayoutSheet(true) },
          { label: t('bookListExport'), run: () => void exportList() },
          { label: t('bookListImport'), run: () => setBookListImport(true) },
          { label: t('logs'), run: openLogs },
        ].map(item => (
          <MenuAction
            key={item.label}
            label={item.label}
            run={() => {
              setMainMenu(false);
              item.run();
            }}
          />
        ))}
      </InTreeSheet>
    </View>
  );
}
function MenuAction({ label, run }: { label: string; run: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" style={s.menuAction} onPress={run}>
      <Text style={{ color: colors.text }}>{label}</Text>
    </Pressable>
  );
}
function Chip({
  label,
  active,
  onPress,
  onLongPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors, t } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[
        s.chip,
        { borderBottomColor: active ? colors.accent : 'transparent' },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityActions={
        onLongPress
          ? [{ name: 'longpress', label: t('shelfGroupEdit') }]
          : undefined
      }
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'longpress') onLongPress?.();
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: colors.toolbarText,
          opacity: active ? 1 : 0.7,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  toolbar: { height: 48, flexDirection: 'row', alignItems: 'stretch' },
  chips: { alignItems: 'stretch' },
  chip: {
    minWidth: 72,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolButton: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: { fontSize: 22, fontWeight: '700' },
  menuAction: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selection: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f5f2',
  },
  action: {
    minHeight: 44,
    minWidth: 60,
    borderRadius: 22,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dangerAction: {
    minHeight: 44,
    minWidth: 60,
    borderRadius: 22,
    backgroundColor: '#a43a3a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dangerText: { color: '#fff', fontWeight: '700' },
  list: { paddingTop: 4, paddingBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 4 },
  book: {
    flexDirection: 'row',
    minHeight: 94,
    paddingLeft: 8,
    paddingRight: 16,
    paddingBottom: 4,
  },
  gridBook: { width: '48%', margin: '1%', padding: 4, alignItems: 'center' },
  selected: { backgroundColor: '#ACACAC63' },
  cover: { width: 66, height: 90 },
  gridCover: { width: '100%', height: 180 },
  bookText: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  gridText: { marginLeft: 0, paddingTop: 4 },
  bookName: { fontSize: 16, paddingLeft: 2, paddingBottom: 4 },
  gridName: { fontSize: 12, textAlign: 'center' },
  description: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  descriptionText: { flex: 1, fontSize: 13 },
  muted: { color: '#777' },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  empty: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 14 },
  addRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#eee',
    paddingHorizontal: 14,
  },
  primary: {
    minHeight: 46,
    minWidth: 72,
    borderRadius: 23,
    backgroundColor: '#397554',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  error: { color: '#a13b3b', marginTop: 8 },
  groupRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  groupName: { flex: 1, fontSize: 16 },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
});
