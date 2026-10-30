import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
const mockValues = new Map<string, string>();
const mockBack = jest.fn((..._args: unknown[]) => ({ remove: jest.fn() }));
jest.mock('../src/data/storage', () => ({
  appStorage: {
    getString: (key: string) => mockValues.get(key),
    set: (key: string, value: string) => mockValues.set(key, value),
  },
}));
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  FlatList: ({
    data,
    renderItem,
  }: {
    data: unknown[];
    renderItem: (item: { item: unknown }) => React.ReactNode;
  }) => data.map(item => renderItem({ item })),
  StyleSheet: { create: (value: unknown) => value },
  BackHandler: { addEventListener: (...args: unknown[]) => mockBack(...args) },
  Keyboard: { dismiss: jest.fn() },
}));
jest.mock('../src/components/PageHeader', () => ({
  PageHeader: ({ action }: { action: React.ReactNode }) => <>{action}</>,
}));
jest.mock('../src/components/InTreeSheet', () => ({
  InTreeSheet: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? <>{children}</> : null),
}));
jest.mock('../src/components/SourceIcon', () => ({ SourceIcon: () => null }));
jest.mock('../src/hooks/useCapsule', () => ({
  useCapsule: () => ({
    header: { bottom: 60 },
    capsule: null,
    window: { width: 400, height: 800 },
    insets: { bottom: 20 },
  }),
}));
jest.mock('../src/theme/AppTheme', () => ({
  useAppTheme: () => ({
    colors: {},
    t: (key: string, values?: { name?: string; author?: string }) =>
      values ? `${key}:${values.name ?? values.author}` : key,
  }),
}));
import { ReadRecords } from '../src/screens/ReadRecords';
import {
  loadReadRecords,
  loadReadRecordSort,
  readRecordEnabled,
  recordReadTime,
  saveReadRecords,
} from '../src/data/readRecords';
import type { Book } from '../src/types';

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mockValues.clear();
  mockBack.mockClear();
});
test('group author search, persisted sort, native refresh quirks and confirmed name deletion stay connected', async () => {
  saveReadRecords([
    {
      deviceId: 'a',
      bookName: 'Same',
      author: '甲',
      readTime: 1000,
      lastRead: 0,
    },
    {
      deviceId: 'b',
      bookName: 'Same',
      author: '乙',
      readTime: 2000,
      lastRead: 10,
    },
    {
      deviceId: 'c',
      bookName: 'Other',
      author: '',
      readTime: 4000,
      lastRead: 0,
    },
  ]);
  const open = jest.fn();
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<ReadRecords back={jest.fn()} open={open} />);
  });
  const rows = () =>
    tree.root.findAll(item =>
      String(item.props.accessibilityLabel ?? '').startsWith('openReadRecord:'),
    );
  const texts = () =>
    tree.root.findAllByType(Text).map(item => item.props.children);
  const press = async (label: string) => {
    await act(async () =>
      tree.root.findByProps({ accessibilityLabel: label }).props.onPress(),
    );
  };
  const textPress = async (text: string) => {
    const node = tree.root
      .findAllByType(Text)
      .find(item => item.props.children === text);
    if (!node?.parent?.props.onPress) throw Error(text);
    await act(async () => node.parent!.props.onPress());
  };
  const input = () =>
    tree.root.findByProps({ accessibilityLabel: 'searchReadRecords' });
  expect(rows()).toHaveLength(2);
  expect(texts()).toContain('7秒');
  expect(texts()).toContain('readRecordAuthor:乙、甲');
  await act(async () => input().props.onChangeText('乙'));
  expect(rows()).toHaveLength(1);
  expect(texts()).toContain('3秒');
  await press('sort');
  await press('readRecordSortDuration');
  expect(loadReadRecordSort()).toBe('duration');
  expect(input().props.value).toBe('乙');
  expect(rows()).toHaveLength(2);
  const row = tree.root.findByProps({
    accessibilityLabel: 'openReadRecord:Same',
  });
  await act(async () =>
    row.props.onAccessibilityAction({ nativeEvent: { actionName: 'delete' } }),
  );
  await textPress('cancel');
  expect(loadReadRecords()).toHaveLength(3);
  await act(async () =>
    row.props.onAccessibilityAction({ nativeEvent: { actionName: 'delete' } }),
  );
  await textPress('delete');
  expect(loadReadRecords().map(item => item.bookName)).toEqual(['Other']);
  expect(rows()).toHaveLength(1);
  expect(texts()).toContain('7秒');
  expect(open).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
  await act(async () => {
    tree = create(<ReadRecords back={jest.fn()} open={open} />);
  });
  expect(texts()).toContain('4秒');
  expect(texts()).not.toContain('7秒');
  await press('sort');
  expect(
    tree.root.findByProps({ accessibilityLabel: 'readRecordSortDuration' })
      .props.accessibilityState.checked,
  ).toBe(true);
  await act(async () => tree.unmount());
});
test('recording menu persists across recreation and actually prevents new read-time writes', async () => {
  let tree!: ReturnType<typeof create>;
  const mount = async () => {
    await act(async () => {
      tree = create(<ReadRecords back={jest.fn()} open={jest.fn()} />);
    });
  };
  const press = async (label: string) => {
    await act(async () =>
      tree.root.findByProps({ accessibilityLabel: label }).props.onPress(),
    );
  };
  await mount();
  await press('moreSourceActions');
  expect(
    tree.root.findByProps({ accessibilityLabel: 'enableReadRecord' }).props
      .accessibilityState.checked,
  ).toBe(true);
  await press('enableReadRecord');
  expect(readRecordEnabled()).toBe(false);
  recordReadTime({ id: 'new', name: 'New', author: '' } as Book, 3000, 10);
  expect(loadReadRecords()).toEqual([]);
  await act(async () => tree.unmount());
  await mount();
  await press('moreSourceActions');
  expect(
    tree.root.findByProps({ accessibilityLabel: 'enableReadRecord' }).props
      .accessibilityState.checked,
  ).toBe(false);
  await press('enableReadRecord');
  recordReadTime({ id: 'new', name: 'New', author: '' } as Book, 3000, 10);
  expect(loadReadRecords()[0].readTime).toBe(3000);
  await act(async () => tree.unmount());
});
