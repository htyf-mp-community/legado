import { Pressable, StyleSheet, Text, View } from 'react-native';
import { shelfReadProgress, shelfSummary } from '../core/bookshelfDisplay';
import { useAppTheme } from '../theme/AppTheme';
import type { Book } from '../types';
import type { BookshelfPreferences } from '../data/bookshelfPreferences';
import { SourceIcon } from './SourceIcon';
export function BookshelfHeader({
  books,
  preferences,
  open,
  details,
}: {
  books: Book[];
  preferences: BookshelfPreferences;
  open: (id: string) => void;
  details: (id: string) => void;
}) {
  const { colors, t } = useAppTheme(),
    summary = shelfSummary(books),
    recent = summary.recent;
  if (!preferences.showStatistics && !(preferences.showRecentReading && recent))
    return null;
  return (
    <View style={s.header}>
      {preferences.showStatistics ? (
        <Text style={[s.text, { color: colors.muted }]}>
          {t('shelfStatistics', {
            total: summary.total,
            reading: summary.reading,
          })}
        </Text>
      ) : null}
      {preferences.showRecentReading && recent ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('continueReading')} ${recent.name}`}
          onPress={() => open(recent.id)}
          onLongPress={() => details(recent.id)}
          style={s.recent}
        >
          <Text style={[s.text, { color: colors.muted }]}>
            {t('continueReading')}
          </Text>
          <Text
            numberOfLines={1}
            style={[s.text, s.flex, { color: colors.text }]}
          >
            {recent.name}
          </Text>
          <Text
            numberOfLines={1}
            style={[s.text, s.flex, { color: colors.muted }]}
          >
            {recent.chapterTitle?.trim() || t('shelfNotStarted')}
          </Text>
          <Text style={[s.text, { color: colors.muted }]}>
            {Math.round((shelfReadProgress(recent) ?? 0) * 100)}%
          </Text>
          <SourceIcon name="ic_arrow_right" color={colors.muted} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  recent: {
    minHeight: 48,
    marginTop: 4,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: { fontSize: 14 },
  flex: { flex: 1 },
});
