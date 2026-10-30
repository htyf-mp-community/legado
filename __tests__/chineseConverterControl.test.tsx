import React from 'react';
import { Pressable } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ChineseConverter } from '../src/components/ChineseConverter';

jest.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: (value: unknown) => value } }));
jest.mock('../src/theme/AppTheme', () => ({ useAppTheme: () => ({ colors: { text: '#000000', primary: '#007aff', muted: '#888888' }, t: (key: string) => key }) }));
jest.mock('../src/components/InTreeSheet', () => ({ InTreeSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? require('react').createElement(require('react-native').View, null, children) : null }));

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
let tree: ReactTestRenderer | undefined;
afterEach(() => { act(() => tree?.unmount()); tree = undefined; });

test('shows the persisted native choice, changes one mode, and closes the choice sheet', () => {
  const change = jest.fn();
  act(() => { tree = create(<ChineseConverter value={2} change={change} />); });
  const button = (label: string) => tree!.root.findAllByType(Pressable).find(node => node.props.accessibilityLabel === label)!;
  expect(button('chineseConverter').props.accessibilityValue.text).toBe('simplifiedToTraditional');
  act(() => button('chineseConverter').props.onPress());
  expect(button('simplifiedToTraditional').props.accessibilityState.selected).toBe(true);
  act(() => button('traditionalToSimplified').props.onPress());
  expect(change).toHaveBeenCalledWith(1);
  expect(button('traditionalToSimplified')).toBeUndefined();
});

test('cancel leaves the selected conversion mode unchanged', () => {
  const change = jest.fn();
  act(() => { tree = create(<ChineseConverter value={0} change={change} />); });
  const button = (label: string) => tree!.root.findAllByType(Pressable).find(node => node.props.accessibilityLabel === label)!;
  act(() => button('chineseConverter').props.onPress());
  act(() => button('cancel').props.onPress());
  expect(change).not.toHaveBeenCalled();
  expect(button('traditionalToSimplified')).toBeUndefined();
});
