import { Fragment, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import jssdk from '@htyf-mp/js-sdk';
import { useFocusEffect } from '@react-navigation/native';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import {
  exportBookSources,
  loadSources,
  mergeBookSources,
  saveSources,
} from '../data/sources';
import { importBookSourcesInput } from '../core/sourceImport';
import { pickBookSourcesInput } from '../core/sourceImportFile';
import type { BookSource } from '../types';
import { clearSourceCookies } from '../data/sourceCookies';
import { useAppTheme } from '../theme/AppTheme';
import { checkBookSources, type SourceCheckResult } from '../core/sourceCheck';
import { assignUngroupedSources, filterBookSources, loadSourceManagementPreferences, renameSourceGroup, saveSourceManagementPreferences, sortBookSources, sortBookSourcesByDomain, sourceDomain, sourceGroups, updateSelectedSources, type SourceFilter, type SourceSort } from '../data/sourceManagement';
import { expandSelectionInterval } from '../core/selectionInterval';
import {
  inspectSourceCompatibility,
  summarizeSourceCompatibility,
} from '../core/sourceCompatibility';
import { saveJsonDocument, shareJsonText } from '../core/jsonTransfer';
export function SourceManager({
  back,
  edit,
  login,
  debug,
  search,
  openQr,
  openSubscriptions,
}: {
  back: () => void;
  edit: (sourceUrl?: string) => void;
  login: (sourceUrl: string) => void;
  debug: (sourceUrl: string) => void;
  search: (sourceUrl: string) => void;
  openQr: () => void;
  openSubscriptions: () => void;
}) {
  const { colors, t } = useAppTheme();
  const [sources, setSources] = useState<BookSource[]>([]),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(''),
    [remove, setRemove] = useState<BookSource | null>(null),
    [checkVisible, setCheckVisible] = useState(false),
    [checkKeyword, setCheckKeyword] = useState('book'),
    [checkResults, setCheckResults] = useState<SourceCheckResult[]>([]),
    [checkProgress, setCheckProgress] = useState<[number, number]>([0, 0]),
    [checking, setChecking] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const [managementVisible, setManagementVisible] = useState(false),
    [management, setManagement] = useState(loadSourceManagementPreferences),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [groupName, setGroupName] = useState('');
  const [transferVisible, setTransferVisible] = useState(false),
    [onlineUrl, setOnlineUrl] = useState(''),
    [importingSources, setImportingSources] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [groupManagerVisible, setGroupManagerVisible] = useState(false),
    [editingGroup, setEditingGroup] = useState<string>();
  const checkRun = useRef(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadSources()
        .then(value => {
          if (active) setSources(value);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );
  const commit = useCallback((next: BookSource[]) => {
    setSources(next);
    void saveSources(next);
  }, []);
  const filtered = useMemo(() => {
    const visible = filterBookSources(sources, management.filter, deferredQuery);
    return management.groupByDomain ? sortBookSourcesByDomain(visible) : sortBookSources(visible, management.sort, management.ascending);
  }, [deferredQuery, management, sources]);
  const setManagementPreference = (next: typeof management) => { setManagement(next); saveSourceManagementPreferences(next); };
  const applySelected = (action: Parameters<typeof updateSelectedSources>[2], group = '') => { commit(updateSelectedSources(sources, selected, action, group)); };
  const importSources = async (load: () => Promise<BookSource[]>) => {
    if (importingSources) return;
    setImportingSources(true);
    try {
      const incoming = await load(),
        next = mergeBookSources(sources, incoming),
        compatibility = summarizeSourceCompatibility(incoming);
      commit(next);
      setTransferVisible(false);
      void jssdk.showToast({
        type: 'success',
        title: t('sourcesImported', { count: incoming.length }),
        description:
          compatibility.searchBlocked || compatibility.contentBlocked
            ? t('sourceImportCompatibility', compatibility)
            : undefined,
      });
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return;
      void jssdk.showToast({
        type: 'error',
        title: t('sourceImportFailed'),
        description: e instanceof Error ? e.message : String(e),
      });
    } finally { setImportingSources(false); }
  };
  const importClipboard = () => importSources(async () => importBookSourcesInput(await Clipboard.getString()));
  const selectedJson = () =>
    exportBookSources(
      filtered.filter(source => selected.has(source.bookSourceUrl)),
    );
  const saveSelected = async () => {
    try {
      await saveJsonDocument(selectedJson(), 'bookSource.json');
      void jssdk.showToast({ type: 'success', title: t('selectionExported') });
    } catch (error) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED)
        return;
      void jssdk.showToast({
        type: 'error',
        title: t('selectionExportFailed'),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const shareSelected = async () => {
    try {
      await shareJsonText(selectedJson(), t('bookSourceShareTitle'));
    } catch (error) {
      void jssdk.showToast({
        type: 'error',
        title: t('shareFailed'),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('sourceManagerTitle', { count: sources.length })}
        onBack={back}
      />
      <View style={s.quickActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('importBookSources')}
          style={({ pressed }) => [
            s.quickPrimary,
            { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
          ]}
          onPress={() => setTransferVisible(true)}
        >
          <Text style={s.quickPrimaryText}>↓</Text>
          <Text style={s.quickPrimaryText}>{t('importBookSources')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('ruleSubscriptions')}
          style={({ pressed }) => [
            s.quickSecondary,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
          onPress={openSubscriptions}
        >
          <Text style={{ color: colors.primary, fontSize: 18 }}>↻</Text>
          <Text style={[s.quickSecondaryText, { color: colors.text }]}>
            {t('ruleSubscriptions')}
          </Text>
        </Pressable>
      </View>
      <View style={s.utilityActions}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [s.utilityButton, pressed && s.pressed]}
          onPress={() => edit()}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>＋</Text>
          <Text style={[s.utilityText, { color: colors.primary }]}>
            {t('createSource')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [s.utilityButton, pressed && s.pressed]}
          onPress={() => setMoreVisible(true)}
        >
          <Text style={{ color: colors.muted, fontSize: 18 }}>•••</Text>
          <Text style={[s.utilityText, { color: colors.muted }]}>
            {t('moreSourceActions')}
          </Text>
        </Pressable>
      </View>
      <View style={s.search}>
        <TextInput
          accessibilityLabel={t('filterSources')}
          value={query}
          onChangeText={setQuery}
          placeholder={t('filterSourcesPlaceholder')}
          placeholderTextColor={colors.muted}
          style={[
            s.input,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
        />
      </View>
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length ? (
        <FlatList
          style={s.flex}
          contentContainerStyle={s.list}
          data={filtered}
          keyExtractor={source => source.bookSourceUrl}
          extraData={selected}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={40}
          windowSize={7}
          renderItem={({ item: source, index }) => (
            <Fragment key={source.bookSourceUrl}>
              {management.groupByDomain && (index === 0 || sourceDomain(filtered[index - 1].bookSourceUrl) !== sourceDomain(source.bookSourceUrl)) ? <Text accessibilityRole="header" style={[s.domainHeader, { color: colors.primary, borderColor: colors.border }]}>{sourceDomain(source.bookSourceUrl)}</Text> : null}
            <View
              style={[s.item, { borderColor: colors.border }]}
            >
                  <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('editNamedSource', {
                  name: source.bookSourceName,
                })}
                style={s.text}
                    onPress={() => edit(source.bookSourceUrl)}
                    onLongPress={() => setSelected(current => { const next = new Set(current); next.has(source.bookSourceUrl) ? next.delete(source.bookSourceUrl) : next.add(source.bookSourceUrl); return next; })}
                  >
                    <Text style={[s.name, { color: colors.text }]}>
                      {selected.has(source.bookSourceUrl) ? '✓ ' : ''}{source.bookSourceName}
                      {inspectSourceCompatibility(source).issues.length ? (
                        <Text style={{ color: colors.danger }}>
                          {' '}· {t('sourceNeedsJs')}
                        </Text>
                      ) : null}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[s.meta, { color: colors.muted }]}
                >
                  {source.bookSourceGroup || t('ungrouped')} ·{' '}
                  {source.bookSourceUrl}
                </Text>
              </Pressable>
              {source.loginUrl || source.enabledCookieJar ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('loginNamedSource', {
                    name: source.bookSourceName,
                  })}
                  style={s.login}
                  onPress={() => login(source.bookSourceUrl)}
                >
                  <Text style={[s.loginText, { color: colors.primary }]}>
                    {t('login')}
                  </Text>
                </Pressable>
              ) : null}
              {source.searchUrl ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('searchNamedSource', {
                    name: source.bookSourceName,
                  })}
                  style={s.login}
                  onPress={() => search(source.bookSourceUrl)}
                >
                  <Text style={[s.loginText, { color: colors.primary }]}>
                    {t('search')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('debugNamedSource', {
                  name: source.bookSourceName,
                })}
                style={s.login}
                onPress={() => debug(source.bookSourceUrl)}
              >
                <Text style={[s.loginText, { color: colors.primary }]}>
                  {t('debugTask')}
                </Text>
              </Pressable>
              <Switch
                accessibilityLabel={t('sourceEnabledNamed', {
                  name: source.bookSourceName,
                })}
                value={source.enabled}
                onValueChange={enabled =>
                  commit(
                    sources.map(x =>
                      x.bookSourceUrl === source.bookSourceUrl
                        ? { ...x, enabled }
                        : x,
                    ),
                  )
                }
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('deleteNamed', {
                  name: source.bookSourceName,
                })}
                style={s.touch}
                onPress={() => setRemove(source)}
              >
                <Text style={[s.delete, { color: colors.danger }]}>×</Text>
              </Pressable>
            </View>
            </Fragment>
          )}
        />
      ) : (
        <View style={s.center}>
          <Text style={[s.empty, { color: colors.text }]}>
            {query ? t('noMatchingSources') : t('noSources')}
          </Text>
          <Text style={[s.meta, { color: colors.muted }]}>
            {t('sourceEmptyHelp')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('importSourcesClipboard')}
            style={s.importButton}
            onPress={() => setTransferVisible(true)}
          >
            <Text style={[s.importText, { color: colors.primary }]}>
              {t('importFromClipboard')}
            </Text>
          </Pressable>
        </View>
      )}
      <InTreeSheet visible={!!remove} onDismiss={() => setRemove(null)}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          {t('deleteSourceTitle')}
        </Text>
        <Text style={[s.sheetText, { color: colors.muted }]}>
          {remove?.bookSourceName}
        </Text>
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
            style={[s.cancel, { backgroundColor: colors.surface }]}
            onPress={() => setRemove(null)}
          >
            <Text style={{ color: colors.text }}>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('deleteNamed', {
              name: remove?.bookSourceName ?? '',
            })}
            style={s.danger}
            onPress={() => {
              if (remove) {
                clearSourceCookies(remove.bookSourceUrl);
                commit(
                  sources.filter(x => x.bookSourceUrl !== remove.bookSourceUrl),
                );
              }
              setRemove(null);
            }}
          >
            <Text style={s.dangerText}>{t('delete')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
      <InTreeSheet visible={moreVisible} onDismiss={() => setMoreVisible(false)}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          {t('moreSourceActions')}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={s.moreAction}
          onPress={() => {
            setMoreVisible(false);
            setManagementVisible(true);
          }}
        >
          <Text style={{ color: colors.text }}>{t('manageSources')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.moreAction}
          onPress={() => {
            setMoreVisible(false);
            setCheckVisible(true);
          }}
        >
          <Text style={{ color: colors.text }}>{t('checkSources')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.moreAction}
          onPress={() => {
            Clipboard.setString(exportBookSources(sources));
            setMoreVisible(false);
            void jssdk.showToast({
              type: 'success',
              title: t('sourcesCopied', { count: sources.length }),
            });
          }}
        >
          <Text style={{ color: colors.text }}>{t('exportAllSources')}</Text>
        </Pressable>
      </InTreeSheet>
      <InTreeSheet visible={checkVisible} onDismiss={() => { checkRun.current++; setChecking(false); setCheckVisible(false); }}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>{t('checkSources')}</Text>
        <Text style={[s.meta, { color: colors.muted }]}>{t('checkSourcesHelp', { count: selected.size || filtered.length })}</Text>
        <TextInput accessibilityLabel={t('checkKeyword')} value={checkKeyword} onChangeText={setCheckKeyword} placeholder={t('checkKeyword')} placeholderTextColor={colors.muted} style={[s.checkInput, { color: colors.text, borderColor: colors.border }]} />
        {checking || checkProgress[1] ? <Text style={[s.meta, { color: colors.muted }]}>{t('checkProgress', { completed: checkProgress[0], total: checkProgress[1] })}</Text> : null}
        <ScrollView style={s.checkList}>
          {checkResults.map(result => <View key={result.sourceUrl} style={[s.checkRow, { borderColor: colors.border }]}><Text style={{ color: result.status === 'success' ? colors.primary : result.status === 'unsupported' ? colors.muted : colors.danger, fontWeight: '700' }}>{result.sourceName} · {t(`sourceCheck_${result.status}` as never)}</Text><Text style={[s.meta, { color: colors.muted }]}>{result.message} · {result.durationMs}ms</Text></View>)}
        </ScrollView>
        <View style={s.actions}>
          <Pressable accessibilityRole="button" style={[s.cancel, { backgroundColor: colors.surface }]} onPress={() => { checkRun.current++; setChecking(false); }}>{checking ? <Text style={{ color: colors.text }}>{t('stopCache')}</Text> : <Text style={{ color: colors.text }}>{t('cancel')}</Text>}</Pressable>
          <Pressable accessibilityRole="button" style={[s.cancel, { backgroundColor: colors.primary }]} disabled={checking || !checkKeyword.trim() || !filtered.length} onPress={() => { const run = ++checkRun.current, targets = selected.size ? sources.filter(source => selected.has(source.bookSourceUrl)) : [...filtered]; setCheckResults([]); setCheckProgress([0, targets.length]); setChecking(true); void checkBookSources(targets, checkKeyword.trim(), { cancelled: () => checkRun.current !== run, onResult: (result, completed, total) => { if (checkRun.current === run) { setCheckResults(current => [...current, result]); setCheckProgress([completed, total]); } } }).finally(() => { if (checkRun.current === run) setChecking(false); }); }}><Text style={{ color: '#fff', fontWeight: '700' }}>{t('startCheck')}</Text></Pressable>
        </View>
      </InTreeSheet>
      <InTreeSheet visible={managementVisible} onDismiss={() => setManagementVisible(false)}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>{t('manageSources')}</Text>
        <Text style={[s.meta, { color: colors.muted }]}>{t('selectedSources', { count: selected.size })}</Text>
        <ScrollView horizontal contentContainerStyle={s.chips}>{(['manual','weight','name','url','updated','respond','enabled'] as SourceSort[]).map(value => <Pressable key={value} accessibilityRole="button" style={[s.chip, { borderColor: management.sort === value ? colors.primary : colors.border }]} onPress={() => setManagementPreference({ ...management, sort: value })}><Text style={{ color: colors.text }}>{t(`sourceSort_${value}` as never)}</Text></Pressable>)}</ScrollView>
        <Pressable accessibilityRole="button" style={s.batchButton} onPress={() => setManagementPreference({ ...management, ascending: !management.ascending })}><Text style={{ color: colors.primary }}>{management.ascending ? t('ascending') : t('descending')}</Text></Pressable>
        <View style={s.actions}><Pressable accessibilityRole="button" style={s.batchButton} onPress={() => setManagementPreference({ ...management, groupByDomain: !management.groupByDomain })}><Text style={{ color: colors.primary }}>{management.groupByDomain ? t('disableDomainGrouping') : t('enableDomainGrouping')}</Text></Pressable><Pressable accessibilityRole="button" style={s.batchButton} onPress={() => { setManagementVisible(false); setGroupManagerVisible(true); }}><Text style={{ color: colors.primary }}>{t('sourceGroupManager')}</Text></Pressable></View>
        <ScrollView horizontal contentContainerStyle={s.chips}>{(['all','enabled','disabled','login','ungrouped','exploreEnabled','exploreDisabled'] as SourceFilter[]).map(value => <Pressable key={value} accessibilityRole="button" style={[s.chip, { borderColor: management.filter === value ? colors.primary : colors.border }]} onPress={() => setManagementPreference({ ...management, filter: value })}><Text style={{ color: colors.text }}>{t(`sourceFilter_${value}` as never)}</Text></Pressable>)}{sourceGroups(sources).map(value => <Pressable key={value} accessibilityRole="button" style={[s.chip, { borderColor: management.filter === `group:${value}` ? colors.primary : colors.border }]} onPress={() => setManagementPreference({ ...management, filter: `group:${value}` })}><Text style={{ color: colors.text }}>{value}</Text></Pressable>)}</ScrollView>
        <View style={s.batchWrap}>{(['enable','disable','enableExplore','disableExplore','top','bottom'] as const).map(action => <Pressable key={action} disabled={!selected.size} accessibilityRole="button" style={s.batchButton} onPress={() => applySelected(action)}><Text style={{ color: colors.primary }}>{t(`sourceBatch_${action}` as never)}</Text></Pressable>)}</View>
        <TextInput accessibilityLabel={t('sourceGroup')} value={groupName} onChangeText={setGroupName} placeholder={t('sourceGroup')} placeholderTextColor={colors.muted} style={[s.checkInput, { color: colors.text, borderColor: colors.border }]} />
        <View style={s.actions}><Pressable accessibilityRole="button" disabled={!selected.size || !groupName.trim()} style={s.batchButton} onPress={() => applySelected('addGroup', groupName)}><Text style={{ color: colors.primary }}>{t('addGroup')}</Text></Pressable><Pressable accessibilityRole="button" disabled={!selected.size || !groupName.trim()} style={s.batchButton} onPress={() => applySelected('removeGroup', groupName)}><Text style={{ color: colors.danger }}>{t('removeGroup')}</Text></Pressable></View>
        <View style={s.batchWrap}><Pressable accessibilityRole="button" style={s.batchButton} onPress={() => setSelected(new Set(filtered.map(source => source.bookSourceUrl)))}><Text style={{ color: colors.primary }}>{t('selectAll')}</Text></Pressable><Pressable accessibilityRole="button" disabled={!selected.size} style={s.batchButton} onPress={() => setSelected(expandSelectionInterval(filtered, selected, source => source.bookSourceUrl))}><Text style={{ color: colors.primary }}>{t('selectInterval')}</Text></Pressable><Pressable accessibilityRole="button" style={s.batchButton} onPress={() => setSelected(new Set())}><Text style={{ color: colors.text }}>{t('clearSelection')}</Text></Pressable><Pressable accessibilityRole="button" disabled={!selected.size} style={s.batchButton} onPress={() => { Clipboard.setString(selectedJson()); void jssdk.showToast({ type: 'success', title: t('selectionCopied') }); }}><Text style={{ color: colors.primary }}>{t('copySelection')}</Text></Pressable><Pressable accessibilityRole="button" disabled={!selected.size} style={s.batchButton} onPress={() => void saveSelected()}><Text style={{ color: colors.primary }}>{t('exportSelection')}</Text></Pressable><Pressable accessibilityRole="button" disabled={!selected.size} style={s.batchButton} onPress={() => void shareSelected()}><Text style={{ color: colors.primary }}>{t('shareSelection')}</Text></Pressable></View>
      </InTreeSheet>
      <InTreeSheet visible={groupManagerVisible} onDismiss={() => setGroupManagerVisible(false)}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>{t('sourceGroupManager')}</Text>
        <Text style={[s.meta, { color: colors.muted }]}>{t('sourceGroupManagerHelp')}</Text>
        <TextInput accessibilityLabel={t('sourceGroup')} value={groupName} onChangeText={setGroupName} placeholder={t('sourceGroup')} placeholderTextColor={colors.muted} style={[s.checkInput, { color: colors.text, borderColor: colors.border }]} />
        <Pressable accessibilityRole="button" disabled={!groupName.trim()} style={s.transferButton} onPress={() => { commit(editingGroup ? renameSourceGroup(sources, editingGroup, groupName) : assignUngroupedSources(sources, groupName)); if (editingGroup && management.filter === `group:${editingGroup}`) setManagementPreference({ ...management, filter: `group:${groupName.trim()}` }); setEditingGroup(undefined); setGroupName(''); }}><Text style={{ color: colors.primary }}>{editingGroup ? t('renameGroup') : t('assignUngrouped')}</Text></Pressable>
        <ScrollView style={s.checkList}>{sourceGroups(sources).map(group => <View key={group} style={[s.groupRow, { borderColor: colors.border }]}><Text style={[s.groupText, { color: colors.text }]}>{group}</Text><Pressable accessibilityRole="button" style={s.batchButton} onPress={() => { setEditingGroup(group); setGroupName(group); }}><Text style={{ color: colors.primary }}>{t('edit')}</Text></Pressable><Pressable accessibilityRole="button" style={s.batchButton} onPress={() => { commit(renameSourceGroup(sources, group)); if (management.filter === `group:${group}`) setManagementPreference({ ...management, filter: 'all' }); }}><Text style={{ color: colors.danger }}>{t('delete')}</Text></Pressable></View>)}</ScrollView>
      </InTreeSheet>
      <InTreeSheet visible={transferVisible} onDismiss={() => !importingSources && setTransferVisible(false)}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>{t('importBookSources')}</Text>
        <TextInput accessibilityLabel={t('onlineSourceUrl')} value={onlineUrl} onChangeText={setOnlineUrl} autoCapitalize="none" placeholder={t('onlineSourceUrl')} placeholderTextColor={colors.muted} style={[s.checkInput, { color: colors.text, borderColor: colors.border }]} />
        <Pressable accessibilityRole="button" disabled={importingSources || !onlineUrl.trim()} style={s.transferButton} onPress={() => void importSources(() => importBookSourcesInput(onlineUrl))}><Text style={{ color: colors.primary }}>{t('importOnlineSource')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={importingSources} style={s.transferButton} onPress={() => void importSources(pickBookSourcesInput)}><Text style={{ color: colors.primary }}>{t('importSourceFile')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={importingSources} style={s.transferButton} onPress={() => void importClipboard()}><Text style={{ color: colors.primary }}>{t('importSourcesClipboard')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={importingSources} style={s.transferButton} onPress={() => { setTransferVisible(false); openQr(); }}><Text style={{ color: colors.primary }}>{t('importSourceQr')}</Text></Pressable>
        {importingSources ? <ActivityIndicator color={colors.primary} /> : null}
      </InTreeSheet>
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  quickPrimary: {
    flex: 1.15,
    minHeight: 52,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  quickPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  quickSecondary: {
    flex: 1,
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  quickSecondaryText: { fontWeight: '600', fontSize: 14 },
  utilityActions: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingTop: 2,
  },
  utilityButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  utilityText: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.55 },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: { fontSize: 28 },
  search: { padding: 12 },
  input: {
    height: 46,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  item: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 6 },
  login: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: { fontWeight: '700' },
  importButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  importText: { fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  delete: { fontSize: 28 },
  empty: { fontSize: 19, fontWeight: '700' },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  sheetText: { fontSize: 16, marginVertical: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  cancel: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  danger: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ad3737',
    borderRadius: 24,
  },
  dangerText: { color: '#fff', fontWeight: '700' },
  checkInput: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, marginVertical: 12 },
  checkList: { maxHeight: 300, marginBottom: 12 },
  checkRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  chips: { gap: 8, paddingVertical: 10 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderRadius: 22 },
  batchWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  batchButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  transferButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10 },
  moreAction: {
    minHeight: 52,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  domainHeader: { paddingTop: 14, paddingBottom: 6, fontWeight: '800', borderBottomWidth: StyleSheet.hairlineWidth },
  groupRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  groupText: { flex: 1, fontWeight: '700' },
});
