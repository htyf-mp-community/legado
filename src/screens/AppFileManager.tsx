import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import {
  appFileParent,
  appFileRoots,
  deleteAppFile,
  filterAppFiles,
  formatFileSize,
  listAppFiles,
  type AppFileEntry,
} from '../core/appFileManager';
import { useAppTheme } from '../theme/AppTheme';

export function AppFileManager({ back }: { back: () => void }) {
  const { colors, t } = useAppTheme(),
    roots = useMemo(appFileRoots, []),
    [rootIndex, setRootIndex] = useState(0),
    root = roots[rootIndex],
    [directory, setDirectory] = useState(root.path),
    [entries, setEntries] = useState<AppFileEntry[]>([]),
    [query, setQuery] = useState(''),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(''),
    [deleting, setDeleting] = useState<AppFileEntry>();
  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      setEntries(await listAppFiles(root.path, directory));
    } catch (reason) {
      setEntries([]);
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [directory, root.path]);
  useEffect(() => {
    setDirectory(root.path);
    setQuery('');
  }, [root.path]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const visible = filterAppFiles(entries, query),
    relative = directory.slice(root.path.length).replace(/^\//, ''),
    goBack = () => {
      if (directory === root.path) back();
      else setDirectory(appFileParent(root.path, directory));
    };
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('fileManager')}
        onBack={goBack}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('refresh')}
            style={s.headerAction}
            onPress={() => void refresh()}
          >
            <Text style={{ color: colors.primary, fontWeight: '700' }}>↻</Text>
          </Pressable>
        }
      />
      <View style={s.roots}>
        {roots.map((item, index) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: rootIndex === index }}
            key={item.id}
            style={[
              s.root,
              {
                borderColor:
                  rootIndex === index ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setRootIndex(index)}
          >
            <Text style={{ color: colors.text }}>
              {t(item.id === 'documents' ? 'appDocuments' : 'appCache')}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[s.path, { color: colors.muted }]} numberOfLines={2}>
        /{relative}
      </Text>
      <TextInput
        accessibilityLabel={t('filterFiles')}
        placeholder={t('filterFiles')}
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        style={[s.search, { color: colors.text, borderColor: colors.border }]}
      />
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : visible.length ? (
        <ScrollView contentContainerStyle={s.list}>
          {visible.map(entry => (
            <View
              key={entry.path}
              style={[s.entry, { borderColor: colors.border }]}
            >
              <Pressable
                accessibilityRole="button"
                style={s.entryMain}
                onPress={() =>
                  entry.isDirectory
                    ? setDirectory(entry.path)
                    : void Share.share({
                        title: entry.name,
                        url: `file://${entry.path}`,
                        message: entry.path,
                      })
                }
              >
                <Text style={[s.icon, { color: colors.primary }]}>
                  {entry.isDirectory ? '▣' : '▤'}
                </Text>
                <View style={s.grow}>
                  <Text
                    style={[s.name, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {entry.name}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {entry.isDirectory
                      ? t('folder')
                      : formatFileSize(entry.size)}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('deleteNamedFile', { name: entry.name })}
                style={s.delete}
                onPress={() => setDeleting(entry)}
              >
                <Text style={{ color: colors.danger, fontSize: 24 }}>×</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={s.center}>
          <Text style={{ color: colors.muted }}>
            {t(query ? 'noMatchingFiles' : 'emptyDirectory')}
          </Text>
        </View>
      )}
      {message ? (
        <Text
          accessibilityRole="alert"
          style={[s.message, { color: colors.danger }]}
        >
          {message}
        </Text>
      ) : null}
      <InTreeSheet
        visible={!!deleting}
        onDismiss={() => setDeleting(undefined)}
      >
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          {t('deleteFileConfirm', { name: deleting?.name ?? '' })}
        </Text>
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            style={[s.action, { borderColor: colors.border }]}
            onPress={() => setDeleting(undefined)}
          >
            <Text style={{ color: colors.text }}>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[s.action, { backgroundColor: colors.danger }]}
            onPress={() => {
              const target = deleting;
              setDeleting(undefined);
              if (!target) return;
              void deleteAppFile(root.path, target.path)
                .then(refresh)
                .catch(reason =>
                  setMessage(
                    reason instanceof Error ? reason.message : String(reason),
                  ),
                );
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {t('delete')}
            </Text>
          </Pressable>
        </View>
      </InTreeSheet>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  headerAction: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roots: { flexDirection: 'row', padding: 12, gap: 10 },
  root: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  path: { paddingHorizontal: 14, paddingBottom: 8 },
  search: {
    minHeight: 44,
    marginHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 14, paddingBottom: 24 },
  entry: {
    minHeight: 68,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  entryMain: {
    flex: 1,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: { width: 30, textAlign: 'center', fontSize: 22 },
  grow: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontWeight: '600' },
  delete: {
    width: 52,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { padding: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  action: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
