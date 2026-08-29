import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PageHeader } from '../components/PageHeader';
import { useAppTheme } from '../theme/AppTheme';

export function ReaderHelp({ back }: { back: () => void }) {
  const { colors, t } = useAppTheme();
  const sections = [
    ['readerHelpNavigation', 'readerHelpNavigationBody'],
    ['readerHelpSearch', 'readerHelpSearchBody'],
    ['readerHelpAudio', 'readerHelpAudioBody'],
    ['readerHelpAppearance', 'readerHelpAppearanceBody'],
    ['readerHelpSettings', 'readerHelpSettingsBody'],
  ] as const;
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader title={t('readerHelp')} onBack={back} />
      <ScrollView contentContainerStyle={s.content}>
        {sections.map(([title, body]) => (
          <View key={title} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text accessibilityRole="header" style={[s.title, { color: colors.text }]}>{t(title)}</Text>
            <Text selectable style={[s.body, { color: colors.text }]}>{t(body)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23 },
});
