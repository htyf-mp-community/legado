import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (x: unknown) => x, hairlineWidth: 1 },
}));
jest.mock('../src/components/PageHeader', () => ({ PageHeader: () => null }));
jest.mock('../src/components/BookCover', () => ({ BookCover: 'BookCover' }));
jest.mock('../src/components/InTreeSheet', () => ({ InTreeSheet: () => null }));
jest.mock('../src/core/webFileImport', () => ({ prepareWebFile: jest.fn() }));
jest.mock('../src/data/txtTocRules', () => ({ loadTxtTocRules: () => [] }));
jest.mock('../src/data/sources', () => ({
  loadSources: async () => [{ bookSourceUrl: 'https://example.test' }],
}));
jest.mock('../src/core/webBook', () => ({
  loadBookInfo: async (_source: unknown, book: object) => ({
    ...book,
    kind: '小说,经典',
    wordCount: '1.2万字',
    latestChapterTitle: '最后一章',
    coverUrl: 'https://example.test/cover',
  }),
  loadChapters: async () => [
    {
      index: 0,
      title: '第一章',
      url: 'https://example.test/1',
      baseUrl: 'https://example.test',
      bookUrl: 'https://example.test/book',
      isVolume: false,
      isVip: false,
      isPay: false,
    },
  ],
}));
jest.mock('../src/theme/AppTheme', () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key;
  return { useAppTheme: () => ({ colors: {}, t }) };
});
import { OnlineBookDetail } from '../src/screens/OnlineBookDetail';
import type { SearchBook } from '../src/types';

test('online detail shows source metadata, searches labels and keeps metadata when added', async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const book: SearchBook = {
    name: '示例书',
    author: '作者',
    origin: 'https://example.test',
    originName: '示例源',
    bookUrl: 'https://example.test/book',
    sourceType: 0,
  };
  const search = jest.fn(),
    added = jest.fn();
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <OnlineBookDetail
        initialBook={book}
        back={jest.fn()}
        added={added}
        search={search}
      />,
    );
  });
  const labels = tree.root.findAll(node =>
    String(node.props.accessibilityLabel ?? '').startsWith(
      'onlineSearchLabel:',
    ),
  );
  expect(labels.map(node => node.props.accessibilityLabel)).toEqual([
    'onlineSearchLabel:1.2万字',
    'onlineSearchLabel:小说',
    'onlineSearchLabel:经典',
  ]);
  await act(async () => labels[1].props.onPress());
  expect(search).toHaveBeenCalledWith('https://example.test', '小说');
  expect(tree.root.findByType('BookCover' as never).props.book).toEqual({
    origin: 'https://example.test',
    coverUrl: 'https://example.test/cover',
  });
  const button = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'addAndRead');
  expect(button).toBeDefined();
  await act(async () => button!.parent!.props.onPress());
  expect(added).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: '小说,经典',
      wordCount: '1.2万字',
      latestChapterTitle: '最后一章',
      nativeType: 8,
    }),
    true,
  );
  await act(async () => tree.unmount());
});
