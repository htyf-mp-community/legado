import React from 'react';
import { act, create } from 'react-test-renderer';
jest.mock('react-native', () => {
  const ReactRuntime = require('react');
  return { View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', Keyboard: { dismiss: jest.fn() }, StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    FlatList: ({ data, renderItem }: { data: unknown[]; renderItem: (input: { item: unknown; index: number }) => unknown }) => ReactRuntime.createElement('List', null, ...data.map((item, index) => renderItem({ item, index }))),
  };
});
jest.mock('../src/components/PageHeader', () => ({ PageHeader: ({ action, titleContent }: { action: React.ReactNode; titleContent: React.ReactNode }) => <>{titleContent}{action}</> }));
jest.mock('../src/components/InTreeSheet', () => ({ InTreeSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? <>{children}</> : null }));
jest.mock('../src/theme/AppTheme', () => ({ useAppTheme: () => ({ colors: { text: '#111', primary: '#444' }, t: (key: string) => key }) }));
jest.mock('../src/data/readerPreferences', () => ({ loadReaderPreferences: jest.fn(async () => ({ chineseConverterType: 0, adaptSpecialStyle: true, paragraphIndent: '　　' })) }));
jest.mock('../src/data/generalPreferences', () => ({ loadGeneralPreferences: () => ({ replaceEnableDefault: true }) }));
jest.mock('../src/data/replaceRules', () => ({ loadReplaceRules: () => [] }));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
jest.mock('../src/core/contentSearchProcessor', () => ({ runBookContentSearch: jest.fn() }));
jest.mock('../src/core/readerReplacement', () => ({ automaticBookReplacementEnabled: () => true }));
import { ContentSearch } from '../src/screens/ContentSearch';
import { runBookContentSearch } from '../src/core/contentSearchProcessor';
import type { Book } from '../src/types';

test('submits explicit queries, ignores stale search work, passes exact selection and process options', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const requests: Parameters<typeof runBookContentSearch>[0][] = [];
  jest.mocked(runBookContentSearch).mockImplementation(async request => { requests.push(request); });
  const book: Book = { id: 'b', name: 'B', author: '', intro: '', chapterTitle: 'T', content: 'body', progress: 0, updatedAt: 1 };
  const select = jest.fn(); let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(<ContentSearch book={book} select={select} back={jest.fn()} />); });
  const input = () => tree.root.findByProps({ accessibilityLabel: 'searchBody' });
  const submit = () => tree.root.findByProps({ accessibilityLabel: 'search' });
  await act(async () => input().props.onChangeText(' First ')); expect(requests).toHaveLength(0);
  await act(async () => submit().props.onPress()); expect(requests[0]).toMatchObject({ query: 'First', regex: false, replaceEnabled: false });
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'contentSearchOptions' }).props.onPress());
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'useRegex' }).props.onPress());
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'contentSearchReplace' }).props.onPress());
  expect(requests).toHaveLength(1);
  await act(async () => input().props.onChangeText('Second'));
  await act(async () => submit().props.onPress()); expect(requests[0].signal.aborted).toBe(true); expect(requests[1]).toMatchObject({ query: 'Second', regex: true, replaceEnabled: true });
  const item = { chapterIndex: 2, chapterId: 'c', chapterTitle: 'T', start: 8, end: 14, excerpt: 'Second', match: 'Second', ordinal: 1, queryIndexInResult: 0, query: 'Second', regex: true };
  await act(async () => requests[0].onChapter([{ ...item, chapterTitle: 'stale' }], 0));
  expect(tree.root.findAllByProps({ accessibilityLabel: 'stale: Second' })).toHaveLength(0);
  await act(async () => requests[1].onChapter([item], 2));
  await act(async () => input().props.onChangeText('Unsubmitted edit'));
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'T: Second' }).props.onPress());
  expect(select).toHaveBeenCalledWith({ query: 'Second', regex: true, results: [item], selected: 0 });
  await act(async () => tree.unmount()); expect(requests[1].signal.aborted).toBe(true);
});
