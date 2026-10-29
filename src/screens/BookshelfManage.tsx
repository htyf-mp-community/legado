import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import jssdk from '@htyf-mp/js-sdk';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import type { Book } from '../types';
import { PageHeader } from '../components/PageHeader';
import { SourceIcon } from '../components/SourceIcon';
import { InTreeSheet } from '../components/InTreeSheet';
import { BatchSourcePicker } from '../components/BatchSourcePicker';
import {
  BookGroupAssignSheet,
  BookGroupManageSheet,
} from '../components/BookGroupSheets';
import { ManagedBookRow, SelectionMark } from '../components/ManagedBookRow';
import { useLibrary } from '../hooks/useLibrary';
import { useBookGroups } from '../hooks/useBookGroups';
import { useCapsule } from '../hooks/useCapsule';
import { useAppTheme } from '../theme/AppTheme';
import { loadBookshelfSort } from '../data/bookshelf';
import { loadLibrary, updateLibrary } from '../data/library';
import { loadSources, exportBookSources } from '../data/sources';
import {
  loadDeleteBookOriginal,
  loadOpenBookTitle,
  saveDeleteBookOriginal,
  saveOpenBookTitle,
} from '../data/bookshelfManagePreferences';
import {
  assignManagedGroups,
  invertManagedSelection,
  manageShelfBooks,
  reorderManagedBooks,
  selectAllManaged,
  setManagedCanUpdate,
  usedShelfSources,
  type ManageGroupAction,
} from '../core/bookshelfManagement';
import { expandSelectionInterval } from '../core/selectionInterval';
import { isLocalBook } from '../core/bookKinds';
import { saveJsonDocument } from '../core/jsonTransfer';
import {
  clearManagedBookCache,
  deleteManagedBooks,
  refreshManagedBooks,
} from '../services/bookshelfManagement';
import { DEFAULT_AUTO_TASK_CRON } from '../data/autoTasks';
import { CronSchedule } from '../core/cronSchedule';
import { createBookUpdateTasks } from '../services/bookUpdateTasks';
import { startBatchSourceChange } from '../services/batchSourceChange';
import {
  startManagedCoverOperation,
  type CoverOperation,
} from '../services/bookCoverPersistence';
type GroupPick = { ids: Set<string>; action: ManageGroupAction; row: boolean };
export function BookshelfManage({
  initialGroupId,
  back,
  open,
  onBooksChange,
}: {
  initialGroupId: string;
  back: () => void;
  open: (id: string) => void;
  onBooksChange: (books: Book[]) => void;
}) {
  const { colors, t } = useAppTheme(),
    { insets } = useCapsule(),
    library = useLibrary(),
    { groups, error: groupError } = useBookGroups(),
    books = library.books;
  const [creatingTasks, setCreatingTasks] = useState<Book[]>(),
    [taskCron, setTaskCron] = useState(DEFAULT_AUTO_TASK_CRON),
    [taskCronError, setTaskCronError] = useState('');
  const coverJob = useRef<
    ReturnType<typeof startManagedCoverOperation> | undefined
  >(undefined);
  const [coverProgress, setCoverProgress] = useState<{
      current: number;
      total: number;
    }>(),
    [restoringCovers, setRestoringCovers] = useState<{
      kind: 'network' | 'source';
      ids: Set<string>;
    }>();
  useEffect(() => () => coverJob.current?.cancel(), []);
  const sourceJob = useRef<
    ReturnType<typeof startBatchSourceChange> | undefined
  >(undefined);
  const [pickingSource, setPickingSource] = useState(false),
    [sourceProgress, setSourceProgress] = useState<{
      current: number;
      total: number;
    }>();
  useEffect(() => () => sourceJob.current?.cancel(), []);
  const [groupId, setGroupId] = useState(initialGroupId),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [menu, setMenu] = useState<'groups' | 'options' | 'batch'>(),
    [groupManager, setGroupManager] = useState(false),
    [picker, setPicker] = useState<GroupPick>(),
    [deleting, setDeleting] = useState<{
      ids: Set<string>;
      originalOption: boolean;
    }>(),
    [deleteOriginal, setDeleteOriginal] = useState(loadDeleteBookOriginal),
    [openTitle, setOpenTitle] = useState(loadOpenBookTitle),
    [error, setError] = useState(''),
    [exportPath, setExportPath] = useState<string>();
  const currentGroup = groups.find(group => group.id === groupId),
    sort =
      currentGroup?.bookSort === undefined || currentGroup.bookSort < 0
        ? loadBookshelfSort()
        : currentGroup.bookSort,
    visible = useMemo(
      () => manageShelfBooks(books, groups, groupId, sort, query),
      [books, groups, groupId, sort, query],
    ),
    chosen = useMemo(
      () => visible.filter(book => selected.has(book.id)),
      [visible, selected],
    ),
    chosenIds = useMemo(() => new Set(chosen.map(book => book.id)), [chosen]),
    all = chosen.length > 0 && chosen.length === visible.length;
  const notifyError = (cause: unknown) => {
      if (
        isErrorWithCode(cause) &&
        cause.code === errorCodes.OPERATION_CANCELED
      )
        return;
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      void jssdk.showToast({ type: 'error', title: message });
    },
    run = (action: Promise<unknown>) => {
      setError('');
      void action.catch(notifyError);
    },
    toggle = (id: string) =>
      setSelected(old => {
        const next = new Set(old);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    pick = (action: ManageGroupAction) =>
      setPicker({ ids: chosenIds, action, row: false }),
    deleteBooks = (items: Book[], row = false) => {
      setDeleteOriginal(loadDeleteBookOriginal());
      setDeleting({
        ids: new Set(items.map(book => book.id)),
        originalOption: !row || (!!items[0] && isLocalBook(items[0])),
      });
    },
    move = (id: string, offset: number) => {
      const ids = visible.map(book => book.id),
        from = ids.indexOf(id);
      run(
        updateLibrary(current =>
          reorderManagedBooks(current, ids, from, from + offset),
        ),
      );
    },
    toggleTitle = () => {
      setOpenTitle(saveOpenBookTitle(!openTitle));
      setMenu(undefined);
    },
    exportSources = async () => {
      const [stored, sources] = await Promise.all([
        loadLibrary(),
        loadSources(),
      ]);
      const result = await saveJsonDocument(
        exportBookSources(usedShelfSources(stored, sources)),
        'bookSource.json',
      );
      setExportPath(result.uri);
    },
    refresh = () => {
      const eligible = chosen.filter(
        book => !isLocalBook(book) && book.canUpdate !== false,
      );
      if (!eligible.length) return notifyError(new Error(t('manageNoUpdate')));
      run(refreshManagedBooks(new Set(eligible.map(book => book.id))));
      void jssdk.showToast({
        type: 'success',
        title: t('manageUpdateSubmitted', { count: eligible.length }),
      });
    };
  const createTasks = () => {
    const eligible = chosen.filter(
      book => !isLocalBook(book) && book.canUpdate !== false,
    );
    if (!eligible.length) return notifyError(new Error(t('manageNoUpdate')));
    setTaskCron(DEFAULT_AUTO_TASK_CRON);
    setTaskCronError('');
    setCreatingTasks(eligible);
  };
  const changeCovers = (kind: CoverOperation, ids: ReadonlySet<string>) => {
    setError('');
    setCoverProgress(
      kind === 'persist' ? { current: 0, total: ids.size } : undefined,
    );
    const job = startManagedCoverOperation(kind, ids, (current, total) => {
      if (coverJob.current === job) setCoverProgress({ current, total });
    });
    coverJob.current = job;
    void job.promise
      .then(result =>
        jssdk.showToast({
          type: 'info',
          title:
            kind === 'persist'
              ? t('manageCoversSaved', result)
              : t(
                  kind === 'network'
                    ? 'manageCoversNetworkRestored'
                    : 'manageCoversSourceRestored',
                  { count: result.saved },
                ),
        }),
      )
      .catch(cause => {
        if (!(cause instanceof Error && cause.name === 'AbortError'))
          notifyError(cause);
      })
      .finally(() => {
        if (coverJob.current === job) {
          coverJob.current = undefined;
          setCoverProgress(undefined);
        }
      });
  };
  const cancelCovers = () => {
    coverJob.current?.cancel();
    coverJob.current = undefined;
    setCoverProgress(undefined);
  };
  const batch = [
    { label: t('delete'), action: () => deleteBooks(chosen), danger: true },
    {
      label: t('manageAllowUpdate'),
      action: () =>
        run(
          updateLibrary(current =>
            setManagedCanUpdate(current, chosenIds, true),
          ),
        ),
    },
    {
      label: t('manageDisableUpdate'),
      action: () =>
        run(
          updateLibrary(current =>
            setManagedCanUpdate(current, chosenIds, false),
          ),
        ),
    },
    { label: t('manageAdd'), action: () => pick('add') },
    { label: t('manageRemove'), action: () => pick('remove') },
    { label: t('manageChangeSource'), action: () => setPickingSource(true) },
    {
      label: t('manageClearCache'),
      action: () =>
        run(
          clearManagedBookCache(chosenIds).then(() =>
            jssdk.showToast({
              type: 'success',
              title: t('manageCacheCleared'),
            }),
          ),
        ),
    },
    {
      label: t('managePersistCovers'),
      action: () => changeCovers('persist', chosenIds),
    },
    {
      label: t('manageRestoreNetworkCovers'),
      action: () => setRestoringCovers({ kind: 'network', ids: chosenIds }),
    },
    {
      label: t('manageRestoreSourceCovers'),
      action: () => setRestoringCovers({ kind: 'source', ids: chosenIds }),
    },
    {
      label: t('selectInterval'),
      action: () =>
        setSelected(
          expandSelectionInterval(visible, selected, book => book.id),
        ),
    },
    { label: t('manageUpdateToc'), action: refresh },
    { label: t('manageCreateTasks'), action: createTasks },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PageHeader
        sourceTone
        title={t('shelfManage')}
        onBack={back}
        titleContent={
          <View style={s.search}>
            <SourceIcon name="ic_search" color={colors.toolbarText} size={18} />
            <TextInput
              accessibilityLabel={t('manageFilter', {
                name: currentGroup?.name ?? t('manageNoGroup'),
              })}
              placeholder={t('manageFilter', {
                name: currentGroup?.name ?? t('manageNoGroup'),
              })}
              placeholderTextColor={colors.toolbarText}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1,
                minWidth: 0,
                color: colors.toolbarText,
                minHeight: 44,
                fontSize: 16,
                paddingHorizontal: 6,
              }}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('clear')}
                style={s.icon}
                onPress={() => setQuery('')}
              >
                <Text style={{ color: colors.toolbarText, fontSize: 24 }}>
                  ×
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        action={
          <View style={s.search}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('manageGroupButton')}
              style={s.icon}
              onPress={() => setMenu('groups')}
            >
              <SourceIcon name="ic_groups" color={colors.toolbarText} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('manageOptions')}
              style={s.icon}
              onPress={() => setMenu('options')}
            >
              <SourceIcon name="ic_more_vert" color={colors.toolbarText} />
            </Pressable>
          </View>
        }
      />
      {library.error || groupError || error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.danger, padding: 8 }}
        >
          {library.error?.message || groupError || error}
        </Text>
      ) : null}
      <FlatList
        data={visible}
        keyExtractor={book => book.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <ManagedBookRow
            book={item}
            groups={groups}
            checked={selected.has(item.id)}
            toggle={() => toggle(item.id)}
            open={() => open(item.id)}
            openTitle={openTitle}
            group={() =>
              setPicker({ ids: new Set([item.id]), action: 'move', row: true })
            }
            remove={() => deleteBooks([item], true)}
            move={sort === 3 ? offset => move(item.id, offset) : undefined}
          />
        )}
      />
      <View
        style={[
          s.footer,
          {
            paddingBottom: Math.max(6, insets.bottom),
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={t(all ? 'manageCancelAll' : 'manageSelectAll', {
            count: chosen.length,
            total: visible.length,
          })}
          accessibilityState={{ checked: all }}
          accessibilityActions={[
            {
              name: 'toggleSelection',
              label: t('manageToggleAll'),
            },
          ]}
          onAccessibilityAction={event => {
            if (event.nativeEvent.actionName === 'toggleSelection')
              setSelected(selectAllManaged(visible, selected, !all));
          }}
          style={s.selectAll}
          onPress={() => setSelected(selectAllManaged(visible, selected, !all))}
        >
          <SelectionMark
            checked={all}
            color={all ? colors.accent : colors.muted}
          />
          <Text
            numberOfLines={2}
            style={{
              color: colors.text,
              fontSize: 12,
              marginLeft: 6,
              flexShrink: 1,
            }}
          >
            {t(all ? 'manageCancelAll' : 'manageSelectAll', {
              count: chosen.length,
              total: visible.length,
            })}
          </Text>
        </Pressable>
        <FooterAction
          label={t('manageRevert')}
          disabled={!chosen.length}
          action={() => setSelected(invertManagedSelection(visible, selected))}
        />
        <FooterAction
          label={t('manageMove')}
          disabled={!chosen.length}
          action={() => pick('move')}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('manageMore')}
          accessibilityState={{ disabled: !chosen.length }}
          disabled={!chosen.length}
          style={s.icon}
          onPress={() => setMenu('batch')}
        >
          <SourceIcon
            name="ic_more_vert"
            color={chosen.length ? colors.text : colors.muted}
          />
        </Pressable>
      </View>
      <InTreeSheet visible={!!menu} onDismiss={() => setMenu(undefined)}>
        {menu === 'groups' ? (
          <>
            <MenuAction
              label={t('manageGroupManager')}
              action={() => {
                setMenu(undefined);
                setGroupManager(true);
              }}
            />
            {groups.map(group => (
              <MenuAction
                key={group.id}
                label={group.name}
                action={() => {
                  setGroupId(group.id);
                  setMenu(undefined);
                }}
              />
            ))}
          </>
        ) : menu === 'options' ? (
          <>
            <MenuAction
              label={t('manageUsedSources')}
              action={() => {
                setMenu(undefined);
                run(exportSources());
              }}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={t('manageOpenTitle')}
              accessibilityState={{ checked: openTitle }}
              accessibilityActions={[
                { name: 'toggleTitle', label: t('manageOpenTitle') },
              ]}
              onAccessibilityAction={event => {
                if (event.nativeEvent.actionName === 'toggleTitle')
                  toggleTitle();
              }}
              style={s.menu}
              onPress={toggleTitle}
            >
              <SelectionMark checked={openTitle} color={colors.accent} />
              <Text style={{ color: colors.text, marginLeft: 8 }}>
                {t('manageOpenTitle')}
              </Text>
            </Pressable>
          </>
        ) : (
          batch.map(item => (
            <MenuAction
              key={item.label}
              label={item.label}
              danger={item.danger}
              action={() => {
                setMenu(undefined);
                item.action();
              }}
            />
          ))
        )}
      </InTreeSheet>
      <BookGroupManageSheet
        visible={groupManager}
        books={books}
        onBooksChange={onBooksChange}
        dismiss={() => setGroupManager(false)}
      />
      <BookGroupAssignSheet
        visible={!!picker}
        books={books}
        selected={picker?.ids ?? chosenIds}
        preselect={picker?.row ?? false}
        title={t(
          picker?.action === 'add'
            ? 'manageAdd'
            : picker?.action === 'remove'
              ? 'manageRemove'
              : 'manageMove',
        )}
        onBooksChange={onBooksChange}
        onAssign={ids => {
          if (picker)
            run(
              updateLibrary(current =>
                assignManagedGroups(
                  current,
                  picker.ids,
                  ids,
                  groups,
                  picker.action,
                ),
              ),
            );
        }}
        dismiss={() => setPicker(undefined)}
      />
      <InTreeSheet
        visible={!!deleting}
        onDismiss={() => setDeleting(undefined)}
      >
        <Text style={{ color: colors.text, fontSize: 18, marginBottom: 12 }}>
          {t('manageDelete')}
        </Text>
        {deleting?.originalOption ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={t('manageDeleteOriginal')}
            accessibilityState={{ checked: deleteOriginal }}
            accessibilityActions={[
              { name: 'toggleOriginal', label: t('manageDeleteOriginal') },
            ]}
            onAccessibilityAction={event => {
              if (event.nativeEvent.actionName === 'toggleOriginal')
                setDeleteOriginal(!deleteOriginal);
            }}
            style={s.menu}
            onPress={() => setDeleteOriginal(!deleteOriginal)}
          >
            <SelectionMark checked={deleteOriginal} color={colors.accent} />
            <Text style={{ color: colors.text, marginLeft: 8 }}>
              {t('manageDeleteOriginal')}
            </Text>
          </Pressable>
        ) : null}
        <View style={s.confirm}>
          <MenuAction
            label={t('cancel')}
            action={() => setDeleting(undefined)}
          />
          <MenuAction
            label={t('confirm')}
            action={() => {
              if (deleting) {
                if (deleting.originalOption)
                  saveDeleteBookOriginal(deleteOriginal);
                run(deleteManagedBooks(deleting.ids, deleteOriginal));
              }
              setDeleting(undefined);
            }}
          />
        </View>
      </InTreeSheet>
      <InTreeSheet
        visible={!!exportPath}
        onDismiss={() => setExportPath(undefined)}
      >
        <Text style={{ color: colors.text, fontSize: 20 }}>
          {t('bookListExportSuccess')}
        </Text>
        <TextInput
          accessibilityLabel={t('bookListPath')}
          editable={false}
          value={exportPath}
          style={{ color: colors.text, minHeight: 44 }}
        />
        <MenuAction
          label={t('confirm')}
          action={() => {
            Clipboard.setString(exportPath ?? '');
            setExportPath(undefined);
          }}
        />
      </InTreeSheet>
      <InTreeSheet visible={!!coverProgress} onDismiss={cancelCovers}>
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 20 }}
        >
          {t('managePersistCovers')}
        </Text>
        {coverProgress && coverProgress.current > 0 ? (
          <Text style={{ color: colors.text, marginVertical: 16 }}>
            {t('manageCoverProgress', {
              count: coverProgress?.current ?? 0,
              total: coverProgress?.total ?? 0,
            })}
          </Text>
        ) : null}
        <MenuAction label={t('cancel')} action={cancelCovers} />
      </InTreeSheet>
      <InTreeSheet
        visible={!!restoringCovers}
        onDismiss={() => setRestoringCovers(undefined)}
      >
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 20 }}
        >
          {t(
            restoringCovers?.kind === 'network'
              ? 'manageRestoreNetworkCovers'
              : 'manageRestoreSourceCovers',
          )}
        </Text>
        <Text style={{ color: colors.text, marginVertical: 16 }}>
          {t(
            restoringCovers?.kind === 'network'
              ? 'manageRestoreNetworkCoversConfirm'
              : 'manageRestoreSourceCoversConfirm',
          )}
        </Text>
        <View style={s.confirm}>
          <MenuAction
            label={t('cancel')}
            action={() => setRestoringCovers(undefined)}
          />
          <MenuAction
            label={t('confirm')}
            action={() => {
              if (restoringCovers)
                changeCovers(restoringCovers.kind, restoringCovers.ids);
              setRestoringCovers(undefined);
            }}
          />
        </View>
      </InTreeSheet>
      <InTreeSheet
        visible={!!creatingTasks}
        onDismiss={() => setCreatingTasks(undefined)}
      >
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 20, marginBottom: 12 }}
        >
          {t('manageCreateTasks')}
        </Text>
        <BottomSheetTextInput
          accessibilityLabel={t('cronSchedule')}
          placeholder={t('manageCronHint')}
          value={taskCron}
          onChangeText={value => {
            setTaskCron(value);
            setTaskCronError('');
          }}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            color: colors.text,
            borderColor: colors.border,
            borderBottomWidth: 1,
            minHeight: 44,
            fontSize: 16,
          }}
        />
        <Text style={{ color: colors.muted, marginTop: 6 }}>
          {t('manageCronHint')}
        </Text>
        {taskCronError ? (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.danger, marginTop: 8 }}
          >
            {taskCronError}
          </Text>
        ) : null}
        <View style={s.confirm}>
          <MenuAction
            label={t('cancel')}
            action={() => setCreatingTasks(undefined)}
          />
          <MenuAction
            label={t('confirm')}
            action={() => {
              const cron = taskCron.trim();
              if (!CronSchedule.parse(cron)) {
                setTaskCronError(t('manageCronInvalid'));
                return;
              }
              try {
                createBookUpdateTasks(creatingTasks ?? [], cron, book =>
                  t('manageUpdateTaskName', { name: book.name }),
                );
                setCreatingTasks(undefined);
                void jssdk.showToast({
                  type: 'success',
                  title: t('bookListSuccess'),
                });
              } catch (cause) {
                setTaskCronError(
                  cause instanceof Error ? cause.message : String(cause),
                );
              }
            }}
          />
        </View>
      </InTreeSheet>
      <BatchSourcePicker
        visible={pickingSource}
        dismiss={() => setPickingSource(false)}
        selected={source => {
          setSourceProgress({ current: 0, total: chosen.length });
          setError('');
          const job = startBatchSourceChange(
            chosen,
            source,
            (current, total) => {
              if (sourceJob.current === job)
                setSourceProgress({ current, total });
            },
          );
          sourceJob.current = job;
          void job.promise
            .catch(cause => {
              if (!(cause instanceof Error && cause.name === 'AbortError'))
                notifyError(cause);
            })
            .finally(() => {
              if (sourceJob.current === job) {
                sourceJob.current = undefined;
                setSourceProgress(undefined);
              }
            });
        }}
      />
      <InTreeSheet
        visible={!!sourceProgress}
        onDismiss={() => {
          sourceJob.current?.cancel();
          sourceJob.current = undefined;
          setSourceProgress(undefined);
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 20 }}
        >
          {t('manageChangeSource')}
        </Text>
        {sourceProgress && sourceProgress.current > 0 ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.text, marginVertical: 16 }}
          >
            {sourceProgress.current} / {sourceProgress.total}
          </Text>
        ) : null}
        <MenuAction
          label={t('cancel')}
          action={() => {
            sourceJob.current?.cancel();
            sourceJob.current = undefined;
            setSourceProgress(undefined);
          }}
        />
      </InTreeSheet>
    </View>
  );
}
function MenuAction({
  label,
  action,
  danger = false,
}: {
  label: string;
  action: () => void;
  danger?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" style={s.menu} onPress={action}>
      <Text style={{ color: danger ? colors.danger : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}
function FooterAction({
  label,
  action,
  disabled,
}: {
  label: string;
  action: () => void;
  disabled: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[
        s.footerButton,
        { borderColor: colors.accent, opacity: disabled ? 0.4 : 1 },
      ]}
      onPress={action}
    >
      <Text style={{ color: colors.accent, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center' },
  icon: {
    minWidth: 36,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingLeft: 16,
    paddingRight: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  selectAll: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    minHeight: 44,
  },
  footerButton: {
    minWidth: 72,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 2,
    marginHorizontal: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    minHeight: 48,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirm: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24 },
});
