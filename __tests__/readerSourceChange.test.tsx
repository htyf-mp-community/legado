import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useReaderSourceChange } from '../src/hooks/useReaderSourceChange';
import type { Book } from '../src/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const book: Book = {
  id: 'book', name: '书', author: '', intro: '', chapterTitle: '第二章', content: '',
  progress: 0, updatedAt: 1, currentChapterIndex: 1, origin: 'old', bookUrl: 'old/book',
};
function Chapter({ index }: { index: number }) {
  return React.createElement('chapter', null, String(index));
}
function ReaderHarness({ value }: { value: Book }) {
  const [index, setIndex] = useState(value.currentChapterIndex ?? 0);
  useReaderSourceChange(value, setIndex);
  return <Chapter index={index} />;
}
let tree: ReactTestRenderer;
afterEach(() => { act(() => tree?.unmount()); });

test('changes the reader index when a source switch moves the matched chapter', () => {
  act(() => { tree = create(<ReaderHarness value={book} />); });
  expect(tree.root.findByType(Chapter).props.index).toBe(1);
  act(() => { tree.update(<ReaderHarness value={{ ...book, origin: 'new', bookUrl: 'new/book', currentChapterIndex: 3 }} />); });
  expect(tree.root.findByType(Chapter).props.index).toBe(3);
});

test('does not overwrite the live reader index on ordinary book updates', () => {
  act(() => { tree = create(<ReaderHarness value={book} />); });
  act(() => { tree.update(<ReaderHarness value={{ ...book, currentChapterIndex: 3, updatedAt: 2 }} />); });
  expect(tree.root.findByType(Chapter).props.index).toBe(1);
});
