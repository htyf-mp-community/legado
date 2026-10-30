import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
const mockValues = new Map<string, string>();
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
}));
jest.mock('../src/components/PageHeader', () => ({ PageHeader: () => null }));
jest.mock('../src/components/InTreeSheet', () => ({
  InTreeSheet: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? <>{children}</> : null),
}));
jest.mock('../src/theme/AppTheme', () => ({
  useAppTheme: () => ({
    colors: {},
    t: (key: string, values?: { name?: string }) =>
      values?.name ? `${key}:${values.name}` : key,
  }),
}));
jest.mock('../src/hooks/useCapsule', () => ({
  useCapsule: () => ({
    header: { bottom: 60 },
    capsule: null,
    window: { width: 400, height: 800 },
    insets: { bottom: 20 },
  }),
}));
jest.mock('../src/components/SourceIcon', () => ({ SourceIcon: () => null }));
import { ReadRecords } from '../src/screens/ReadRecords';
import { loadReadRecords, saveReadRecords } from '../src/data/readRecords';

test('accessible per-record deletion confirms its target, can cancel and retains other records', async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mockValues.clear();
  const first = {
    bookId: 'first',
    bookName: 'First',
    author: 'A',
    readTime: 123,
    lastRead: 10,
  };
  const second = {
    bookId: 'second',
    bookName: 'Second',
    author: 'B',
    readTime: 456,
    lastRead: 20,
  };
  saveReadRecords([first, second]);
  const open = jest.fn();
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<ReadRecords back={jest.fn()} open={open} />);
  });
  const row = () =>
    tree.root.findByProps({ accessibilityLabel: 'openReadRecord:First' });
  const pressText = async (text: string) => {
    const node = tree.root
      .findAllByType(Text)
      .find(item => item.props.children === text);
    if (!node?.parent?.props.onPress) throw new Error(`No action for ${text}`);
    await act(async () => node.parent!.props.onPress());
  };
  expect(row().props.accessibilityActions).toContainEqual({
    name: 'delete',
    label: 'deleteNamed:First',
  });
  await act(async () =>
    row().props.onAccessibilityAction({
      nativeEvent: { actionName: 'delete' },
    }),
  );
  expect(
    tree.root
      .findAllByType(Text)
      .some(item => item.props.children === 'deleteReadRecordTitle:First'),
  ).toBe(true);
  expect(loadReadRecords()).toEqual([first, second]);
  await pressText('cancel');
  expect(loadReadRecords()).toEqual([first, second]);
  await act(async () =>
    row().props.onAccessibilityAction({
      nativeEvent: { actionName: 'delete' },
    }),
  );
  await pressText('delete');
  expect(loadReadRecords()).toEqual([second]);
  expect(open).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
