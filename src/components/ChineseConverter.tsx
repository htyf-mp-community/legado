import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChineseConverterType } from '../core/chineseConversion';
import { useAppTheme } from '../theme/AppTheme';
import { InTreeSheet } from './InTreeSheet';

/** Native 简/繁 selector and the same three source modes, inside the mini-program root. */
export function ChineseConverter({
  value,
  change,
  label,
}: {
  value: ChineseConverterType;
  change: (value: ChineseConverterType) => void;
  label?: string;
}) {
  const { colors, t } = useAppTheme();
  const [open, setOpen] = useState(false);
  const modes: Array<[ChineseConverterType, string]> = [
    [0, t('chineseConversionOff')],
    [1, t('traditionalToSimplified')],
    [2, t('simplifiedToTraditional')],
  ];
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? t('chineseConverter')}
        accessibilityValue={{ text: modes[value][1] }}
        style={s.control}
        onPress={() => setOpen(true)}
      >
        {label ? (
          <Text style={{ color: colors.text }}>{label}</Text>
        ) : (
          <Text style={s.symbol}>
            <Text style={{ color: value === 1 ? colors.primary : colors.text }}>
              简
            </Text>
            <Text style={{ color: colors.muted }}>/</Text>
            <Text style={{ color: value === 2 ? colors.primary : colors.text }}>
              繁
            </Text>
          </Text>
        )}
      </Pressable>
      <InTreeSheet visible={open} onDismiss={() => setOpen(false)}>
        <Text
          accessibilityRole="header"
          style={[s.heading, { color: colors.text }]}
        >
          {t('chineseConverter')}
        </Text>
        {modes.map(([mode, name]) => (
          <Pressable
            key={mode}
            accessibilityRole="radio"
            accessibilityLabel={name}
            accessibilityState={{ selected: value === mode }}
            style={s.option}
            onPress={() => {
              change(mode);
              setOpen(false);
            }}
          >
            <Text style={{ color: colors.text, flex: 1 }}>{name}</Text>
            {value === mode ? (
              <Text style={{ color: colors.primary }}>✓</Text>
            ) : null}
          </Pressable>
        ))}
        <View style={s.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
            style={s.option}
            onPress={() => setOpen(false)}
          >
            <Text style={{ color: colors.primary }}>{t('cancel')}</Text>
          </Pressable>
        </View>
      </InTreeSheet>
    </>
  );
}
const s = StyleSheet.create({
  control: {
    minHeight: 44,
    minWidth: 64,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  symbol: { fontSize: 18 },
  heading: { fontSize: 18, fontWeight: '700', paddingVertical: 14 },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  footer: { alignItems: 'flex-end' },
});
