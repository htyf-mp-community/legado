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
jest.mock('../src/components/BookCover', () => ({ BookCover: () => null }));
jest.mock('../src/components/InTreeSheet', () => ({
  InTreeSheet: ({
    visible,
    children,
    onDismiss,
  }: {
    visible: boolean;
    children: unknown;
    onDismiss: () => void;
  }) =>
    visible
      ? require('react').createElement('Sheet', { onDismiss }, children)
      : null,
}));
jest.mock('../src/data/sources', () => ({
  loadSources: async () => [
    { bookSourceUrl: 'https://source.test', bookSourceType: 3 },
  ],
}));
jest.mock('../src/data/txtTocRules', () => ({ loadTxtTocRules: () => [] }));
jest.mock('../src/core/webBook', () => ({
  loadBookInfo: async (_source: unknown, book: object) => ({
    ...book,
    downloadUrls: ['https://source.test/book.zip'],
  }),
  loadChapters: jest.fn(),
}));
jest.mock('../src/core/webFileImport', () => ({
  prepareWebFile: jest.fn(),
  describeWebFiles: async (_source: unknown, _book: unknown, urls: string[]) =>
    urls.map(url => ({ url, name: 'book.zip' })),
}));
jest.mock('../src/theme/AppTheme', () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key;
  return { useAppTheme: () => ({ colors: {}, t }) };
});
import { OnlineBookDetail } from '../src/screens/OnlineBookDetail';
import { loadChapters } from '../src/core/webBook';
import { prepareWebFile } from '../src/core/webFileImport';
import type { SearchBook } from '../src/types';

test('file source skips chapters and imports only the selected ZIP entry', async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const files = [
    { name: 'one.txt', path: '/tmp/1', relative: 'one.txt' },
    { name: 'two.epub', path: '/tmp/2', relative: 'two.epub' },
  ];
  const importFile = jest.fn(async () => ({ id: 'chosen' })),
    dispose = jest.fn(async () => {}),
    added = jest.fn();
  jest
    .mocked(prepareWebFile)
    .mockResolvedValue({ files, importFile: importFile as never, dispose });
  const book: SearchBook = {
    name: '书',
    author: '',
    origin: 'https://source.test',
    originName: '源',
    bookUrl: 'https://source.test/book',
    sourceType: 3,
  };
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <OnlineBookDetail
        initialBook={book}
        back={jest.fn()}
        added={added}
        search={jest.fn()}
      />,
    );
  });
  expect(loadChapters).not.toHaveBeenCalled();
  const read = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'startReading');
  await act(async () => read!.parent!.props.onPress());
  const download = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'book.zip');
  expect(download).toBeDefined();
  await act(async () => download!.parent!.props.onPress());
  expect(importFile).not.toHaveBeenCalled();
  const chosen = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'two.epub');
  expect(chosen).toBeDefined();
  await act(async () => chosen!.parent!.props.onPress());
  expect(importFile).toHaveBeenCalledWith(files[1], []);
  expect(added).toHaveBeenCalledWith({ id: 'chosen' }, true);
  expect(dispose).toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('download failure remains on detail and can be retried without adding a book', async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  jest.mocked(prepareWebFile).mockRejectedValueOnce(new Error('HTTP 403'));
  const added = jest.fn();
  const book: SearchBook = {
    name: '书',
    author: '',
    origin: 'https://source.test',
    originName: '源',
    bookUrl: 'https://source.test/book',
    sourceType: 3,
  };
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <OnlineBookDetail
        initialBook={book}
        back={jest.fn()}
        added={added}
        search={jest.fn()}
      />,
    );
  });
  const shelf = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'webFileAddToShelf');
  await act(async () => shelf!.parent!.props.onPress());
  const download = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'book.zip');
  await act(async () => download!.parent!.props.onPress());
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'HTTP 403'),
  ).toBe(true);
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'webFileAddToShelf'),
  ).toBe(true);
  expect(added).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('adding a file to the shelf does not request immediate reading', async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const files = [{ name: 'one.txt', path: '/tmp/1', relative: 'one.txt' }];
  const dispose = jest.fn(async () => {}),
    added = jest.fn();
  jest.mocked(prepareWebFile).mockResolvedValueOnce({
    files,
    importFile: jest.fn(async () => ({ id: 'chosen' })) as never,
    dispose,
  });
  const book: SearchBook = {
    name: '书',
    author: '',
    origin: 'https://source.test',
    originName: '源',
    bookUrl: 'https://source.test/book',
    sourceType: 3,
  };
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <OnlineBookDetail
        initialBook={book}
        back={jest.fn()}
        added={added}
        search={jest.fn()}
      />,
    );
  });
  const shelf = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'webFileAddToShelf');
  await act(async () => shelf!.parent!.props.onPress());
  const choice = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'book.zip');
  await act(async () => choice!.parent!.props.onPress());
  expect(added).toHaveBeenCalledWith({ id: 'chosen' }, false);
  expect(dispose).toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('ZIP selection sheet stays open while downloading and shows entries when it completes', async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const files = [
    { name: 'one.txt', path: '/tmp/1', relative: 'one.txt' },
    { name: 'two.txt', path: '/tmp/2', relative: 'two.txt' },
  ];
  let resolve!: (value: Awaited<ReturnType<typeof prepareWebFile>>) => void;
  jest.mocked(prepareWebFile).mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    }),
  );
  const book: SearchBook = {
    name: '书',
    author: '',
    origin: 'https://source.test',
    originName: '源',
    bookUrl: 'https://source.test/book',
    sourceType: 3,
  };
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <OnlineBookDetail
        initialBook={book}
        back={jest.fn()}
        added={jest.fn()}
        search={jest.fn()}
      />,
    );
  });
  const read = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'startReading');
  await act(async () => read!.parent!.props.onPress());
  const choice = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'book.zip');
  await act(async () => {
    choice!.parent!.props.onPress();
  });
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'webFileDownloads'),
  ).toBe(true);
  await act(async () => {
    resolve({
      files,
      importFile: jest.fn() as never,
      dispose: jest.fn(async () => {}),
    });
  });
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'two.txt'),
  ).toBe(true);
  await act(async () => tree.unmount());
});

test('closing the chooser during download discards the result without importing or reopening', async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  let resolve!: (value: Awaited<ReturnType<typeof prepareWebFile>>) => void;
  jest.mocked(prepareWebFile).mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    }),
  );
  const added = jest.fn(),
    dispose = jest.fn(async () => {}),
    importFile = jest.fn();
  const book: SearchBook = {
    name: '书',
    author: '',
    origin: 'https://source.test',
    originName: '源',
    bookUrl: 'https://source.test/book',
    sourceType: 3,
  };
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <OnlineBookDetail
        initialBook={book}
        back={jest.fn()}
        added={added}
        search={jest.fn()}
      />,
    );
  });
  const read = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'startReading');
  await act(async () => read!.parent!.props.onPress());
  const choice = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'book.zip');
  await act(async () => {
    choice!.parent!.props.onPress();
  });
  await act(async () =>
    tree.root.findByType('Sheet' as never).props.onDismiss(),
  );
  await act(async () => {
    resolve({
      files: [{ name: 'one.txt', path: '/tmp/1', relative: 'one.txt' }],
      importFile,
      dispose,
    });
  });
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(importFile).not.toHaveBeenCalled();
  expect(added).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
  await act(async () => tree.unmount());
});
