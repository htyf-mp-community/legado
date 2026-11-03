import React from 'react';
import {act, create} from 'react-test-renderer';

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable',
  ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: {create: (value: unknown) => value, hairlineWidth: 1},
}));
jest.mock('../src/components/PageHeader', () => ({PageHeader: 'PageHeader'}));
const t = (key: string) => key;
jest.mock('../src/theme/AppTheme', () => ({useAppTheme: () => ({colors: {}, t})}));
jest.mock('../src/data/sources', () => ({loadSources: jest.fn()}));
jest.mock('../src/core/sourceDebug', () => ({
  runSourceDebug: jest.fn(),
  SourceDebugPipelineError: class extends Error {},
}));
import {SourceDebug} from '../src/screens/SourceDebug';
import {loadSources} from '../src/data/sources';
import {runSourceDebug, type SourceDebugEvent} from '../src/core/sourceDebug';
import type {BookSource} from '../src/types';

const sources = ['a', 'b'].map(bookSourceUrl => ({bookSourceUrl, bookSourceName: bookSourceUrl}) as BookSource);
beforeEach(() => {
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
  jest.mocked(loadSources).mockResolvedValue(sources);
});
afterEach(() => jest.clearAllMocks());

test('changing sources cancels the previous run and ignores its late events and failure', async () => {
  let rejectOld!: (error: Error) => void;
  let oldEvent!: (event: SourceDebugEvent) => void;
  let oldSignal!: AbortSignal;
  let finishNew!: () => void;
  jest.mocked(runSourceDebug).mockImplementation((source, _key, emit, _format, options) => {
    if (source.bookSourceUrl === 'a') {
      oldEvent = emit!; oldSignal = options!.signal!;
      return new Promise((_resolve, reject) => {rejectOld = reject;});
    }
    return new Promise(resolve => {finishNew = () => resolve({} as never);});
  });
  let tree!: ReturnType<typeof create>;
  await act(async () => {tree = create(<SourceDebug sourceUrl="a" back={jest.fn()}/>);});
  await act(async () => tree.root.findByProps({accessibilityLabel: 'debugKeyword'}).props.onChangeText('书'));
  await act(async () => tree.root.findByProps({accessibilityLabel: 'startSourceDebug'}).props.onPress());
  expect(oldSignal.aborted).toBe(false);
  await act(async () => tree.update(<SourceDebug sourceUrl="b" back={jest.fn()}/>));
  expect(oldSignal.aborted).toBe(true);
  await act(async () => tree.root.findByProps({accessibilityLabel: 'startSourceDebug'}).props.onPress());
  expect(runSourceDebug).toHaveBeenCalledTimes(2);
  await act(async () => {
    oldEvent({stage: 'search', status: 'success', message: 'stale result'});
    rejectOld(new Error('stale failure'));
  });
  expect(tree.root.findAllByProps({children: 'stale result'})).toHaveLength(0);
  expect(tree.root.findAllByProps({children: 'stale failure'})).toHaveLength(0);
  expect(tree.root.findByProps({accessibilityLabel: 'startSourceDebug'}).props.disabled).toBe(true);
  await act(async () => finishNew());
  expect(tree.root.findByProps({accessibilityLabel: 'startSourceDebug'}).props.disabled).toBe(false);
  await act(async () => tree.unmount());
});

test('unmount cancels an in-flight run and repeated presses do not launch a second run', async () => {
  let signal!: AbortSignal;
  jest.mocked(runSourceDebug).mockImplementation((_source, _key, _emit, _format, options) => {
    signal = options!.signal!;
    return new Promise(() => {});
  });
  let tree!: ReturnType<typeof create>;
  await act(async () => {tree = create(<SourceDebug sourceUrl="a" back={jest.fn()}/>);});
  await act(async () => tree.root.findByProps({accessibilityLabel: 'debugKeyword'}).props.onChangeText('书'));
  await act(async () => {
    const press = tree.root.findByProps({accessibilityLabel: 'startSourceDebug'}).props.onPress;
    press(); press();
  });
  expect(runSourceDebug).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  expect(signal.aborted).toBe(true);
});
