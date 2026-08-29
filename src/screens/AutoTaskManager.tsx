import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { useFocusEffect } from '@react-navigation/native';
import jssdk from '@htyf-mp/js-sdk';
import { InTreeSheet } from '../components/InTreeSheet';
import { PageHeader } from '../components/PageHeader';
import { dueAutoTasks, nextAutoTaskAt, runAutoTask } from '../core/autoTask';
import {
  fetchAutoTaskJson,
  pickAutoTaskJson,
  saveAutoTaskJson,
} from '../core/autoTaskTransfer';
import { CronSchedule } from '../core/cronSchedule';
import {
  exportAutoTasks,
  filterAutoTasks,
  loadAutoTasks,
  loadAutoTaskServiceEnabled,
  mergeAutoTasks,
  moveAutoTask,
  parseAutoTasks,
  patchAutoTasks,
  saveAutoTasks,
  saveAutoTaskServiceEnabled,
  type AutoTaskRule,
} from '../data/autoTasks';
import { useAppTheme } from '../theme/AppTheme';

export function AutoTaskManager({
  back,
  edit,
  debug,
  login,
}: {
  back: () => void;
  edit: (id?: string) => void;
  debug: (id: string) => void;
  login: (id: string) => void;
}) {
  const { colors, t } = useAppTheme();
  const [tasks, setTasks] = useState(loadAutoTasks),
    [serviceEnabled, setServiceEnabled] = useState(loadAutoTaskServiceEnabled),
    [sheet, setSheet] = useState<AutoTaskRule | null>(null),
    [removeIds, setRemoveIds] = useState<Set<string> | null>(null);
  const [running, setRunning] = useState(false),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<Set<string>>(new Set());
  const [transfer, setTransfer] = useState(false),
    [onlineUrl, setOnlineUrl] = useState(''),
    [batchCron, setBatchCron] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      const next = loadAutoTasks();
      setTasks(next);
      setServiceEnabled(loadAutoTaskServiceEnabled());
      setSelected(
        current =>
          new Set([...current].filter(id => next.some(task => task.id === id))),
      );
    }, []),
  );
  const visible = useMemo(() => filterAutoTasks(tasks, query), [tasks, query]);
  const commit = (next: AutoTaskRule[]) => {
    setTasks(next);
    saveAutoTasks(next);
  };
  const toast = (
    type: 'success' | 'error',
    title: string,
    description?: string,
  ) => void jssdk.showToast({ type, title, description });
  const mergeIncoming = (incoming: AutoTaskRule[]) => {
    commit(mergeAutoTasks(tasks, incoming));
    setTransfer(false);
    toast('success', t('autoTasksImported', { count: incoming.length }));
  };
  const importing = async (load: () => Promise<AutoTaskRule[]>) => {
    try {
      mergeIncoming(await load());
    } catch (error) {
      if (
        !(
          isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED
        )
      )
        toast(
          'error',
          t('importFailed'),
          error instanceof Error ? error.message : String(error),
        );
    }
  };
  const runDue = async () => {
    if (running) return;
    setRunning(true);
    try {
      let next = [...tasks],
        count = 0;
      for (const task of dueAutoTasks(tasks)) {
        const result = await runAutoTask(task),
          lastRunAt = Date.now();
        next = next.map(item =>
          item.id === task.id
            ? {
                ...item,
                lastRunAt,
                lastResult: result.result,
                lastError: result.error,
                lastLog: result.log,
              }
            : item,
        );
        count++;
      }
      commit(next);
      toast(
        'success',
        count ? t('dueTasksExecuted', { count }) : t('noDueTasks'),
      );
    } catch (error) {
      toast(
        'error',
        t('actionFailed', { name: t('runDueTasks') }),
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setRunning(false);
    }
  };
  const toggleSelection = (id: string) =>
    setSelected(current => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const patchSelected = (
    patch: Partial<Pick<AutoTaskRule, 'enable' | 'cron'>>,
  ) => {
    commit(patchAutoTasks(tasks, selected, patch));
    setSelected(new Set());
  };
  const nextAt = nextAutoTaskAt(tasks);
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('autoTaskTitle', { count: tasks.length })}
        onBack={back}
        action={
          <View style={s.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('exportAutoTasks')}
              style={s.touch}
              onPress={() =>
                void saveAutoTaskJson(tasks)
                  .then(() => toast('success', t('autoTaskDocumentSaved')))
                  .catch(error =>
                    toast(
                      'error',
                      t('actionFailed', { name: t('exportAutoTasks') }),
                      String(error),
                    ),
                  )
              }
            >
              <Text style={[s.icon, { color: colors.primary }]}>⇧</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('importAutoTasks')}
              style={s.touch}
              onPress={() => setTransfer(true)}
            >
              <Text style={[s.icon, { color: colors.primary }]}>↓</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('addAutoTask')}
              style={s.touch}
              onPress={() => edit()}
            >
              <Text style={[s.icon, { color: colors.primary }]}>＋</Text>
            </Pressable>
          </View>
        }
      />
      <View style={[s.service, { borderColor: colors.border }]}>
        <View style={s.body}>
          <Text style={[s.name, { color: colors.text }]}>
            {t('autoTaskService')}
          </Text>
          <Text style={[s.meta, { color: colors.muted }]}>
            {t('autoTaskServiceDescription')}
          </Text>
        </View>
        <Switch
          accessibilityLabel={t('autoTaskService')}
          value={serviceEnabled}
          onValueChange={value => {
            setServiceEnabled(saveAutoTaskServiceEnabled(value));
          }}
        />
      </View>
      <TextInput
        accessibilityLabel={t('searchTasks')}
        placeholder={t('searchTasks')}
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        style={[
          s.search,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      />
      {selected.size ? (
        <ScrollView
          horizontal
          contentContainerStyle={s.batch}
          showsHorizontalScrollIndicator={false}
        >
          <Text style={[s.selected, { color: colors.text }]}>
            {t('selectedTasks', { count: selected.size })}
          </Text>
          <Batch
            label={t('selectAll')}
            action={() => setSelected(new Set(visible.map(item => item.id)))}
          />
          <Batch
            label={t('invertSelection')}
            action={() =>
              setSelected(
                new Set(
                  visible
                    .filter(item => !selected.has(item.id))
                    .map(item => item.id),
                ),
              )
            }
          />
          <Batch
            label={t('enableSelected')}
            action={() => patchSelected({ enable: true })}
          />
          <Batch
            label={t('disableSelected')}
            action={() => patchSelected({ enable: false })}
          />
          <Batch label={t('batchCron')} action={() => setBatchCron('')} />
          <Batch
            danger
            label={t('deleteSelected')}
            action={() => setRemoveIds(new Set(selected))}
          />
        </ScrollView>
      ) : (
        <View style={[s.status, { borderColor: colors.border }]}>
          <Text style={[s.meta, { color: colors.muted }]}>
            {!serviceEnabled
              ? t('autoTaskServicePaused')
              : nextAt
                ? t('nextSchedule', { date: new Date(nextAt).toLocaleString() })
                : t('noEnabledSchedule')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: running }}
            disabled={running}
            style={[
              s.run,
              { backgroundColor: colors.primary },
              running && s.disabled,
            ]}
            onPress={() => void runDue()}
          >
            <Text style={s.runText}>
              {t(running ? 'runningTasks' : 'runDueTasks')}
            </Text>
          </Pressable>
        </View>
      )}
      <ScrollView contentContainerStyle={s.list}>
        {visible.map(task => (
          <View key={task.id} style={[s.item, { borderColor: colors.border }]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected.has(task.id) }}
              accessibilityLabel={task.name}
              style={s.check}
              onPress={() => toggleSelection(task.id)}
            >
              <Text style={{ color: colors.primary, fontSize: 20 }}>
                {selected.has(task.id) ? '☑' : '☐'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={task.name}
              style={s.body}
              onPress={() => setSheet(task)}
            >
              <Text style={[s.name, { color: colors.text }]}>{task.name}</Text>
              <Text style={[s.meta, { color: colors.muted }]}>
                {task.cron}
                {task.comment ? ` · ${task.comment}` : ''}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: task.lastError ? colors.danger : colors.muted,
                  fontSize: 12,
                }}
              >
                {task.lastError ?? task.lastResult ?? t('neverRun')}
              </Text>
            </Pressable>
            <Switch
              accessibilityLabel={t('autoTaskEnabledNamed', {
                name: task.name,
              })}
              value={task.enable}
              onValueChange={enable =>
                commit(
                  tasks.map(item =>
                    item.id === task.id ? { ...item, enable } : item,
                  ),
                )
              }
            />
          </View>
        ))}
        {!visible.length ? (
          <Text style={[s.empty, { color: colors.muted }]}>
            {t('emptyAutoTasks')}
          </Text>
        ) : null}
      </ScrollView>
      <InTreeSheet visible={!!sheet} onDismiss={() => setSheet(null)}>
        {sheet ? (
          <ScrollView>
            <Text style={[s.title, { color: colors.text }]}>{sheet.name}</Text>
            <Action
              label={t('edit')}
              onPress={() => {
                setSheet(null);
                edit(sheet.id);
              }}
            />
            <Action
              label={t('debugTask')}
              onPress={() => {
                setSheet(null);
                debug(sheet.id);
              }}
            />
            {/^https?:\/\//i.test(sheet.loginUrl ?? '') ? (
              <Action
                label={t('login')}
                onPress={() => {
                  setSheet(null);
                  login(sheet.id);
                }}
              />
            ) : null}
            <Action
              label={t('moveUp')}
              onPress={() => {
                commit(moveAutoTask(tasks, sheet.id, -1));
                setSheet(null);
              }}
            />
            <Action
              label={t('moveDown')}
              onPress={() => {
                commit(moveAutoTask(tasks, sheet.id, 1));
                setSheet(null);
              }}
            />
            <Text
              selectable
              style={[
                s.log,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              {sheet.lastLog ??
                sheet.lastError ??
                sheet.lastResult ??
                t('noTaskLog')}
            </Text>
            <Action
              danger
              label={t('clearLog')}
              onPress={() => {
                commit(
                  tasks.map(item =>
                    item.id === sheet.id
                      ? {
                          ...item,
                          lastRunAt: 0,
                          lastResult: undefined,
                          lastError: undefined,
                          lastLog: undefined,
                        }
                      : item,
                  ),
                );
                setSheet(null);
              }}
            />
            <Action
              danger
              label={t('deleteTask')}
              onPress={() => {
                setRemoveIds(new Set([sheet.id]));
                setSheet(null);
              }}
            />
          </ScrollView>
        ) : null}
      </InTreeSheet>
      <InTreeSheet visible={transfer} onDismiss={() => setTransfer(false)}>
        <Text style={[s.title, { color: colors.text }]}>
          {t('importAutoTasks')}
        </Text>
        <Action
          label={t('importFromClipboard')}
          onPress={() =>
            void importing(async () =>
              parseAutoTasks(await Clipboard.getString()),
            )
          }
        />
        <Action
          label={t('importFromFile')}
          onPress={() => void importing(pickAutoTaskJson)}
        />
        <TextInput
          accessibilityLabel={t('onlineImportUrl')}
          placeholder={t('onlineImportUrl')}
          placeholderTextColor={colors.muted}
          value={onlineUrl}
          onChangeText={setOnlineUrl}
          autoCapitalize="none"
          style={[s.search, { color: colors.text, borderColor: colors.border }]}
        />
        <Action
          label={t('importFromUrl')}
          onPress={() => void importing(() => fetchAutoTaskJson(onlineUrl))}
        />
      </InTreeSheet>
      <InTreeSheet
        visible={batchCron !== null}
        onDismiss={() => setBatchCron(null)}
      >
        <Text style={[s.title, { color: colors.text }]}>
          {t('batchCronTitle')}
        </Text>
        <TextInput
          accessibilityLabel={t('batchCron')}
          value={batchCron ?? ''}
          onChangeText={value => setBatchCron(value)}
          autoCapitalize="none"
          style={[s.search, { color: colors.text, borderColor: colors.border }]}
        />
        <Action
          label={t('save')}
          onPress={() => {
            const value = batchCron?.trim() ?? '';
            if (!CronSchedule.parse(value)) {
              toast('error', t('invalidCron'));
              return;
            }
            patchSelected({ cron: value });
            setBatchCron(null);
          }}
        />
      </InTreeSheet>
      <InTreeSheet visible={!!removeIds} onDismiss={() => setRemoveIds(null)}>
        {removeIds ? (
          <View>
            <Text style={[s.title, { color: colors.text }]}>
              {removeIds.size === 1
                ? t('deleteAutoTaskTitle', {
                    name:
                      tasks.find(item => removeIds.has(item.id))?.name ?? '',
                  })
                : t('deleteSelectedTasksTitle', { count: removeIds.size })}
            </Text>
            <Text style={{ color: colors.muted }}>
              {t('deleteAutoTaskDescription')}
            </Text>
            <View style={s.confirmRow}>
              <Pressable
                accessibilityRole="button"
                style={[s.confirmButton, { borderColor: colors.border }]}
                onPress={() => setRemoveIds(null)}
              >
                <Text style={{ color: colors.text }}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[s.confirmButton, { backgroundColor: colors.danger }]}
                onPress={() => {
                  commit(tasks.filter(item => !removeIds.has(item.id)));
                  setSelected(new Set());
                  setRemoveIds(null);
                }}
              >
                <Text style={s.runText}>{t('delete')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </InTreeSheet>
    </View>
  );
}
function Action({
  label,
  onPress,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      style={[s.action, { borderColor: colors.border }]}
      onPress={onPress}
    >
      <Text
        style={{
          color: danger ? colors.danger : colors.text,
          fontWeight: danger ? '700' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function Batch({
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
    <Pressable
      accessibilityRole="button"
      style={s.batchAction}
      onPress={action}
    >
      <Text
        style={{
          color: danger ? colors.danger : colors.primary,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  service: {
    minHeight: 72,
    marginHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 23 },
  search: {
    minHeight: 44,
    marginHorizontal: 14,
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  status: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  run: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    justifyContent: 'center',
  },
  runText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.42 },
  batch: { minHeight: 52, alignItems: 'center', paddingHorizontal: 10 },
  selected: { paddingHorizontal: 8, fontWeight: '700' },
  batchAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  list: { paddingHorizontal: 14, paddingBottom: 30 },
  item: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  check: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 5, paddingVertical: 10 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, flex: 1 },
  empty: { textAlign: 'center', marginTop: 60 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  action: {
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  log: {
    padding: 12,
    marginVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    fontFamily: 'monospace',
  },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  confirmButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
