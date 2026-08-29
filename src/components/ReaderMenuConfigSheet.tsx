import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { InTreeSheet } from './InTreeSheet';
import {
  moveReaderMenuItem,
  setReaderMenuSection,
  type ReaderMenuConfig,
  type ReaderMenuKey,
} from '../data/readerMenu';
import { useAppTheme } from '../theme/AppTheme';

export function ReaderMenuConfigSheet({
  visible,
  value,
  label,
  change,
  dismiss,
}: {
  visible: boolean;
  value: ReaderMenuConfig;
  label: (key: ReaderMenuKey) => string;
  change: (value: ReaderMenuConfig) => void;
  dismiss: () => void;
}) {
  const { colors, t } = useAppTheme();
  return (
    <InTreeSheet visible={visible} onDismiss={dismiss}>
      <Text style={[s.title, { color: colors.text }]}>
        {t('readerMenuConfiguration')}
      </Text>
      <Text style={{ color: colors.muted }}>
        {t('readerMenuConfigurationDescription')}
      </Text>
      <ScrollView contentContainerStyle={s.list}>
        {(['primary', 'more'] as const).map(section => (
          <View key={section}>
            <Text style={[s.section, { color: colors.primary }]}>
              {t(
                section === 'primary' ? 'readerMenuPrimary' : 'readerMenuMore',
              )}
            </Text>
            {value[section].map((key, index) => (
              <View key={key} style={[s.row, { borderColor: colors.border }]}>
                <Text style={[s.name, { color: colors.text }]}>
                  {label(key)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('moveUpNamed', { name: label(key) })}
                  disabled={index === 0}
                  style={s.action}
                  onPress={() => change(moveReaderMenuItem(value, key, -1))}
                >
                  <Text
                    style={{
                      color: index === 0 ? colors.muted : colors.primary,
                    }}
                  >
                    ↑
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('moveDownNamed', { name: label(key) })}
                  disabled={index === value[section].length - 1}
                  style={s.action}
                  onPress={() => change(moveReaderMenuItem(value, key, 1))}
                >
                  <Text
                    style={{
                      color:
                        index === value[section].length - 1
                          ? colors.muted
                          : colors.primary,
                    }}
                  >
                    ↓
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('moveReaderMenuSectionNamed', {
                    name: label(key),
                  })}
                  style={s.move}
                  onPress={() =>
                    change(
                      setReaderMenuSection(
                        value,
                        key,
                        section === 'primary' ? 'more' : 'primary',
                      ),
                    )
                  }
                >
                  <Text style={{ color: colors.primary }}>
                    {section === 'primary'
                      ? t('readerMenuMore')
                      : t('readerMenuPrimary')}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </InTreeSheet>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800' },
  list: { paddingTop: 8, paddingBottom: 20 },
  section: { marginTop: 12, marginBottom: 4, fontWeight: '800' },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1, fontWeight: '600' },
  action: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  move: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
