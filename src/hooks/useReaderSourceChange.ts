import { useLayoutEffect, useRef } from 'react';
import type { Book } from '../types';

/** A source switch keeps the book ID but can move the selected chapter. */
export function useReaderSourceChange(book: Book | undefined, onChange: (index: number) => void) {
  const previous = useRef(book && { id: book.id, origin: book.origin, bookUrl: book.bookUrl });
  useLayoutEffect(() => {
    const prior = previous.current;
    previous.current = book && { id: book.id, origin: book.origin, bookUrl: book.bookUrl };
    if (book && prior?.id === book.id && (prior.origin !== book.origin || prior.bookUrl !== book.bookUrl))
      onChange(book.currentChapterIndex ?? 0);
  }, [book, onChange]);
}
