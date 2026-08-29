import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PageHeader } from '../components/PageHeader';
import { cancelDownload, removeDownload, runDownload } from '../core/mediaDownload';
import { loadDownloads, saveDownloads, type DownloadRecord } from '../data/downloads';
import type { MessageKey } from '../i18n';
import { useAppTheme } from '../theme/AppTheme';

const stateKeys: Record<DownloadRecord['state'], MessageKey> = {
  queued: 'downloadQueued',
  downloading: 'downloading',
  completed: 'downloadCompleted',
  failed: 'downloadFailed',
  cancelled: 'downloadCancelled',
};

export function DownloadManager({ back }: { back: () => void }) {
  const { colors, t } = useAppTheme();
  const [items, setItems] = useState(loadDownloads);
  const patch = (id: string, value: Partial<DownloadRecord>) => setItems(current => {
    const next = current.map(item => item.id === id ? { ...item, ...value } : item);
    saveDownloads(next);
    return next;
  });
  const start = (item: DownloadRecord) => void runDownload(item, value => patch(item.id, value)).catch(() => {});
  const remove = (item: DownloadRecord) => void removeDownload(item).then(() => setItems(current => {
    const next = current.filter(value => value.id !== item.id);
    saveDownloads(next);
    return next;
  }));

  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('downloadManagerTitle', { count: items.length })} onBack={back} />
      <ScrollView contentContainerStyle={s.list}>
        {items.map(item => (
          <View key={item.id} style={[s.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text numberOfLines={1} style={[s.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={{ color: colors.muted }}>{t('downloadProgress', { state: t(stateKeys[item.state]), percent: Math.round(item.progress * 100) })}</Text>
            {item.error ? <Text style={{ color: colors.danger }}>{item.error}</Text> : null}
            <View style={s.row}>
              {item.state !== 'completed' && item.state !== 'downloading' ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t('retryNamed', { name: item.title })} style={s.touch} onPress={() => start(item)}>
                  <Text style={{ color: colors.primary }}>{t('retry')}</Text>
                </Pressable>
              ) : null}
              {item.state === 'downloading' ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t('cancelNamed', { name: item.title })} style={s.touch} onPress={() => { cancelDownload(item.id); patch(item.id, { state: 'cancelled' }); }}>
                  <Text style={{ color: colors.danger }}>{t('cancel')}</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={t('deleteNamedItem', { name: item.title })} style={s.touch} onPress={() => remove(item)}>
                <Text style={{ color: colors.danger }}>{t('delete')}</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {!items.length ? <Text style={[s.empty, { color: colors.muted }]}>{t('emptyDownloads')}</Text> : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, gap: 10 },
  item: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  title: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'flex-end' },
  touch: { minWidth: 54, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: 60 },
});
