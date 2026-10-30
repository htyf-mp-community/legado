beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
import React, { createRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  ReaderPositionBridge,
  type ReaderPositionHandle,
  type ReaderPositionProps,
} from '../src/components/ReaderPositionBridge';
import { applyBookUpdate } from '../src/core/bookUpdate';
import type { Book } from '../src/types';
const book: Book = {
  id: 'b',
  name: 'B',
  author: 'A',
  intro: '',
  chapterTitle: 'T',
  content: '',
  progress: 0.3,
  updatedAt: 1,
  readingPosition: { chapterId: 'c', position: 9 },
};
const base = (
  overrides: Partial<ReaderPositionProps> = {},
): ReaderPositionProps => ({
  book,
  chapterId: 'c',
  title: 'T',
  text: 'abcdefghij',
  indent: '',
  mode: 'page',
  pageIndex: 0,
  columns: 1,
  ranges: [
    { text: 'abcd', start: 0, end: 4 },
    { text: 'efgh', start: 4, end: 8 },
    { text: 'ij', start: 8, end: 10 },
  ],
  layoutKey: 'layout',
  contentTop: 10,
  setPageIndex: jest.fn(),
  scrollTo: jest.fn(),
  commit: jest.fn(),
  ...overrides,
});
let tree: ReactTestRenderer | undefined;
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  jest.useRealTimers();
});
test('restores the page containing the native UTF-16 cursor without writing an initial page-zero record', () => {
  const props = base();
  act(() => {
    tree = create(<ReaderPositionBridge {...props} />);
  });
  expect(props.setPageIndex).toHaveBeenCalledWith(1);
  expect(props.commit).not.toHaveBeenCalled();
  act(() => tree!.update(<ReaderPositionBridge {...props} pageIndex={1} />));
  act(() => jest.runOnlyPendingTimers());
  expect(props.commit).not.toHaveBeenCalled();
  act(() => tree!.update(<ReaderPositionBridge {...props} pageIndex={2} />));
  act(() => jest.runOnlyPendingTimers());
  expect(props.commit).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'b',
      readingPosition: { chapterId: 'c', position: 10, titleVisible: true },
      progress: 0.3,
    }),
  );
});
test('reflows from the character anchor rather than multiplying by an estimated capacity', () => {
  const props = base();
  act(() => {
    tree = create(<ReaderPositionBridge {...props} />);
  });
  const setPageIndex = jest.fn();
  act(() =>
    tree!.update(
      <ReaderPositionBridge
        {...props}
        pageIndex={1}
        layoutKey="large-font"
        ranges={[
          { text: 'abc', start: 0, end: 3 },
          { text: 'def', start: 3, end: 6 },
          { text: 'ghi', start: 6, end: 9 },
          { text: 'j', start: 9, end: 10 },
        ]}
        setPageIndex={setPageIndex}
      />,
    ),
  );
  expect(setPageIndex).toHaveBeenCalledWith(2);
  expect(props.commit).not.toHaveBeenCalled();
});
test.each(['\n', '\n\n'])('scroll restore uses measured paragraph lines across %j separators', separator => {
  const ref = createRef<ReaderPositionHandle>(),
    props = base({
      mode: 'scroll',
      text: `abcdef${separator}ghijkl`,
      book: { ...book, readingPosition: { chapterId: 'c', position: 12 } },
    });
  act(() => {
    tree = create(<ReaderPositionBridge ref={ref} {...props} />);
  });
  act(() => {
    ref.current!.onExtent(1000);
    ref.current!.onViewport(500);
    ref.current!.onScroll(0);
  });
  expect(props.commit).not.toHaveBeenCalled();
  expect(props.scrollTo).not.toHaveBeenCalled();
  act(() => {
    ref.current!.onParagraphLayout(1, 100);
    ref.current!.onTextLayout(1, [
      { text: 'ghi', y: 0, height: 20 },
      { text: 'jkl', y: 20, height: 20 },
    ]);
  });
  expect(props.scrollTo).toHaveBeenCalledWith(110);
  act(() => ref.current!.onScroll(110));
  act(() => jest.runOnlyPendingTimers());
  expect(props.commit).not.toHaveBeenCalled();
  act(() => {
    ref.current!.onScrollBeginDrag();
    ref.current!.onScroll(90);
  });
  act(() => jest.runOnlyPendingTimers());
  expect(props.commit).toHaveBeenCalledWith(
    expect.objectContaining({
      readingPosition: { chapterId: 'c', position: 9, titleVisible: true },
    }),
  );
});
test('unmount flushes a pending cursor to the original book and chapter', () => {
  const ref = createRef<ReaderPositionHandle>(),
    props = base({
      mode: 'scroll',
      text: 'abcdef',
      book: { ...book, readingPosition: undefined },
    });
  act(() => {
    tree = create(<ReaderPositionBridge key="old" ref={ref} {...props} />);
  });
  act(() => {
    ref.current!.onExtent(1000);
    ref.current!.onViewport(500);
    ref.current!.onParagraphLayout(0, 10);
    ref.current!.onTextLayout(0, [
      { text: 'abc', y: 0, height: 20 },
      { text: 'def', y: 20, height: 20 },
    ]);
    ref.current!.onScroll(0);
    ref.current!.onScrollBeginDrag();
    ref.current!.onScroll(20);
  });
  act(() =>
    tree!.update(
      <ReaderPositionBridge
        key="new"
        {...base({ book: { ...book, id: 'new' }, chapterId: 'new-c' })}
      />,
    ),
  );
  expect(props.commit).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'b',
      readingPosition: { chapterId: 'c', position: 5, titleVisible: true },
    }),
  );
});

test('an explicitly applied remote cursor in the same chapter navigates once without echoing a write', () => {
  const props = base();
  act(() => {
    tree = create(<ReaderPositionBridge {...props} />);
  });
  act(() => tree!.update(<ReaderPositionBridge {...props} pageIndex={1} />));
  const setPageIndex = jest.fn();
  act(() =>
    tree!.update(
      <ReaderPositionBridge
        {...props}
        pageIndex={1}
        book={{ ...book, readingPosition: { chapterId: 'c', position: 3 } }}
        setPageIndex={setPageIndex}
      />,
    ),
  );
  expect(setPageIndex).toHaveBeenCalledWith(0);
  expect(props.commit).not.toHaveBeenCalled();
});

test('reflow within the same page still allows the next user page to be saved', () => {
  const props = base({
    book: { ...book, readingPosition: { chapterId: 'c', position: 3 } },
  });
  act(() => {
    tree = create(<ReaderPositionBridge {...props} />);
  });
  act(() =>
    tree!.update(
      <ReaderPositionBridge {...props} layoutKey="same-page-reflow" />,
    ),
  );
  act(() =>
    tree!.update(
      <ReaderPositionBridge
        {...props}
        layoutKey="same-page-reflow"
        pageIndex={1}
      />,
    ),
  );
  act(() => jest.runOnlyPendingTimers());
  expect(props.commit).toHaveBeenCalledWith(
    expect.objectContaining({
      readingPosition: { chapterId: 'c', position: 6, titleVisible: true },
    }),
  );
});

test('same-book unmount after a chapter command cannot flush the old cursor over the destination', () => {
  const initial = {
    ...book,
    currentChapterIndex: 0,
    chapters: [
      { id: 'c', title: 'T', content: 'abcdefghij' },
      { id: 'd', title: 'D', content: 'destination' },
    ],
  };
  let current: Book = initial;
  const props = base({
    book: initial,
    commit: next => {
      current = applyBookUpdate(current, initial, next);
    },
  });
  act(() => {
    tree = create(<ReaderPositionBridge key="c" {...props} />);
  });
  act(() =>
    tree!.update(<ReaderPositionBridge key="c" {...props} pageIndex={1} />),
  );
  act(() =>
    tree!.update(<ReaderPositionBridge key="c" {...props} pageIndex={2} />),
  );
  current = applyBookUpdate(current, initial, {
    ...initial,
    currentChapterIndex: 1,
    readingPosition: { chapterId: 'd', position: 420 },
  });
  act(() =>
    tree!.update(
      <ReaderPositionBridge
        key="d"
        {...base({ book: current, chapterId: 'd' })}
      />,
    ),
  );
  expect(current.currentChapterIndex).toBe(1);
  expect(current.readingPosition).toEqual({ chapterId: 'd', position: 420 });
});

test('applying an identical remote cursor keeps the restored nonzero page and writes nothing', () => {
  const props = base();
  act(() => {
    tree = create(<ReaderPositionBridge {...props} />);
  });
  act(() => tree!.update(<ReaderPositionBridge {...props} pageIndex={1} />));
  const navigate = jest.fn();
  act(() =>
    tree!.update(
      <ReaderPositionBridge
        {...props}
        pageIndex={1}
        book={{ ...book, readingPosition: { ...book.readingPosition! } }}
        setPageIndex={navigate}
      />,
    ),
  );
  act(() => jest.runOnlyPendingTimers());
  expect(navigate).not.toHaveBeenCalled();
  expect(props.commit).not.toHaveBeenCalled();
});

test('scroll restore reports the matching page and an accessible page seek uses the measured native lines', () => {
  const ref = createRef<ReaderPositionHandle>(),
    props = base({ mode: 'scroll', contentTop: 0 });
  act(() => {
    tree = create(<ReaderPositionBridge {...props} ref={ref} />);
  });
  expect(props.setPageIndex).toHaveBeenLastCalledWith(1);
  act(() => {
    ref.current!.onExtent(1000);
    ref.current!.onViewport(100);
    ref.current!.onParagraphLayout(0, 0);
    ref.current!.onTextLayout(0, [
      { text: 'abcd', y: 0, height: 20 },
      { text: 'efgh', y: 20, height: 20 },
      { text: 'ij', y: 40, height: 20 },
    ]);
  });
  expect(props.scrollTo).toHaveBeenLastCalledWith(20);
  act(() => ref.current!.onScroll(20));
  act(() => ref.current!.seekPage(2));
  expect(props.scrollTo).toHaveBeenLastCalledWith(40);
  expect(props.setPageIndex).toHaveBeenLastCalledWith(2);
  act(() => ref.current!.onScroll(40));
  act(() => jest.runOnlyPendingTimers());
  expect(props.commit).toHaveBeenCalledWith(
    expect.objectContaining({
      readingPosition: { chapterId: 'c', position: 10, titleVisible: true },
    }),
  );
});

test('scroll page coordinates keep special-break offsets in the canonical page text', () => {
  const ref = createRef<ReaderPositionHandle>(),
    props = base({
      mode: 'scroll',
      text: 'abc\n\ndef',
      pageText: 'abc\n[newpage]\ndef',
      honorSpecialPageBreaks: true,
      book: { ...book, readingPosition: { chapterId: 'c', position: 6 } },
      ranges: [
        { text: 'abc', start: 0, end: 3 },
        { text: 'def', start: 14, end: 17 },
      ],
      contentTop: 0,
    });
  act(() => {
    tree = create(<ReaderPositionBridge {...props} ref={ref} />);
  });
  expect(props.setPageIndex).toHaveBeenLastCalledWith(1);
  act(() => {
    ref.current!.onExtent(1000);
    ref.current!.onViewport(100);
    ref.current!.onParagraphLayout(1, 60);
    ref.current!.onTextLayout(1, [{ text: 'def', y: 0, height: 20 }]);
  });
  expect(props.scrollTo).toHaveBeenLastCalledWith(60);
});
