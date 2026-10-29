import React from 'react';
import { act, create } from 'react-test-renderer';
jest.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
jest.mock('@react-native-community/slider', () => ({
  __esModule: true,
  default: 'NativeSlider',
}));
import { ReaderProgressSlider } from '../src/components/ReaderProgressSlider';
test('accessible page increments and touch completion share the seek boundary', () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const seek = jest.fn();
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <ReaderProgressSlider
        value={9}
        max={29}
        step={1}
        label="页码"
        disabled={false}
        onSeek={seek}
        minimumTrackTintColor="#000"
        maximumTrackTintColor="#888"
      />,
    );
  });
  const control = tree.root.findByType('View' as never);
  expect(control.props.accessibilityValue).toEqual({ min: 0, max: 29, now: 9 });
  act(() =>
    control.props.onAccessibilityAction({
      nativeEvent: { actionName: 'increment' },
    }),
  );
  expect(seek).toHaveBeenLastCalledWith(10);
  act(() =>
    control.props.onAccessibilityAction({
      nativeEvent: { actionName: 'decrement' },
    }),
  );
  expect(seek).toHaveBeenLastCalledWith(8);
  const slider = tree.root.findByType('NativeSlider' as never);
  act(() => slider.props.onSlidingComplete(15));
  expect(seek).toHaveBeenLastCalledWith(15);
  expect(slider.props.accessible).toBe(false);
  act(() => tree.unmount());
});
test('disabled progress cannot change through a screen-reader action', () => {
  const seek = jest.fn();
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <ReaderProgressSlider
        value={2}
        max={4}
        step={2}
        label="页码"
        disabled
        onSeek={seek}
        minimumTrackTintColor="#000"
        maximumTrackTintColor="#888"
      />,
    );
  });
  act(() =>
    tree.root.findByType('View' as never).props.onAccessibilityAction({
      nativeEvent: { actionName: 'increment' },
    }),
  );
  expect(seek).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
