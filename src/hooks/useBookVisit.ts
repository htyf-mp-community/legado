import { useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { updateLibrary } from '../data/library';
import { addAppLog } from '../data/appLog';
export function useBookVisit(bookId: string | undefined) {
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused || !bookId) return;
    const now = Date.now();
    void updateLibrary(current =>
      current.map(book =>
        book.id === bookId
          ? { ...book, durChapterTime: now, lastCheckCount: 0 }
          : book,
      ),
    ).catch(error => addAppLog('Failed to record book reading time', error));
  }, [bookId, focused]);
}
