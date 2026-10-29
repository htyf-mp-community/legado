import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { InTreeSheet } from './InTreeSheet';
import { BookCover } from './BookCover';
import { useAppTheme } from '../theme/AppTheme';
import { useBookGroups } from '../hooks/useBookGroups';
import {
  createBookGroup,
  moveBookGroup,
  removeGroup,
  saveBookGroups,
} from '../data/bookshelf';
import {
  isBuiltInGroup,
  setBooksGroups,
  userBookGroups,
} from '../core/bookshelfGroups';
import { pickReaderBackground } from '../core/readerBackground';
import type { Book, BookGroup } from '../types';

const sortLabels = [
  'shelfSortDefault',
  'shelfSortRead',
  'shelfSortUpdate',
  'shelfSortName',
  'shelfSortManual',
  'shelfSortActivity',
  'shelfSortAuthor',
] as const;
export function BookGroupEditorSheet({
  visible,
  group,
  books,
  onBooksChange,
  dismiss,
}: {
  visible: boolean;
  group?: BookGroup;
  books: Book[];
  onBooksChange: (books: Book[]) => void;
  dismiss: () => void;
}) {
  const { colors, t } = useAppTheme(),
    { groups, error: loadError } = useBookGroups();
  const [name, setName] = useState(''),
    [sort, setSort] = useState(-1),
    [refresh, setRefresh] = useState(true),
    [onlyRead, setOnlyRead] = useState(false),
    [cover, setCover] = useState<string>(),
    [chooseSort, setChooseSort] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    setName(group?.name ?? '');
    setSort(group?.bookSort ?? -1);
    setRefresh(group?.enableRefresh ?? true);
    setOnlyRead(group?.onlyUpdateRead === true);
    setCover(group?.cover);
    setError('');
  }, [visible, group]);
  const commit = () => {
    try {
      if (!name) throw new Error(t('shelfGroupName'));
      if (loadError) throw new Error(t('shelfGroupDataError'));
      const original = group ?? createBookGroup(name, groups).at(-1)!;
      const value = {
        ...original,
        name,
        bookSort: sort,
        enableRefresh: refresh,
        onlyUpdateRead: onlyRead,
        cover,
      };
      saveBookGroups([...groups.filter(item => item.id !== value.id), value]);
      dismiss();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <>
      <InTreeSheet visible={visible} onDismiss={dismiss}>
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t(group ? 'shelfGroupEdit' : 'shelfGroupAdd')}
        </Text>
        <View style={s.editorTop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('shelfChooseCover')}
            onPress={() => {
              void pickReaderBackground()
                .then(setCover)
                .catch(cause => {
                  if (
                    !isErrorWithCode(cause) ||
                    cause.code !== errorCodes.OPERATION_CANCELED
                  )
                    setError(String(cause));
                });
            }}
          >
            <BookCover name="" uri={cover} style={s.cover} />
          </Pressable>
          <View style={s.editorFields}>
            <Text style={{ color: colors.muted }}>{t('shelfGroupName')}</Text>
            <TextInput
              accessibilityLabel={t('shelfGroupName')}
              value={name}
              onChangeText={setName}
              style={[
                s.nameInput,
                { color: colors.text, borderColor: colors.border },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              style={s.choice}
              onPress={() => setChooseSort(true)}
            >
              <Text style={{ color: colors.text }}>
                {t('shelfGroupSort')}：
                {t(sortLabels[sort + 1] ?? 'shelfSortDefault')}
              </Text>
            </Pressable>
          </View>
        </View>
        {cover ? (
          <Action
            label={t('shelfClearCover')}
            press={() => setCover(undefined)}
          />
        ) : null}
        <Toggle
          label={t('shelfAllowRefresh')}
          value={refresh}
          change={setRefresh}
        />
        <Toggle
          label={t('shelfOnlyRead')}
          value={onlyRead}
          change={setOnlyRead}
        />
        {loadError || error ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {loadError ? t('shelfGroupDataError') : error}
          </Text>
        ) : null}
        <View style={s.footer}>
          {group && !isBuiltInGroup(group.id) ? (
            <Action
              label={t('delete')}
              press={() => setConfirmDelete(true)}
              danger
            />
          ) : null}
          <View style={s.flex} />
          <Action label={t('cancel')} press={dismiss} />
          <Action label={t('confirm')} press={commit} />
        </View>
      </InTreeSheet>
      <InTreeSheet visible={chooseSort} onDismiss={() => setChooseSort(false)}>
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('shelfGroupSort')}
        </Text>
        {sortLabels.map((label, index) => (
          <Pressable
            key={label}
            accessibilityRole="radio"
            accessibilityLabel={t(label)}
            accessibilityState={{ selected: sort === index - 1 }}
            style={s.choice}
            onPress={() => {
              setSort(index - 1);
              setChooseSort(false);
            }}
          >
            <Text
              style={{
                color: sort === index - 1 ? colors.accent : colors.text,
              }}
            >
              {sort === index - 1 ? '◉ ' : '○ '}
              {t(label)}
            </Text>
          </Pressable>
        ))}
      </InTreeSheet>
      <InTreeSheet
        visible={confirmDelete}
        onDismiss={() => setConfirmDelete(false)}
      >
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('shelfGroupDelete')}
        </Text>
        <Text style={{ color: colors.text }}>{t('shelfGroupDeleteHelp')}</Text>
        <View style={s.footer}>
          <Action label={t('cancel')} press={() => setConfirmDelete(false)} />
          <Action
            label={t('confirmDelete')}
            danger
            press={() => {
              if (!group) return;
              const result = removeGroup(books, groups, group.id);
              saveBookGroups(result.groups);
              onBooksChange(result.books);
              setConfirmDelete(false);
              dismiss();
            }}
          />
        </View>
      </InTreeSheet>
    </>
  );
}
export function BookGroupManageSheet({
  visible,
  books,
  onBooksChange,
  dismiss,
}: {
  visible: boolean;
  books: Book[];
  onBooksChange: (books: Book[]) => void;
  dismiss: () => void;
}) {
  const { groups, error } = useBookGroups(),
    { colors, t } = useAppTheme();
  const [editor, setEditor] = useState(false),
    [editing, setEditing] = useState<BookGroup>();
  return (
    <>
      <InTreeSheet
        visible={visible}
        onDismiss={dismiss}
        enableContentPanningGesture={false}
      >
        <View style={s.titleRow}>
          <Text
            accessibilityRole="header"
            style={[s.heading, s.flex, { color: colors.text }]}
          >
            {t('manageGroups')}
          </Text>
          <Action
            label={t('shelfGroupAdd')}
            press={() => {
              setEditing(undefined);
              setEditor(true);
            }}
          />
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {t('shelfGroupDataError')}
          </Text>
        ) : (
          groups.map(group => (
            <DraggableGroupRow
              key={group.id}
              group={group}
              move={offset =>
                saveBookGroups(moveBookGroup(groups, group.id, offset))
              }
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('shelfEditGroup', { name: group.name })}
                style={s.editButton}
                onPress={() => {
                  setEditing(group);
                  setEditor(true);
                }}
              >
                <Text style={{ color: colors.text }}>{t('edit')}</Text>
              </Pressable>
              <Switch
                style={s.switch}
                accessibilityLabel={t('shelfShowGroup', { name: group.name })}
                value={group.show}
                trackColor={{ true: colors.accent }}
                onValueChange={show => {
                  saveBookGroups(
                    groups.map(item =>
                      item.id === group.id ? { ...item, show } : item,
                    ),
                  );
                }}
              />
            </DraggableGroupRow>
          ))
        )}
        <View style={s.footer}>
          <View style={s.flex} />
          <Action label={t('confirm')} press={dismiss} />
        </View>
      </InTreeSheet>
      <BookGroupEditorSheet
        visible={editor}
        group={editing}
        books={books}
        onBooksChange={onBooksChange}
        dismiss={() => setEditor(false)}
      />
    </>
  );
}
function DraggableGroupRow({
  group,
  move,
  children,
}: {
  group: BookGroup;
  move: (offset: number) => void;
  children: ReactNode;
}) {
  const { colors, t } = useAppTheme();
  const translate = useRef(new Animated.Value(0)).current,
    armed = useRef(false),
    height = useRef(64),
    moved = useRef(move);
  moved.current = move;
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        armed.current && Math.abs(gesture.dy) > 3,
      onPanResponderGrant: () => {
        draggingRef.current = true;
        setDragging(true);
      },
      onPanResponderMove: (_event, gesture) => translate.setValue(gesture.dy),
      onPanResponderRelease: (_event, gesture) => {
        const offset = Math.round(gesture.dy / height.current);
        armed.current = false;
        draggingRef.current = false;
        translate.setValue(0);
        setDragging(false);
        if (offset) moved.current(offset);
      },
      onPanResponderTerminate: () => {
        armed.current = false;
        draggingRef.current = false;
        translate.setValue(0);
        setDragging(false);
      },
    }),
  ).current;
  return (
    <Animated.View
      {...pan.panHandlers}
      onLayout={event => {
        height.current = event.nativeEvent.layout.height || 64;
      }}
      style={[
        s.groupRow,
        {
          borderColor: colors.border,
          backgroundColor: colors.background,
          transform: [{ translateY: translate }],
          zIndex: dragging ? 2 : 0,
          opacity: dragging ? 0.85 : 1,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={group.name}
        accessibilityHint={t('shelfGroupDrag')}
        style={s.flex}
        onLongPress={() => {
          armed.current = true;
        }}
        onPressOut={() => {
          void Promise.resolve().then(() => {
            if (!draggingRef.current) armed.current = false;
          });
        }}
        accessibilityActions={[
          {
            name: 'decrement',
            label: t('shelfGroupMoveUp', { name: group.name }),
          },
          {
            name: 'increment',
            label: t('shelfGroupMoveDown', { name: group.name }),
          },
        ]}
        onAccessibilityAction={event =>
          move(event.nativeEvent.actionName === 'decrement' ? -1 : 1)
        }
      >
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14 }}>
          {group.name}
          {isBuiltInGroup(group.id)
            ? `(${['全部', '本地', '音频', '网络未分组', '本地未分组', '视频', '更新失败'][['-1', '-2', '-3', '-4', '-5', '-6', '-11'].indexOf(group.id)]})`
            : ''}
        </Text>
      </Pressable>
      {children}
    </Animated.View>
  );
}
export function BookGroupAssignSheet({
  visible,
  books,
  selected,
  onBooksChange,
  dismiss,
  preselect = true,
  onAssign,
  title,
}: {
  visible: boolean;
  books: Book[];
  selected: ReadonlySet<string>;
  onBooksChange: (books: Book[]) => void;
  dismiss: () => void;
  preselect?: boolean;
  onAssign?: (groups: ReadonlySet<string>) => void;
  title?: string;
}) {
  const { groups, error } = useBookGroups(),
    { colors, t } = useAppTheme();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [addGroup, setAddGroup] = useState(false);
  const currentBooks = useRef(books);
  currentBooks.current = books;
  useEffect(() => {
    if (visible)
      setPicked(
        new Set(
          preselect && selected.size === 1
            ? (currentBooks.current.find(book => selected.has(book.id))
                ?.groupIds ?? [])
            : [],
        ),
      );
  }, [visible, selected, preselect]);
  const togglePicked = (id: string) =>
    setPicked(previous => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <>
      <InTreeSheet visible={visible} onDismiss={dismiss}>
        <View style={s.titleRow}>
          <Text
            accessibilityRole="header"
            style={[s.heading, s.flex, { color: colors.text }]}
          >
            {title ?? t('assignGroup')}
          </Text>
          <Action label={t('shelfGroupAdd')} press={() => setAddGroup(true)} />
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {t('shelfGroupDataError')}
          </Text>
        ) : (
          userBookGroups(groups).map(group => (
            <Pressable
              key={group.id}
              accessibilityRole="checkbox"
              accessibilityLabel={group.name}
              accessibilityState={{ checked: picked.has(group.id) }}
              accessibilityActions={[
                { name: 'toggleGroup', label: group.name },
              ]}
              onAccessibilityAction={event => {
                if (event.nativeEvent.actionName === 'toggleGroup')
                  togglePicked(group.id);
              }}
              style={s.choice}
              onPress={() => togglePicked(group.id)}
            >
              <Text style={{ color: colors.text }}>
                {picked.has(group.id) ? '☑' : '☐'} {group.name}
              </Text>
            </Pressable>
          ))
        )}
        <View style={s.footer}>
          <Action
            label={t('shelfClearGroups')}
            press={() => setPicked(new Set())}
          />
          <View style={s.flex} />
          <Action label={t('cancel')} press={dismiss} />
          <Action
            label={t('confirm')}
            press={() => {
              if (error) return;
              if (onAssign) onAssign(picked);
              else
                onBooksChange(setBooksGroups(books, selected, picked, groups));
              dismiss();
            }}
          />
        </View>
      </InTreeSheet>
      <BookGroupEditorSheet
        visible={addGroup}
        books={books}
        onBooksChange={onBooksChange}
        dismiss={() => setAddGroup(false)}
      />
    </>
  );
}
function Action({
  label,
  press,
  danger = false,
}: {
  label: string;
  press: () => void;
  danger?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={s.action}
      onPress={press}
    >
      <Text style={{ color: danger ? colors.danger : colors.accent }}>
        {label}
      </Text>
    </Pressable>
  );
}
function Toggle({
  label,
  value,
  change,
}: {
  label: string;
  value: boolean;
  change: (value: boolean) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={s.toggle}>
      <Text style={[s.flex, { color: colors.text }]}>{label}</Text>
      <Switch
        style={s.switch}
        accessibilityLabel={label}
        value={value}
        onValueChange={change}
        trackColor={{ true: colors.accent }}
      />
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  switch: { alignSelf: 'center' },
  heading: { fontSize: 20, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  editorTop: { flexDirection: 'row', gap: 12 },
  cover: { width: 90, height: 126 },
  editorFields: { flex: 1 },
  nameInput: { minHeight: 44, borderBottomWidth: 1, fontSize: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    flexWrap: 'wrap',
  },
  action: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggle: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8 },
  choice: { minHeight: 48, justifyContent: 'center' },
  groupRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  editButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
});
