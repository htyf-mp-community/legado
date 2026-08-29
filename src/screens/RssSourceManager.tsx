import { useMemo, useState } from 'react';
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
import jssdk from '@htyf-mp/js-sdk';
import { InTreeSheet } from '../components/InTreeSheet';
import { PageHeader } from '../components/PageHeader';
import {
  exportRssSources,
  loadRssArticles,
  loadRssSources,
  mergeRssSources,
  saveRssArticles,
  saveRssSources,
} from '../data/rss';
import type { RssSource } from '../types';
import {
  buildEditedRssSource,
  migrateRssArticleOrigin,
  rssAdvancedFields,
  RssSourceEditorError,
} from '../core/rssSourceEditor';
import {
  clearSourceCookies,
  loadSourceCookies,
  saveDocumentCookies,
} from '../data/sourceCookies';
import { useAppTheme } from '../theme/AppTheme';
import { KeyboardAssistInput } from '../components/KeyboardAssistInput';
import { assignUngroupedRssSources, filterRssSources, renameRssSourceGroup, rssSourceGroups, updateSelectedRssSources, type RssSourceFilter } from '../data/rssSourceManagement';
import { defaultRssSources, importRssSourcesInput, pickRssSourcesInput } from '../core/rssSourceImport';
import { expandSelectionInterval } from '../core/selectionInterval';
import { saveJsonDocument, shareJsonText } from '../core/jsonTransfer';

const empty = (): RssSource => ({
  sourceUrl: '',
  sourceName: '',
  enabled: true,
  customOrder: 0,
});
export function RssSourceManager({
  back,
  login,
  debug,
  openQr,
}: {
  back: () => void;
  login: (sourceUrl: string) => void;
  debug: (sourceUrl: string) => void;
  openQr: () => void;
}) {
  const { colors, t } = useAppTheme();
  const [sources, setSources] = useState(loadRssSources),
    [editing, setEditing] = useState<RssSource | null>(null),
    [advanced, setAdvanced] = useState('{}'),
    [original, setOriginal] = useState(''),
    [remove, setRemove] = useState<RssSource | null>(null),
    [filter, setFilter] = useState('');
  const [managementVisible, setManagementVisible] = useState(false),
    [filterMode, setFilterMode] = useState<RssSourceFilter>('all'),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [groupName, setGroupName] = useState(''),
    [editingGroup, setEditingGroup] = useState<string>();
  const [transferVisible, setTransferVisible] = useState(false),
    [onlineUrl, setOnlineUrl] = useState(''),
    [importing, setImporting] = useState(false);
  const visible = useMemo(() => {
    return filterRssSources(sources, filterMode, filter);
  }, [sources, filter, filterMode]);
  const commit = (next: RssSource[]) => {
    setSources(next);
    saveRssSources(next);
  };
  const toast = (
    type: 'success' | 'error',
    title: string,
    description?: string,
  ) => void jssdk.showToast({ type, title, description });
  const begin = (source: RssSource, previous = '') => {
    setOriginal(previous);
    setEditing({ ...source });
    setAdvanced(JSON.stringify(rssAdvancedFields(source), null, 2));
  };
  const importRules = async (load: () => Promise<RssSource[]>) => {
    if(importing)return;setImporting(true);
    try {
      const incoming = await load();
      commit(mergeRssSources(sources, incoming));
      setTransferVisible(false);
      toast('success', t('rssSourcesImported', { count: incoming.length }));
    } catch (error) {
      if(isErrorWithCode(error)&&error.code===errorCodes.OPERATION_CANCELED)return;
      toast(
        'error',
        t('rssSourceImportFailed'),
        error instanceof Error ? error.message : String(error),
      );
    } finally { setImporting(false); }
  };
  const selectedJson = () =>
    exportRssSources(visible.filter(source => selected.has(source.sourceUrl)));
  const saveSelected = async () => {
    try {
      await saveJsonDocument(selectedJson(), 'rssSources.json');
      toast('success', t('selectionExported'));
    } catch (error) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED)
        return;
      toast(
        'error',
        t('selectionExportFailed'),
        error instanceof Error ? error.message : String(error),
      );
    }
  };
  const shareSelected = async () => {
    try {
      await shareJsonText(selectedJson(), t('rssSourceShareTitle'));
    } catch (error) {
      toast(
        'error',
        t('shareFailed'),
        error instanceof Error ? error.message : String(error),
      );
    }
  };
  const save = () => {
    if (!editing) return;
    try {
      const value = buildEditedRssSource(editing, advanced),
        base = original
          ? sources.filter(item => item.sourceUrl !== original)
          : sources;
      if (original && original !== value.sourceUrl) {
        saveRssArticles(
          migrateRssArticleOrigin(loadRssArticles(), original, value.sourceUrl),
        );
        const cookies = loadSourceCookies(original);
        clearSourceCookies(original);
        if (Object.keys(cookies).length)
          saveDocumentCookies(
            value.sourceUrl,
            Object.entries(cookies)
              .map(([name, cookie]) => `${name}=${cookie}`)
              .join('; '),
          );
      }
      commit(mergeRssSources(base, [value]));
      setEditing(null);
      toast('success', t('rssSourceSaved'));
    } catch (error) {
      toast(
        'error',
        t('rssSourceSaveFailed'),
        error instanceof RssSourceEditorError
          ? t(error.code)
          : error instanceof Error
            ? error.message
            : String(error),
      );
    }
  };
  const deleteSource = () => {
    if (!remove) return;
    commit(sources.filter(item => item.sourceUrl !== remove.sourceUrl));
    saveRssArticles(
      loadRssArticles().filter(article => article.origin !== remove.sourceUrl),
    );
    clearSourceCookies(remove.sourceUrl);
    setRemove(null);
  };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('rssSourceManagerTitle', { count: sources.length })}
        onBack={back}
        action={
          <View style={s.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('manageRssSources')} style={s.touch} onPress={() => setManagementVisible(true)}><Text style={[s.manage, { color: colors.primary }]}>{selected.size || t('manage')}</Text></Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('exportRssSources')}
              style={s.touch}
              onPress={() => {
                Clipboard.setString(exportRssSources(sources));
                toast('success', t('rssSourcesCopied'));
              }}
            >
              <Text style={[s.icon, { color: colors.primary }]}>⇧</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('importRssSources')}
              style={s.touch}
              onPress={() => setTransferVisible(true)}
            >
              <Text style={[s.icon, { color: colors.primary }]}>↓</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('createRssSource')}
              style={s.touch}
              onPress={() => begin(empty())}
            >
              <Text style={[s.icon, { color: colors.primary }]}>＋</Text>
            </Pressable>
          </View>
        }
      />
      <TextInput
        accessibilityLabel={t('filterRssSources')}
        value={filter}
        onChangeText={setFilter}
        placeholder={t('filterRssPlaceholder')}
        placeholderTextColor={colors.muted}
        style={[
          s.search,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
      />
      <ScrollView contentContainerStyle={s.list}>
        {visible.map(source => (
          <View
            key={source.sourceUrl}
            style={[s.item, { borderColor: colors.border }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('editNamedRssSource', {
                name: source.sourceName,
              })}
              style={s.text}
              onPress={() => begin(source, source.sourceUrl)}
              onLongPress={() => setSelected(current => { const next = new Set(current); next.has(source.sourceUrl) ? next.delete(source.sourceUrl) : next.add(source.sourceUrl); return next; })}
            >
              <Text style={[s.name, { color: colors.text }]}> 
                {selected.has(source.sourceUrl) ? '✓ ' : ''}{source.sourceName}
              </Text>
              <Text numberOfLines={1} style={[s.meta, { color: colors.muted }]}>
                {source.sourceGroup ? `${source.sourceGroup} · ` : ''}
                {source.sourceUrl}
              </Text>
            </Pressable>
            {source.loginUrl || source.enabledCookieJar ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('loginNamedRssSource', {
                  name: source.sourceName,
                })}
                style={s.login}
                onPress={() => login(source.sourceUrl)}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {t('login')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('debugNamedRssSource', {
                name: source.sourceName,
              })}
              style={s.login}
              onPress={() => debug(source.sourceUrl)}
            >
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {t('debugTask')}
              </Text>
            </Pressable>
            <Switch
              accessibilityLabel={t('rssSourceEnabledNamed', {
                name: source.sourceName,
              })}
              value={source.enabled}
              onValueChange={enabled =>
                commit(
                  sources.map(item =>
                    item.sourceUrl === source.sourceUrl
                      ? { ...item, enabled }
                      : item,
                  ),
                )
              }
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('deleteNamed', { name: source.sourceName })}
              style={s.touch}
              onPress={() => setRemove(source)}
            >
              <Text style={[s.delete, { color: colors.danger }]}>×</Text>
            </Pressable>
          </View>
        ))}
        {!visible.length ? (
          <Text style={[s.empty, { color: colors.muted }]}>
            {t('noMatchingRssSources')}
          </Text>
        ) : null}
      </ScrollView>
      <InTreeSheet visible={transferVisible} onDismiss={() => !importing && setTransferVisible(false)}>
        <Text style={[s.title, { color: colors.text }]}>{t('importRssSources')}</Text>
        <TextInput accessibilityLabel={t('onlineRssSourceUrl')} value={onlineUrl} onChangeText={setOnlineUrl} autoCapitalize="none" placeholder={t('onlineRssSourceUrl')} placeholderTextColor={colors.muted} style={[s.groupInput, { color: colors.text, borderColor: colors.border }]} />
        <Pressable accessibilityRole="button" disabled={importing || !onlineUrl.trim()} style={s.transferButton} onPress={() => void importRules(() => importRssSourcesInput(onlineUrl))}><Text style={{ color: colors.primary }}>{t('importOnlineSource')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={importing} style={s.transferButton} onPress={() => void importRules(pickRssSourcesInput)}><Text style={{ color: colors.primary }}>{t('importSourceFile')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={importing} style={s.transferButton} onPress={() => void importRules(async () => importRssSourcesInput(await Clipboard.getString()))}><Text style={{ color: colors.primary }}>{t('importSourcesClipboard')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={importing} style={s.transferButton} onPress={() => void importRules(async () => defaultRssSources())}><Text style={{ color: colors.primary }}>{t('importDefaultRssSources')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={importing} style={s.transferButton} onPress={() => { setTransferVisible(false); openQr(); }}><Text style={{ color: colors.primary }}>{t('importSourceQr')}</Text></Pressable>
      </InTreeSheet>
      <InTreeSheet visible={managementVisible} onDismiss={() => setManagementVisible(false)}>
        <Text style={[s.title, { color: colors.text }]}>{t('manageRssSources')}</Text>
        <Text style={[s.meta, { color: colors.muted }]}>{t('selectedRssSources', { count: selected.size })}</Text>
        <ScrollView horizontal contentContainerStyle={s.chips}>{(['all','enabled','disabled','login','ungrouped'] as RssSourceFilter[]).map(value => <Pressable key={value} accessibilityRole="button" style={[s.chip, { borderColor: filterMode === value ? colors.primary : colors.border }]} onPress={() => setFilterMode(value)}><Text style={{ color: colors.text }}>{t(`sourceFilter_${value}` as never)}</Text></Pressable>)}{rssSourceGroups(sources).map(group => <Pressable key={group} accessibilityRole="button" style={[s.chip, { borderColor: filterMode === `group:${group}` ? colors.primary : colors.border }]} onPress={() => setFilterMode(`group:${group}`)}><Text style={{ color: colors.text }}>{group}</Text></Pressable>)}</ScrollView>
        <View style={s.batchWrap}>{(['enable','disable','top','bottom'] as const).map(action => <Pressable key={action} disabled={!selected.size} accessibilityRole="button" style={s.batchButton} onPress={() => commit(updateSelectedRssSources(sources, selected, action))}><Text style={{ color: colors.primary }}>{t(`sourceBatch_${action}` as never)}</Text></Pressable>)}</View>
        <TextInput accessibilityLabel={t('rssSourceGroup')} value={groupName} onChangeText={setGroupName} placeholder={t('rssSourceGroup')} placeholderTextColor={colors.muted} style={[s.groupInput, { color: colors.text, borderColor: colors.border }]} />
        <View style={s.row}><Pressable accessibilityRole="button" disabled={!groupName.trim()} style={s.batchButton} onPress={() => { commit(editingGroup ? renameRssSourceGroup(sources, editingGroup, groupName) : selected.size ? updateSelectedRssSources(sources, selected, 'addGroup', groupName) : assignUngroupedRssSources(sources, groupName)); if (editingGroup && filterMode === `group:${editingGroup}`) setFilterMode(`group:${groupName.trim()}`); setEditingGroup(undefined); setGroupName(''); }}><Text style={{ color: colors.primary }}>{editingGroup ? t('renameGroup') : selected.size ? t('addGroup') : t('assignUngrouped')}</Text></Pressable><Pressable accessibilityRole="button" disabled={!selected.size || !groupName.trim()} style={s.batchButton} onPress={() => commit(updateSelectedRssSources(sources, selected, 'removeGroup', groupName))}><Text style={{ color: colors.danger }}>{t('removeGroup')}</Text></Pressable></View>
        <ScrollView style={s.groupList}>{rssSourceGroups(sources).map(group => <View key={group} style={[s.groupRow, { borderColor: colors.border }]}><Text style={[s.groupText, { color: colors.text }]}>{group}</Text><Pressable accessibilityRole="button" style={s.batchButton} onPress={() => { setEditingGroup(group); setGroupName(group); }}><Text style={{ color: colors.primary }}>{t('edit')}</Text></Pressable><Pressable accessibilityRole="button" style={s.batchButton} onPress={() => { commit(renameRssSourceGroup(sources, group)); if (filterMode === `group:${group}`) setFilterMode('all'); }}><Text style={{ color: colors.danger }}>{t('delete')}</Text></Pressable></View>)}</ScrollView>
        <View style={s.batchWrap}><Pressable accessibilityRole="button" style={s.batchButton} onPress={() => setSelected(new Set(visible.map(source => source.sourceUrl)))}><Text style={{ color: colors.primary }}>{t('selectAll')}</Text></Pressable><Pressable accessibilityRole="button" disabled={!selected.size} style={s.batchButton} onPress={() => setSelected(expandSelectionInterval(visible, selected, source => source.sourceUrl))}><Text style={{ color: colors.primary }}>{t('selectInterval')}</Text></Pressable><Pressable accessibilityRole="button" style={s.batchButton} onPress={() => setSelected(new Set())}><Text style={{ color: colors.text }}>{t('clearSelection')}</Text></Pressable><Pressable accessibilityRole="button" disabled={!selected.size} style={s.batchButton} onPress={() => { Clipboard.setString(selectedJson()); toast('success', t('selectionCopied')); }}><Text style={{ color: colors.primary }}>{t('copySelection')}</Text></Pressable><Pressable accessibilityRole="button" disabled={!selected.size} style={s.batchButton} onPress={() => void saveSelected()}><Text style={{ color: colors.primary }}>{t('exportSelection')}</Text></Pressable><Pressable accessibilityRole="button" disabled={!selected.size} style={s.batchButton} onPress={() => void shareSelected()}><Text style={{ color: colors.primary }}>{t('shareSelection')}</Text></Pressable></View>
      </InTreeSheet>
      <InTreeSheet visible={!!editing} onDismiss={() => setEditing(null)}>
        {editing ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.sheetContent}
          >
            <Text style={[s.title, { color: colors.text }]}>
              {t('editRssSource')}
            </Text>
            <Field
              label={t('rssSourceName')}
              value={editing.sourceName}
              change={sourceName => setEditing({ ...editing, sourceName })}
            />
            <Field
              label={t('rssSourceUrl')}
              value={editing.sourceUrl}
              change={sourceUrl => setEditing({ ...editing, sourceUrl })}
              multi
            />
            <Field
              label={t('rssSourceGroup')}
              value={editing.sourceGroup ?? ''}
              change={sourceGroup => setEditing({ ...editing, sourceGroup })}
            />
            <Field
              label={t('rssSourceIcon')}
              value={String(editing.sourceIcon ?? '')}
              change={sourceIcon => setEditing({ ...editing, sourceIcon })}
            />
            <Field
              label={t('rssSourceComment')}
              value={String(editing.sourceComment ?? '')}
              change={sourceComment =>
                setEditing({ ...editing, sourceComment })
              }
              multi
            />
            <Field
              label={t('sortWeight')}
              value={String(editing.customOrder)}
              change={value =>
                setEditing({ ...editing, customOrder: Number(value) || 0 })
              }
            />
            <Field
              label={t('requestHeaderJson')}
              value={String(editing.header ?? '')}
              change={header => setEditing({ ...editing, header })}
              multi
            />
            <Field
              label={t('rssCategories')}
              value={String(editing.sortUrl ?? '')}
              change={sortUrl => setEditing({ ...editing, sortUrl })}
              multi
            />
            <Field
              label={t('rssSearchUrl')}
              value={String(editing.searchUrl ?? '')}
              change={searchUrl => setEditing({ ...editing, searchUrl })}
              multi
            />
            <Text style={[s.subTitle, { color: colors.text }]}>
              {t('rssListRules')}
            </Text>
            <Field
              label={t('rssArticleList')}
              value={String(editing.ruleArticles ?? '')}
              change={ruleArticles => setEditing({ ...editing, ruleArticles })}
            />
            <Field
              label={t('rssNextPageRule')}
              value={String(editing.ruleNextPage ?? '')}
              change={ruleNextPage => setEditing({ ...editing, ruleNextPage })}
            />
            <Field
              label={t('ruleTitle')}
              value={String(editing.ruleTitle ?? '')}
              change={ruleTitle => setEditing({ ...editing, ruleTitle })}
            />
            <Field
              label={t('ruleLink')}
              value={String(editing.ruleLink ?? '')}
              change={ruleLink => setEditing({ ...editing, ruleLink })}
            />
            <Field
              label={t('ruleDate')}
              value={String(editing.rulePubDate ?? '')}
              change={rulePubDate => setEditing({ ...editing, rulePubDate })}
            />
            <Field
              label={t('ruleDescription')}
              value={String(editing.ruleDescription ?? '')}
              change={ruleDescription =>
                setEditing({ ...editing, ruleDescription })
              }
            />
            <Field
              label={t('ruleImage')}
              value={String(editing.ruleImage ?? '')}
              change={ruleImage => setEditing({ ...editing, ruleImage })}
            />
            <Field
              label={t('ruleContent')}
              value={String(editing.ruleContent ?? '')}
              change={ruleContent => setEditing({ ...editing, ruleContent })}
            />
            <Field
              label={t('contentNextPage')}
              value={String(editing.nextContentUrl ?? '')}
              change={nextContentUrl =>
                setEditing({ ...editing, nextContentUrl })
              }
            />
            <Text style={[s.subTitle, { color: colors.text }]}>
              {t('webAndLogin')}
            </Text>
            <Field
              label={t('webInjectJs')}
              value={String(editing.injectJs ?? '')}
              change={injectJs => setEditing({ ...editing, injectJs })}
              multi
            />
            <Field
              label={t('loginUrl')}
              value={String(editing.loginUrl ?? '')}
              change={loginUrl => setEditing({ ...editing, loginUrl })}
            />
            <Field
              label={t('loginUiJsonLong')}
              value={String(editing.loginUi ?? '')}
              change={loginUi => setEditing({ ...editing, loginUi })}
              multi
            />
            <Field
              label={t('loginCheckJsLong')}
              value={String(editing.loginCheckJs ?? '')}
              change={loginCheckJs => setEditing({ ...editing, loginCheckJs })}
              multi
            />
            <Option
              label={t('enableCookieManagement')}
              value={editing.enabledCookieJar !== false}
              change={enabledCookieJar =>
                setEditing({ ...editing, enabledCookieJar })
              }
            />
            <Option
              label={t('useSourceAsBaseUrl')}
              value={editing.loadWithBaseUrl !== false}
              change={loadWithBaseUrl =>
                setEditing({ ...editing, loadWithBaseUrl })
              }
            />
            <Option
              label={t('enableWebJavaScript')}
              value={editing.enableJs !== false}
              change={enableJs => setEditing({ ...editing, enableJs })}
            />
            <Option
              label={t('singleUrlSource')}
              value={editing.singleUrl === true}
              change={singleUrl => setEditing({ ...editing, singleUrl })}
            />
            <Field
              label={t('articleStyle')}
              value={String(editing.articleStyle ?? 0)}
              change={value =>
                setEditing({ ...editing, articleStyle: Number(value) || 0 })
              }
            />
            <Field
              label={t('rssContentType')}
              value={String(editing.type ?? 0)}
              change={value =>
                setEditing({ ...editing, type: Number(value) || 0 })
              }
            />
            <Field
              label={t('advancedRssJson')}
              value={advanced}
              change={setAdvanced}
              multi
              code
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('saveSource')}
              style={[s.primary, { backgroundColor: colors.primary }]}
              onPress={save}
            >
              <Text style={s.primaryText}>{t('saveSource')}</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </InTreeSheet>
      <InTreeSheet visible={!!remove} onDismiss={() => setRemove(null)}>
        <Text style={[s.title, { color: colors.text }]}>
          {t('deleteRssSourceTitle')}
        </Text>
        <Text style={[s.remove, { color: colors.muted }]}>
          {remove?.sourceName}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('deleteNamed', {
            name: remove?.sourceName ?? '',
          })}
          style={[s.danger, { backgroundColor: colors.danger }]}
          onPress={deleteSource}
        >
          <Text style={s.primaryText}>{t('delete')}</Text>
        </Pressable>
      </InTreeSheet>
    </View>
  );
}

function Field({
  label,
  value,
  change,
  multi = false,
  code = false,
}: {
  label: string;
  value: string;
  change: (value: string) => void;
  multi?: boolean;
  code?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <KeyboardAssistInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        multiline={multi}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          s.input,
          multi && s.multi,
          code && s.code,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
          },
        ]}
      />
    </View>
  );
}
function Option({
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
    <View style={s.option}>
      <Text style={{ color: colors.text }}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={change} />
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 23 },
  manage: { fontWeight: '700' },
  search: {
    minHeight: 46,
    margin: 12,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
  },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  item: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 5 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12 },
  login: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delete: { fontSize: 28 },
  empty: { textAlign: 'center', marginTop: 60 },
  sheetContent: { paddingBottom: 28 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 14 },
  subTitle: { fontSize: 17, fontWeight: '700', marginVertical: 12 },
  field: { marginBottom: 12 },
  label: { fontWeight: '600', marginBottom: 6 },
  input: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multi: { minHeight: 88, textAlignVertical: 'top' },
  code: { minHeight: 180, fontFamily: 'monospace' },
  option: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  remove: { marginBottom: 18 },
  danger: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { gap: 8, paddingVertical: 10 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderRadius: 22 },
  batchWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  batchButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  groupInput: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, marginVertical: 10 },
  groupList: { maxHeight: 220 },
  groupRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  groupText: { flex: 1, fontWeight: '700' },
  transferButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10 },
});
