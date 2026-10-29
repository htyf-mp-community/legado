import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { keepLocalCopy, pick, types } from '@react-native-documents/picker';
import { readFile, unlink } from '@dr.pogodin/react-native-fs';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import {
  loadHttpTts,
  loadReadAloudPreferences,
  mergeHttpTts,
  normalizeHttpTts,
  parseHttpTts,
  saveHttpTts,
  saveReadAloudPreferences,
  restoreDefaultHttpTts,
  type HttpTts,
} from '../data/httpTts';
import { saveJsonDocument } from '../core/jsonTransfer';
import { clearHttpTtsCache } from '../services/httpTtsAudio';
import { useAppTheme } from '../theme/AppTheme';

/** Android SpeakEngineDialog/HttpTtsEditDialog mapping, using in-tree forms and MMKV. */
export function HttpTtsManager({ back }: { back: () => void }) {
  const { colors, t } = useAppTheme();
  const [engines, setEngines] = useState(loadHttpTts),
    [selected, setSelected] = useState(loadReadAloudPreferences().engineId);
  const [editing, setEditing] = useState<HttpTts>(),
    [deleting, setDeleting] = useState<HttpTts>();
  const [menu, setMenu] = useState(false),
    [importing, setImporting] = useState(false),
    [input, setInput] = useState('');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [editError, setEditError] = useState('');
  const commit = (next: HttpTts[]) => {
    setEngines(saveHttpTts(next));
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const importText = (raw: string) => {
    const incoming = parseHttpTts(raw);
    commit(mergeHttpTts(engines, incoming));
    setMessage(t('httpTtsImported', { count: incoming.length }));
  };
  const fromFile = async () => {
    const files = await pick({
      type: [types.json, types.plainText],
      allowMultiSelection: false,
      mode: 'import',
    });
    if (!files[0]) return;
    const copies = await keepLocalCopy({
      files: [{ uri: files[0].uri, fileName: files[0].name ?? 'httpTTS.json' }],
      destination: 'cachesDirectory',
    });
    const copy = copies[0];
    if (copy.status === 'error') throw new Error(copy.copyError);
    const path = copy.localUri.startsWith('file://')
      ? decodeURIComponent(copy.localUri.slice(7))
      : copy.localUri;
    try {
      importText(await readFile(path, 'utf8'));
    } finally {
      await unlink(path);
    }
  };
  const importInput = async () => {
    let raw = input.trim();
    if (/^https?:\/\//i.test(raw)) {
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch(raw, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        raw = await response.text();
      } finally {
        clearTimeout(timer);
      }
    }
    importText(raw);
    setImporting(false);
    setInput('');
  };
  const button = (label: string, action: () => void, danger = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      style={({ pressed }) => [
        s.button,
        { borderColor: colors.border, opacity: pressed || busy ? 0.5 : 1 },
      ]}
      onPress={action}
    >
      <Text style={{ color: danger ? colors.danger : colors.primary }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('httpTtsEngines')}
        onBack={back}
        action={button(t('readerMenuMore'), () => setMenu(true))}
      />
      <Text style={[s.note, { color: colors.muted }]}>
        {t('httpTtsUnavailable')}
      </Text>
      {busy ? <ActivityIndicator /> : null}
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          selectable
          style={[s.note, { color: colors.text }]}
        >
          {message}
        </Text>
      ) : null}
      <FlatList
        style={s.listViewport}
        data={engines}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <Text style={[s.note, { color: colors.muted }]}>
            {t('httpTtsEmpty')}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[s.item, { borderColor: colors.border }]}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={t('httpTtsSelect', { name: item.name })}
              accessibilityState={{ checked: selected === item.id }}
              style={({ pressed }) => [
                s.engine,
                { opacity: pressed ? 0.5 : 1 },
              ]}
              onPress={() => {
                setSelected(item.id);
                saveReadAloudPreferences({ engineId: item.id });
              }}
            >
              <Text
                style={{
                  color: selected === item.id ? colors.primary : colors.text,
                  fontSize: 16,
                }}
              >
                {selected === item.id ? '● ' : '○ '}
                {item.name}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.muted }}>
                {item.url}
              </Text>
            </Pressable>
            {button(t('edit'), () => {
              setEditError('');
              setEditing({ ...item });
            })}
            {button(t('delete'), () => setDeleting(item), true)}
          </View>
        )}
      />
      <InTreeSheet visible={menu} onDismiss={() => setMenu(false)}>
        {button(t('httpTtsNew'), () => {
          setMenu(false);
          setEditError('');
          setEditing(
            normalizeHttpTts({
              id: Date.now(),
              name: t('httpTtsNew'),
              url: 'https://',
            }),
          );
        })}
        {button(t('httpTtsDefaults'), () => {
          setMenu(false);
          commit(restoreDefaultHttpTts(engines));
        })}
        {button(t('httpTtsClipboard'), () => {
          setMenu(false);
          void run(async () => importText(await Clipboard.getString()));
        })}
        {button(t('httpTtsFile'), () => {
          setMenu(false);
          void run(fromFile);
        })}
        {button(t('httpTtsOnline'), () => {
          setMenu(false);
          setImporting(true);
        })}
        {button(t('httpTtsExport'), () => {
          setMenu(false);
          void run(async () => {
            await saveJsonDocument(
              JSON.stringify(engines, null, 2),
              'httpTTS.json',
            );
          });
        })}
        {button(t('httpTtsClearCache'), () => {
          setMenu(false);
          void run(clearHttpTtsCache);
        })}
      </InTreeSheet>
      <InTreeSheet
        visible={importing}
        onDismiss={() => !busy && setImporting(false)}
      >
        <Text
          accessibilityRole="header"
          style={[s.title, { color: colors.text }]}
        >
          {t('httpTtsOnline')}
        </Text>
        <TextInput
          accessibilityLabel={t('httpTtsUrl')}
          placeholder={t('httpTtsUrl')}
          placeholderTextColor={colors.muted}
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          multiline
          style={[s.input, { color: colors.text, borderColor: colors.border }]}
        />
        {button(t('import'), () => void run(importInput))}
        {message ? (
          <Text style={{ color: colors.danger }}>{message}</Text>
        ) : null}
      </InTreeSheet>
      <InTreeSheet visible={!!editing} onDismiss={() => setEditing(undefined)}>
        <Text
          accessibilityRole="header"
          style={[s.title, { color: colors.text }]}
        >
          {t('httpTtsEdit')}
        </Text>
        <Text style={[s.note, { color: colors.muted }]}>
          {t('httpTtsHelp')}
        </Text>
        {editing ? (
          <>
            {(
              [
                'name',
                'url',
                'contentType',
                'pauseDuration',
                'concurrentRate',
                'header',
                'loginUrl',
                'loginUi',
                'loginCheckJs',
                'jsLib',
              ] as const
            ).map(key => (
              <View key={key} style={s.field}>
                <Text style={{ color: colors.text }}>
                  {key === 'name'
                    ? t('name')
                    : key === 'url'
                      ? 'URL'
                      : key === 'pauseDuration'
                        ? 'pauseDuration (ms)'
                        : key}
                </Text>
                <TextInput
                  accessibilityLabel={key}
                  autoCapitalize="none"
                  multiline={
                    ![
                      'name',
                      'contentType',
                      'pauseDuration',
                      'concurrentRate',
                    ].includes(key)
                  }
                  keyboardType={
                    key === 'pauseDuration' ? 'number-pad' : 'default'
                  }
                  value={String(editing[key] ?? '')}
                  onChangeText={value =>
                    setEditing({
                      ...editing,
                      [key]: key === 'pauseDuration' ? Number(value) : value,
                    })
                  }
                  style={[
                    s.input,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                />
              </View>
            ))}
            <View style={s.cookie}>
              <Text style={{ color: colors.text }}>CookieJar</Text>
              <Switch
                accessibilityLabel="CookieJar"
                value={editing.enabledCookieJar}
                onValueChange={enabledCookieJar =>
                  setEditing({ ...editing, enabledCookieJar })
                }
              />
            </View>
            {editError ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: colors.danger }}
              >
                {editError}
              </Text>
            ) : null}
            {button(t('save'), () => {
              try {
                commit(
                  mergeHttpTts(engines, [
                    normalizeHttpTts({
                      ...editing,
                      lastUpdateTime: Date.now(),
                    }),
                  ]),
                );
                setEditing(undefined);
              } catch (error) {
                setEditError(
                  error instanceof Error ? error.message : String(error),
                );
              }
            })}
            {button(t('share'), () => {
              Clipboard.setString(JSON.stringify(editing, null, 2));
              setEditError(t('ruleCopied'));
            })}
          </>
        ) : null}
      </InTreeSheet>
      <InTreeSheet
        visible={!!deleting}
        onDismiss={() => setDeleting(undefined)}
      >
        <Text style={[s.title, { color: colors.text }]}>
          {t('httpTtsDelete', { name: deleting?.name ?? '' })}
        </Text>
        {button(
          t('delete'),
          () => {
            if (!deleting) return;
            commit(engines.filter(item => item.id !== deleting.id));
            if (selected === deleting.id) {
              setSelected(undefined);
              saveReadAloudPreferences({ engineId: undefined });
            }
            setDeleting(undefined);
          },
          true,
        )}
        {button(t('cancel'), () => setDeleting(undefined))}
      </InTreeSheet>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1 },
  listViewport: { flex: 1 },
  note: { padding: 12, lineHeight: 22 },
  list: { padding: 12, paddingBottom: 40 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  engine: {
    flex: 1,
    minWidth: 160,
    minHeight: 48,
    justifyContent: 'center',
    gap: 6,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  field: { gap: 6, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48,
    padding: 10,
    textAlignVertical: 'top',
  },
  cookie: {
    flexDirection: 'row',
    minHeight: 48,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
