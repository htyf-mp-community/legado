import { useSyncExternalStore } from 'react';
import {
  getBookshelfPreferencesSnapshot,
  subscribeBookshelfPreferences,
} from '../data/bookshelfPreferences';
export function useBookshelfPreferences() {
  return useSyncExternalStore(
    subscribeBookshelfPreferences,
    getBookshelfPreferencesSnapshot,
    getBookshelfPreferencesSnapshot,
  );
}
