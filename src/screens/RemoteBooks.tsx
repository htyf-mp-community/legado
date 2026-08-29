import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { unlink } from '@dr.pogodin/react-native-fs';
import { useFocusEffect } from '@react-navigation/native';
import { PageHeader } from '../components/PageHeader';
import {
  downloadRemoteBook,
  IMPORTABLE_REMOTE_BOOK_FILE,
  listRemoteBooks,
  remoteBooksRoot,
  sortRemoteBooks,
  type RemoteBookEntry,
  type RemoteBookSort,
} from '../core/remoteBooks';
import { importRemoteZip } from '../core/remoteBookArchive';
import { importSupportedBook } from '../core/localBookImport';
import { loadTxtTocRules } from '../data/txtTocRules';
import { ensureWebDavDirectory, loadWebDavConfig } from '../data/remoteBackup';
import type { Book } from '../types';
import { useAppTheme } from '../theme/AppTheme';

export function RemoteBooks({
  back,
  configure,
  imported,
}: {
  back: () => void;
  configure: () => void;
  imported: (books: Book[]) => void;
}) {
  const { colors, t } = useAppTheme(),
    [config, setConfig] = useState(loadWebDavConfig),
    root = useMemo(() => {
      try {
        return remoteBooksRoot(config);
      } catch {
        return '';
      }
    }, [config.directory, config.password, config.url, config.username]),
    [url, setUrl] = useState(root),
    [history, setHistory] = useState<string[]>([]),
    [entries, setEntries] = useState<RemoteBookEntry[]>([]),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState<RemoteBookSort>('modified'),
    [ascending, setAscending] = useState(false),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(''),
    request = useRef(0);
  useFocusEffect(useCallback(() => setConfig(loadWebDavConfig()), []));
  const load = useCallback(
    async (target = url) => {
      if (!target) return;
      const token = ++request.current;
      setLoading(true);
      setMessage('');
      try {
        if (target === root) await ensureWebDavDirectory(config);
        const next = await listRemoteBooks(config, target);
        if (token === request.current) {
          setEntries(next);
          setSelected(new Set());
        }
      } catch (error) {
        if (token === request.current)
          setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        if (token === request.current) setLoading(false);
      }
    },
    [config.directory, config.password, config.url, config.username, url],
  );
  useEffect(() => {
    if (root) {
      setUrl(root);
      void load(root);
    }
    return () => {
      request.current += 1;
    };
  }, [root]);
  const visible = sortRemoteBooks(entries, sort, ascending, query),
    open = (entry: RemoteBookEntry) => {
      if (!entry.isDirectory) return;
      setHistory(old => [...old, url]);
      setUrl(entry.url);
      void load(entry.url);
    },
    goUp = () => {
      const previous = history.at(-1);
      if (!previous) return;
      setHistory(old => old.slice(0, -1));
      setUrl(previous);
      void load(previous);
    },
    toggle = (entry: RemoteBookEntry) => {
      // TODO(htyf-native): RAR/7z import stays unavailable until a version-pinned allowlisted archive runtime is configured; see docs/htyf-migration-gaps.md.
      if (!IMPORTABLE_REMOTE_BOOK_FILE.test(entry.name)) {
        setMessage(
          t('archiveFormatUnavailable', {
            format: entry.name.split('.').pop()?.toUpperCase() ?? '',
          }),
        );
        return;
      }
      setSelected(old => {
        const next = new Set(old);
        if (next.has(entry.url)) next.delete(entry.url);
        else next.add(entry.url);
        return next;
      });
    };
  const add = async () => {
    const chosen = entries.filter(
      item => selected.has(item.url) && !item.isDirectory,
    );
    if (!chosen.length) return;
    setLoading(true);
    setMessage(t('downloadingRemoteBooks', { count: chosen.length }));
    const books: Book[] = [],
      errors: string[] = [];
    for (const entry of chosen) {
      let path = '';
      try {
        const downloaded = await downloadRemoteBook(config, entry);
        path = downloaded.path;
        if (entry.name.toLowerCase().endsWith('.zip'))
          books.push(
            ...(await importRemoteZip(
              downloaded.path,
              entry.url,
              loadTxtTocRules(),
            )),
          );
        else {
          const book = await importSupportedBook(
            downloaded.uri,
            entry.name,
            loadTxtTocRules(),
          );
          books.push({
            ...book,
            id: `remote:${encodeURIComponent(entry.url)}`,
            origin: 'webdav',
            originName: entry.name,
            bookUrl: entry.url,
            updatedAt: Date.now(),
          });
        }
      } catch (error) {
        errors.push(
          `${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        if (path)
          try {
            await unlink(path);
          } catch {}
      }
    }
    if (books.length) imported(books);
    setSelected(new Set());
    setMessage(
      errors.length
        ? errors.join('\n')
        : t('remoteBooksImported', { count: books.length }),
    );
    setLoading(false);
  };
  if (!root)
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Text style={[s.title, { color: colors.text }]}>
          {t('webDavNotConfigured')}
        </Text>
        <Text style={{ color: colors.muted }}>
          {t('remoteBooksConfigHelp')}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={[s.primary, { backgroundColor: colors.primary }]}
          onPress={configure}
        >
          <Text style={s.primaryText}>{t('configureWebDav')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.secondary}
          onPress={back}
        >
          <Text style={{ color: colors.primary }}>{t('back')}</Text>
        </Pressable>
      </View>
    );
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('remoteBooks')}
        onBack={back}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('configureWebDav')}
            style={s.touch}
            onPress={configure}
          >
            <Text style={{ color: colors.primary }}>⚙</Text>
          </Pressable>
        }
      />
      <View style={s.path}>
        <Pressable
          accessibilityRole="button"
          disabled={!history.length}
          accessibilityState={{ disabled: !history.length }}
          style={s.touch}
          onPress={goUp}
        >
          <Text
            style={{ color: history.length ? colors.primary : colors.muted }}
          >
            ‹
          </Text>
        </Pressable>
        <Text numberOfLines={1} style={[s.pathText, { color: colors.muted }]}>
          {decodeURIComponent(new URL(url).pathname)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('refresh')}
          style={s.touch}
          onPress={() => void load()}
        >
          <Text style={{ color: colors.primary }}>↻</Text>
        </Pressable>
      </View>
      <TextInput
        accessibilityLabel={t('filterRemoteBooks')}
        value={query}
        onChangeText={setQuery}
        placeholder={t('filterRemoteBooks')}
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
      <View style={s.sorts}>
        {(['name', 'modified'] as const).map(value => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: sort === value }}
            key={value}
            style={[
              s.sort,
              { borderColor: sort === value ? colors.primary : colors.border },
            ]}
            onPress={() => {
              if (sort === value) setAscending(old => !old);
              else {
                setSort(value);
                setAscending(true);
              }
            }}
          >
            <Text
              style={{ color: sort === value ? colors.primary : colors.text }}
            >
              {t(value === 'name' ? 'sortByName' : 'sortByModified')}{' '}
              {sort === value ? (ascending ? '↑' : '↓') : ''}
            </Text>
          </Pressable>
        ))}
      </View>
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.message, { color: colors.muted }]}
        >
          {message}
        </Text>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={s.loading} />
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {visible.map(entry => (
            <Pressable
              accessibilityRole={entry.isDirectory ? 'button' : 'checkbox'}
              accessibilityState={
                entry.isDirectory
                  ? undefined
                  : { checked: selected.has(entry.url) }
              }
              key={entry.url}
              style={[
                s.item,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => (entry.isDirectory ? open(entry) : toggle(entry))}
            >
              <Text style={s.icon}>{entry.isDirectory ? '📁' : '📖'}</Text>
              <View style={s.itemText}>
                <Text
                  numberOfLines={2}
                  style={[s.itemTitle, { color: colors.text }]}
                >
                  {entry.name}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {entry.isDirectory
                    ? t('folder')
                    : !IMPORTABLE_REMOTE_BOOK_FILE.test(entry.name)
                      ? t('archiveFormatUnavailable', {
                          format:
                            entry.name.split('.').pop()?.toUpperCase() ?? '',
                        })
                      : t('remoteBookMeta', {
                          size: Math.ceil(entry.size / 1024),
                          date: entry.modifiedAt
                            ? new Date(entry.modifiedAt).toLocaleDateString()
                            : '—',
                        })}
                </Text>
              </View>
              {!entry.isDirectory ? (
                <Text
                  style={{
                    color: selected.has(entry.url)
                      ? colors.primary
                      : colors.muted,
                  }}
                >
                  {selected.has(entry.url) ? '✓' : '○'}
                </Text>
              ) : (
                <Text style={{ color: colors.muted }}>›</Text>
              )}
            </Pressable>
          ))}
          {!visible.length ? (
            <Text style={[s.empty, { color: colors.muted }]}>
              {t('emptyRemoteDirectory')}
            </Text>
          ) : null}
        </ScrollView>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={!selected.size || loading}
        accessibilityState={{ disabled: !selected.size || loading }}
        style={[
          s.add,
          {
            backgroundColor:
              selected.size && !loading ? colors.primary : colors.border,
          },
        ]}
        onPress={() => void add()}
      >
        <Text style={s.primaryText}>
          {t('addSelectedRemoteBooks', { count: selected.size })}
        </Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  title: { fontSize: 21, fontWeight: '700' },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
  touch: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  path: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  pathText: { flex: 1 },
  input: {
    marginHorizontal: 14,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  sorts: { flexDirection: 'row', padding: 12, gap: 8 },
  sort: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { paddingHorizontal: 14 },
  loading: { marginTop: 50 },
  list: { padding: 14, gap: 9, paddingBottom: 100 },
  item: {
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: { fontSize: 24 },
  itemText: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 50 },
  add: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
    minHeight: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
