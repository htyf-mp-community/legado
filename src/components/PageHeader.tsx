import type { ReactNode } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useCapsule } from '../hooks/useCapsule';
import { rightBoundaryForElement } from '../layout/capsule';
import { useAppTheme } from '../theme/AppTheme';

export function PageHeader({
  title,
  onBack,
  action,
  sourceTone = false,
  titleContent,
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
  sourceTone?: boolean;
  titleContent?: ReactNode;
}) {
  const { capsule, header, window } = useCapsule(),
    { colors, t, preferences, dark } = useAppTheme(),
    top = header.bottom - 52,
    right = rightBoundaryForElement(
      { top, bottom: header.bottom },
      capsule,
      window.width - 12,
    ),
    elevation = preferences.themeMode === 'eink' ? 0 : preferences.barElevation,
    foreground = sourceTone ? colors.toolbarText : colors.text;
  return (
    <View
      style={[
        s.header,
        {
          paddingTop: header.top,
          height: header.bottom,
          backgroundColor: sourceTone
            ? colors.toolbarBackground
            : colors.surface,
          elevation,
          shadowOpacity: elevation ? 0.22 : 0,
          shadowRadius: elevation / 2,
          shadowOffset: { width: 0, height: Math.max(1, elevation / 4) },
          shadowColor: '#000',
          zIndex: elevation ? 2 : 0,
        },
      ]}
    >
      <StatusBar
        barStyle={
          sourceTone
            ? foreground === '#FFFFFF'
              ? 'light-content'
              : 'dark-content'
            : dark
              ? 'light-content'
              : 'dark-content'
        }
      />
      <View style={[s.row, { width: Math.max(0, right) }]}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            style={s.touch}
            onPress={onBack}
          >
            <Text style={[s.back, { color: foreground }]}>‹</Text>
          </Pressable>
        ) : null}
        {titleContent ? (
          <View style={{ flex: 1, minWidth: 0 }}>{titleContent}</View>
        ) : (
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[
              s.title,
              sourceTone && s.sourceTitle,
              { color: foreground },
            ]}
          >
            {title}
          </Text>
        )}
        {action ? <View style={s.touch}>{action}</View> : null}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  header: {},
  row: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { fontSize: 38, lineHeight: 40 },
  title: { flex: 1, fontWeight: '700', fontSize: 20, marginHorizontal: 4 },
  sourceTitle: { fontWeight: '500', marginHorizontal: 8 },
});
