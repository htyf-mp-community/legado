import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
  BackHandler,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/AppTheme';

function SheetLayer({ children }: { children?: ReactNode }) {
  return (
    <View accessibilityViewIsModal pointerEvents="box-none" style={s.layer}>
      {children}
    </View>
  );
}

/** Gorhom's app-owned host covers page chrome while remaining inside this mini-program's React root. */
export function InTreeSheet({
  visible,
  onDismiss,
  children,
  enableContentPanningGesture = true,
}: {
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
  enableContentPanningGesture?: boolean;
}) {
  const { colors, t } = useAppTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const sheet = useRef<BottomSheetModal>(null);
  const wanted = useRef(visible);
  const presented = useRef(false);
  const dismiss = useRef(onDismiss);
  wanted.current = visible;
  dismiss.current = onDismiss;
  useEffect(() => {
    if (visible) {
      presented.current = true;
      sheet.current?.present();
    } else if (presented.current) {
      // Dismissing a never-presented Gorhom modal leaves it in DISMISSING and prevents its first render.
      presented.current = false;
      sheet.current?.dismiss();
    }
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss.current();
      return true;
    });
    return () => listener.remove();
  }, [visible]);
  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.42}
        accessibilityRole="button"
        accessibilityLabel={t('close')}
        accessibilityHint={t('close')}
      />
    ),
    [t],
  );
  return (
    <BottomSheetModal
      ref={sheet}
      accessible={false}
      accessibilityRole="none"
      containerComponent={SheetLayer}
      index={0}
      stackBehavior="push"
      enableDynamicSizing
      enablePanDownToClose
      enableContentPanningGesture={enableContentPanningGesture}
      maxDynamicContentSize={Math.max(240, window.height * 0.82)}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      backdropComponent={backdrop}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.muted }}
      onChange={index => {
        // present() mounts its portal asynchronously. A fast completion may dismiss before the inner sheet exists.
        if (index >= 0 && !wanted.current) {
          sheet.current?.dismiss();
        }
      }}
      onDismiss={() => {
        presented.current = false;
        if (wanted.current) dismiss.current();
      }}
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
    </BottomSheetModal>
  );
}
const s = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 100, elevation: 100 },
  content: { paddingHorizontal: 20, paddingTop: 4 },
});
