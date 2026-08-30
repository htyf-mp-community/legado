import type { ReactNode } from 'react';
import { useEffect } from 'react';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/AppTheme';

export function InTreeSheet({
  visible,
  onDismiss,
  children,
}: {
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const { colors, t } = useAppTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onDismiss();
        return true;
      },
    );
    return () => subscription.remove();
  }, [visible, onDismiss]);

  if (!visible) return null;
  return (
    <View accessibilityViewIsModal style={s.layer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('close')}
        style={s.backdrop}
        onPress={onDismiss}
      />
      <BottomSheet
        index={0}
        animateOnMount
        enableDynamicSizing
        enablePanDownToClose
        maxDynamicContentSize={Math.max(240, window.height * 0.82)}
        onClose={onDismiss}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.muted }}
        style={s.sheet}
      >
        <BottomSheetScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          contentContainerStyle={[
            s.content,
            { paddingBottom: Math.max(28, insets.bottom + 20) },
          ]}
        >
          {children}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,.42)',
  },
  sheet: {
    zIndex: 1,
    elevation: 21,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
});
