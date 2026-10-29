import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import type { Book } from '../types';
import { needsBookCatalogue } from '../core/bookCatalogue';
import { prepareBookCatalogue } from '../services/bookCatalogue';
export function useBookCatalogue(
  book: Book | undefined,
  onReady?: (index: number) => void,
) {
  const needed = needsBookCatalogue(book),
    focused = useIsFocused(),
    id = book?.id;
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [paused, setPaused] = useState<string>(),
    [revision, setRevision] = useState(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const previouslyNeeded = useRef(needed);
  useEffect(() => {
    if (previouslyNeeded.current && !needed && book)
      onReady?.(book.currentChapterIndex ?? 0);
    previouslyNeeded.current = needed;
  }, [needed, book, onReady]);
  useEffect(() => {
    if (!needed || !focused || !id || paused === id) {
      setLoading(false);
      return;
    }
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError('');
    void prepareBookCatalogue(id, request.signal)
      .catch(cause => {
        if (!request.signal.aborted)
          setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });
    return () => request.abort();
  }, [needed, focused, id, book?.bookUrl, book?.origin, paused, revision]);
  const cancel = useCallback(() => {
    controller.current?.abort();
    setPaused(id);
    setLoading(false);
  }, [id]);
  const retry = useCallback(() => {
    setPaused(undefined);
    setRevision(value => value + 1);
  }, []);
  return { needed, loading, error, cancel, retry };
}
