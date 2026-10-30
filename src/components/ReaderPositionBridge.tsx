import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import type { Book } from '../types';
import type { TextPageRange } from '../core/pagination';
import {
  displayTextOffset,
  nativeTextOffset,
  textPageAtOffset,
} from '../core/readerPosition';
import { spreadStart } from '../core/readerSpread';
export type ReaderPositionProps = {
  book: Book;
  chapterId: string;
  title: string;
  text: string;
  pageText?: string;
  indent: string;
  honorSpecialPageBreaks?: boolean;
  mode: 'page' | 'scroll';
  pageIndex: number;
  columns: number;
  ranges: TextPageRange[];
  layoutKey: string;
  contentTop: number;
  setPageIndex: (index: number) => void;
  scrollTo: (y: number) => void;
  commit: (book: Book) => void;
};
export type ReaderPositionHandle = {
  onParagraphLayout: (index: number, top: number) => void;
  onTextLayout: (
    index: number,
    lines: ReadonlyArray<{ text: string; y: number; height: number }>,
  ) => void;
  onScroll: (y: number) => void;
  onScrollBeginDrag: () => void;
  onExtent: (height: number) => void;
  onViewport: (height: number) => void;
  flush: () => void;
  seekPage: (index: number) => void;
};
type Line = { start: number; end: number; top: number; height: number };
const paragraphs = (text: string) => {
  let start = 0;
  return text.split(/(\n+)/).flatMap((value, index) => {
    const result = index % 2 ? [] : [{ text: value, start }];
    start += value.length;
    return result;
  });
};
/** Coordinates actual page slices / native Text line measurements without exposing another UI surface. */
export const ReaderPositionBridge = forwardRef<
  ReaderPositionHandle,
  ReaderPositionProps
>(function ReaderPositionBridge(props, ref) {
  const latest = useRef(props);
  latest.current = props;
  const cursor = useRef(0),
    titleVisible = useRef(true),
    expectedPage = useRef<number | undefined>(undefined),
    previousPage = useRef(-1),
    awaitingScroll = useRef(true),
    expectedY = useRef<number | undefined>(undefined),
    extent = useRef(0),
    viewport = useRef(0),
    tops = useRef(new Map<number, number>()),
    lines = useRef(new Map<number, Line[]>()),
    pending = useRef<(() => void) | undefined>(undefined),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
    const action = pending.current;
    pending.current = undefined;
    action?.();
  };
  const queue = (position: number) => {
    if (position === cursor.current) return;
    cursor.current = position;
    const p = latest.current;
    pending.current = () =>
      p.commit({
        ...p.book,
        readingPosition: {
          chapterId: p.chapterId,
          position,
          titleVisible: titleVisible.current,
        },
        updatedAt: Date.now(),
      });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 150);
  };
  const fromDisplay = (offset: number) => {
    const p = latest.current;
    return nativeTextOffset(
      p.title,
      p.text,
      offset,
      p.indent,
      titleVisible.current,
      p.honorSpecialPageBreaks,
    );
  };
  const pageAtPosition = (position: number) => {
    const p = latest.current;
    return spreadStart(
      textPageAtOffset(
        p.ranges,
        displayTextOffset(
          p.title,
          p.pageText ?? p.text,
          position,
          p.indent,
          titleVisible.current,
          p.honorSpecialPageBreaks,
        ),
      ),
      p.columns,
    );
  };
  const restoreScroll = () => {
    const p = latest.current;
    if (
      p.mode !== 'scroll' ||
      !awaitingScroll.current ||
      !extent.current ||
      !viewport.current
    )
      return;
    let y = 0;
    if (cursor.current > 0) {
      const offset = displayTextOffset(
          p.title,
          p.text,
          cursor.current,
          p.indent,
          titleVisible.current,
          p.honorSpecialPageBreaks,
        ),
        parts = paragraphs(p.text);
      const partIndex = Math.max(
        0,
        parts.findIndex(
          (part, index) =>
            offset < (parts[index + 1]?.start ?? p.text.length + 1),
        ),
      );
      const top = tops.current.get(partIndex),
        measured = lines.current.get(partIndex),
        local = offset - parts[partIndex].start;
      if (
        top === undefined ||
        !measured?.length ||
        measured.at(-1)!.end < local
      )
        return;
      const line =
        [...measured].reverse().find(item => item.start <= local) ??
        measured[0];
      y = Math.max(0, top + line.top - p.contentTop);
    }
    y = Math.min(y, Math.max(0, extent.current - viewport.current));
    if (
      expectedY.current !== undefined &&
      Math.abs(expectedY.current - y) < 0.5
    )
      return;
    expectedY.current = y;
    p.scrollTo(y);
  };
  useLayoutEffect(() => {
    flush();
    const saved = props.book.readingPosition;
    if (previousPage.current === -1) {
      cursor.current =
        saved?.chapterId === props.chapterId ? saved.position : 0;
      titleVisible.current =
        saved?.chapterId === props.chapterId
          ? saved.titleVisible !== false
          : true;
    }
    const page = pageAtPosition(cursor.current);
    previousPage.current = page;
    props.setPageIndex(page);
    if (props.mode === 'page') {
      expectedPage.current = page === props.pageIndex ? undefined : page;
    } else {
      tops.current.clear();
      lines.current.clear();
      awaitingScroll.current = true;
      expectedY.current = undefined;
    }
    // The parent keys this component by book/chapter. Persisted cursor changes from our own writes must not navigate again.
  }, [props.layoutKey, props.mode]);
  useLayoutEffect(() => {
    const saved = props.book.readingPosition;
    if (
      saved?.chapterId !== props.chapterId ||
      saved.position === cursor.current
    )
      return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
    pending.current = undefined;
    cursor.current = saved.position;
    titleVisible.current = saved.titleVisible !== false;
    const page = pageAtPosition(cursor.current);
    previousPage.current = page;
    props.setPageIndex(page);
    if (props.mode === 'page') {
      expectedPage.current = page === props.pageIndex ? undefined : page;
    } else {
      awaitingScroll.current = true;
      expectedY.current = undefined;
      restoreScroll();
    }
    // Only a changed persisted position is an external navigation request; other book edits cannot reset a pending local movement.
  }, [
    props.book.readingPosition?.chapterId,
    props.book.readingPosition?.position,
  ]);
  useLayoutEffect(() => {
    if (props.mode !== 'page') return;
    if (expectedPage.current !== undefined) {
      if (props.pageIndex === expectedPage.current)
        expectedPage.current = undefined;
      return;
    }
    if (previousPage.current === props.pageIndex) return;
    previousPage.current = props.pageIndex;
    const range =
      props.ranges[
        Math.max(0, Math.min(props.pageIndex, props.ranges.length - 1))
      ];
    if (range) queue(props.pageIndex === 0 ? 0 : fromDisplay(range.start));
  }, [props.pageIndex, props.mode]);
  useImperativeHandle(ref, () => ({
    onParagraphLayout: (index, top) => {
      tops.current.set(index, top);
      restoreScroll();
    },
    onTextLayout: (index, values) => {
      const part = paragraphs(latest.current.text)[index];
      if (!part) return;
      let offset = 0;
      const measured: Line[] = [];
      for (const line of values) {
        const text = line.text.replace(/\n$/, ''),
          start = part.text.indexOf(text, offset);
        if (start < 0 || !text) continue;
        offset = start + text.length;
        measured.push({ start, end: offset, top: line.y, height: line.height });
      }
      lines.current.set(index, measured);
      restoreScroll();
    },
    onScroll: y => {
      const p = latest.current;
      if (awaitingScroll.current) {
        if (
          expectedY.current !== undefined &&
          Math.abs(y - expectedY.current) < 1
        ) {
          awaitingScroll.current = false;
          expectedY.current = undefined;
        }
        return;
      }
      if (y <= 0.5) {
        p.setPageIndex(0);
        queue(0);
        return;
      }
      const visible = y + p.contentTop,
        parts = paragraphs(p.text);
      let first: { top: number; offset: number } | undefined;
      for (const [index, measured] of lines.current) {
        const top = tops.current.get(index);
        if (top === undefined) continue;
        for (const line of measured) {
          const at = top + line.top;
          if (at <= visible + 0.5 && (!first || at > first.top))
            first = { top: at, offset: parts[index].start + line.start };
        }
      }
      if (first) {
        const position = fromDisplay(first.offset);
        p.setPageIndex(pageAtPosition(position));
        queue(position);
      }
    },
    onScrollBeginDrag: () => {
      awaitingScroll.current = false;
      expectedY.current = undefined;
    },
    onExtent: value => {
      extent.current = value;
      restoreScroll();
    },
    onViewport: value => {
      viewport.current = value;
      restoreScroll();
    },
    flush,
    seekPage: index => {
      const p = latest.current;
      const target = Math.max(
        0,
        Math.min(Math.trunc(index), p.ranges.length - 1),
      );
      p.setPageIndex(target);
      if (p.mode !== 'scroll') return;
      const range = p.ranges[target];
      if (!range) return;
      queue(
        target === 0
          ? 0
          : nativeTextOffset(
              p.title,
              p.pageText ?? p.text,
              range.start,
              p.indent,
              titleVisible.current,
              p.honorSpecialPageBreaks,
            ),
      );
      awaitingScroll.current = true;
      expectedY.current = undefined;
      restoreScroll();
    },
  }));
  useEffect(() => () => flush(), []); // pending action owns its original book/chapter snapshot
  return null;
});
