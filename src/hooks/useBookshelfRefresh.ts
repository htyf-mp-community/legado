import { useSyncExternalStore } from 'react';
import {
  getBookshelfRefreshSnapshot,
  observeBookshelfRefresh,
} from '../services/bookshelfRefreshRuntime';
export function useBookshelfRefresh() {
  return useSyncExternalStore(
    observeBookshelfRefresh,
    getBookshelfRefreshSnapshot,
    getBookshelfRefreshSnapshot,
  );
}
