import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Book } from '../types';
import {
  assignBooksToGroup,
  createBookGroup,
  loadBookGroups,
  loadBookshelfLayout,
  removeGroup,
  saveBookGroups,
  saveBookshelfLayout,
  type BookshelfLayout,
} from '../data/bookshelf';
import { InTreeSheet } from './InTreeSheet';
import { BookCover } from './BookCover';
import { useAppTheme } from '../theme/AppTheme';
import { cleanupEpubAssets } from '../core/epubBook';
export function BookshelfView({
  books,
  open,
  onChange,
  importBooks,
  addByUrl,
  refresh,
  openRemote,
  openTransfer,
  openLogs,
  openBulkCache,
}: {
  books: Book[];
  open: (id: string) => void;
  onChange: (books: Book[]) => void;
  importBooks: () => void;
  addByUrl: () => void;
  refresh: () => Promise<void>;
  openRemote: () => void;
  openTransfer: () => void;
  openLogs: () => void;
  openBulkCache: () => void;
}) {
  const { t } = useAppTheme();
  const [groups, setGroups] = useState(loadBookGroups),
    [active, setActive] = useState<string>('all'),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [layout, setLayout] = useState<BookshelfLayout>(loadBookshelfLayout),
    [manage, setManage] = useState(false),
    [assign, setAssign] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [mainMenu, setMainMenu] = useState(false),
    [newName, setNewName] = useState(''),
    [error, setError] = useState(''),
    [refreshing, setRefreshing] = useState(false),
    visible = useMemo(
      () =>
        active === 'all'
          ? books
          : books.filter(x => x.groupIds?.includes(active)),
      [active, books],
    );
  const commitGroups = (next: typeof groups) => {
      setGroups(next);
      saveBookGroups(next);
    },
    toggle = (id: string) =>
      setSelected(old => {
        const next = new Set(old);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    choose = (book: Book) => (selected.size ? toggle(book.id) : open(book.id)),
    changeLayout = () => {
      const next = layout === 'list' ? 'grid' : 'list';
      setLayout(next);
      saveBookshelfLayout(next);
    },
    add = () => {
      try {
        const next = createBookGroup(newName, groups);
        commitGroups(next);
        setNewName('');
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
  return (
    <View style={s.flex}>
      <View style={s.toolbar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
        >
          <Chip
            label={t('all')}
            active={active === 'all'}
            onPress={() => setActive('all')}
          />
          {groups
            .filter(x => x.show)
            .map(group => (
              <Chip
                key={group.id}
                label={group.name}
                active={active === group.id}
                onPress={() => setActive(group.id)}
              />
            ))}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          disabled={refreshing}
          accessibilityLabel={t('refreshBookshelf')}
          style={s.toolButton}
          onPress={() => {
            setRefreshing(true);
            void refresh().finally(() => setRefreshing(false));
          }}
        >
          <Text>{refreshing ? '…' : '↻'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('importLocalBooks')}
          style={s.toolButton}
          onPress={importBooks}
        >
          <Text>{t('import')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('addBookByUrl')}
          style={s.toolButton}
          onPress={addByUrl}
        >
          <Text>URL</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('switchBookshelfLayout')}
          style={s.toolButton}
          onPress={changeLayout}
        >
          <Text>{layout === 'list' ? '▦' : '☷'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('manageGroups')}
          style={s.toolButton}
          onPress={() => setManage(true)}
        >
          <Text>{t('groups')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('bookshelfActions')}
          style={s.toolButton}
          onPress={() => setMainMenu(true)}
        >
          <Text style={s.more}>⋮</Text>
        </Pressable>
      </View>
      {selected.size ? (
        <View style={s.selection}>
          <Text>{t('selectedBooks', { count: selected.size })}</Text>
          <Pressable
            accessibilityRole="button"
            style={s.action}
            onPress={() => setAssign(true)}
          >
            <Text>{t('assignGroup')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.dangerAction}
            onPress={() => setConfirmDelete(true)}
          >
            <Text style={s.dangerText}>{t('delete')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.action}
            onPress={() => setSelected(new Set())}
          >
            <Text>{t('cancel')}</Text>
          </Pressable>
        </View>
      ) : null}
      {visible.length ? (
        <ScrollView
          contentContainerStyle={[s.list, layout === 'grid' && s.grid]}
        >
          {visible.map(book => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: selected.has(book.id) }}
              key={book.id}
              style={[
                layout === 'grid' ? s.gridBook : s.book,
                selected.has(book.id) && s.selected,
              ]}
              onPress={() => choose(book)}
              onLongPress={() => toggle(book.id)}
            >
              <BookCover
                name={book.name}
                author={book.author}
                uri={book.coverUrl}
                style={[s.cover, layout === 'grid' && s.gridCover]}
              />
              <View style={s.bookText}>
                <Text numberOfLines={1} style={s.bookName}>
                  {book.name}
                </Text>
                <Text numberOfLines={1} style={s.muted}>
                  {book.author} · {book.chapterTitle}
                </Text>
                {layout === 'list' ? (
                  <Text numberOfLines={2} style={s.intro}>
                    {book.intro}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={s.center}>
          <Text style={s.empty}>{t('emptyGroup')}</Text>
        </View>
      )}
      <InTreeSheet visible={manage} onDismiss={() => setManage(false)}>
        <Text style={s.sheetTitle}>{t('groupManagement')}</Text>
        <View style={s.addRow}>
          <TextInput
            accessibilityLabel={t('newGroupName')}
            value={newName}
            onChangeText={setNewName}
            placeholder={t('newGroupName')}
            style={s.input}
          />
          <Pressable accessibilityRole="button" style={s.primary} onPress={add}>
            <Text style={s.primaryText}>{t('add')}</Text>
          </Pressable>
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <ScrollView>
          {groups.map(group => (
            <View key={group.id} style={s.groupRow}>
              <Text style={s.groupName}>{group.name}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('deleteNamed', { name: group.name })}
                style={s.toolButton}
                onPress={() => {
                  const next = removeGroup(books, groups, group.id);
                  commitGroups(next.groups);
                  onChange(next.books);
                  if (active === group.id) setActive('all');
                }}
              >
                <Text style={s.error}>{t('delete')}</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </InTreeSheet>
      <InTreeSheet visible={assign} onDismiss={() => setAssign(false)}>
        <Text style={s.sheetTitle}>{t('assignGroup')}</Text>
        {groups.length ? (
          groups.map(group => (
            <Pressable
              accessibilityRole="button"
              key={group.id}
              style={s.groupRow}
              onPress={() => {
                onChange(assignBooksToGroup(books, selected, group.id));
                setAssign(false);
                setSelected(new Set());
              }}
            >
              <Text style={s.groupName}>{group.name}</Text>
              <Text>›</Text>
            </Pressable>
          ))
        ) : (
          <Text style={s.muted}>{t('createGroupFirst')}</Text>
        )}
      </InTreeSheet>
      <InTreeSheet
        visible={confirmDelete}
        onDismiss={() => setConfirmDelete(false)}
      >
        <Text style={s.sheetTitle}>{t('deleteBooksTitle')}</Text>
        <Text style={s.muted}>
          {t('deleteBooksDescription', { count: selected.size })}
        </Text>
        <View style={s.confirmRow}>
          <Pressable
            accessibilityRole="button"
            style={s.action}
            onPress={() => setConfirmDelete(false)}
          >
            <Text>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.dangerAction}
            onPress={() => {
              const removed = books.filter(x => selected.has(x.id));
              void Promise.all(
                removed.map(book => cleanupEpubAssets(book).catch(() => false)),
              );
              onChange(books.filter(x => !selected.has(x.id)));
              setSelected(new Set());
              setConfirmDelete(false);
            }}
          >
            <Text style={s.dangerText}>{t('confirmDelete')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
      <InTreeSheet visible={mainMenu} onDismiss={() => setMainMenu(false)}>
        <Text style={s.sheetTitle}>{t('bookshelfActions')}</Text>
        <MenuAction
          label={t('remoteBooks')}
          run={() => {
            setMainMenu(false);
            openRemote();
          }}
        />
        <MenuAction
          label={t('bookshelfTransfer')}
          run={() => {
            setMainMenu(false);
            openTransfer();
          }}
        />
        <MenuAction
          label={t('bulkBookCache')}
          run={() => {
            setMainMenu(false);
            openBulkCache();
          }}
        />
        <MenuAction
          label={t('logs')}
          run={() => {
            setMainMenu(false);
            openLogs();
          }}
        />
      </InTreeSheet>
    </View>
  );
}
function MenuAction({ label, run }: { label: string; run: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={s.menuAction} onPress={run}>
      <Text>{label}</Text>
      <Text>›</Text>
    </Pressable>
  );
}
function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[s.chip, active && s.chipActive]}
      onPress={onPress}
    >
      <Text numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  toolbar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  chips: { alignItems: 'center', gap: 8, paddingRight: 8 },
  chip: {
    minHeight: 40,
    minWidth: 60,
    maxWidth: 120,
    borderRadius: 20,
    backgroundColor: '#eee',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { borderWidth: 2, borderColor: '#397554' },
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
  list: { padding: 12, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  book: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
  },
  gridBook: {
    width: '47%',
    margin: '1.5%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
  },
  selected: { borderWidth: 2, borderColor: '#397554' },
  cover: {
    width: 64,
    height: 88,
    borderRadius: 7,
    backgroundColor: '#426b55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCover: { width: '100%', height: 130 },
  coverText: { color: '#fff', fontWeight: '700' },
  bookText: { flex: 1, padding: 8, gap: 7 },
  bookName: { fontSize: 17, fontWeight: '600', color: '#222' },
  muted: { color: '#777' },
  intro: { color: '#555', lineHeight: 19 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 18, color: '#777' },
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
