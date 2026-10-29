import React from 'react';
import { act, create } from 'react-test-renderer';
const mockNative = { visible: false };
jest.mock('react-native', () => ({
  View: 'View',
  BackHandler: { addEventListener: () => ({ remove: () => undefined }) },
  StyleSheet: { create: (v: unknown) => v, absoluteFill: {} },
  useWindowDimensions: () => ({ width: 402, height: 874 }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../src/theme/AppTheme', () => ({
  useAppTheme: () => ({
    colors: { surface: '#fff', muted: '#aaa' },
    t: (v: string) => v,
  }),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const R = require('react');
  return {
    BottomSheetBackdrop: 'Backdrop',
    BottomSheetScrollView: 'Scroll',
    BottomSheetModal: R.forwardRef(
      (props: Record<string, any>, ref: unknown) => {
        R.useImperativeHandle(ref, () => ({
          present: () =>
            setTimeout(() => {
              mockNative.visible = true;
              props.onChange?.(0);
            }, 30),
          dismiss: () => {
            if (mockNative.visible) {
              mockNative.visible = false;
              props.onDismiss?.();
            }
          },
        }));
        return null;
      },
    ),
  };
});
import { InTreeSheet } from '../src/components/InTreeSheet';
test('a delayed native presentation cannot reopen a sheet that was closed while mounting', () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  mockNative.visible = false;
  const cancel = jest.fn();
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <InTreeSheet visible onDismiss={cancel}>
        loading
      </InTreeSheet>,
    );
  });
  act(() =>
    tree.update(
      <InTreeSheet visible={false} onDismiss={cancel}>
        loading
      </InTreeSheet>,
    ),
  );
  act(() => jest.runOnlyPendingTimers());
  expect(mockNative.visible).toBe(false);
  expect(cancel).not.toHaveBeenCalled();
  act(() => tree.unmount());
  jest.useRealTimers();
});
