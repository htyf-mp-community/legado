import { useSyncExternalStore } from 'react';
import { getLibrarySnapshot, subscribeLibrary } from '../data/library';

export function useLibrary() {
  return useSyncExternalStore(
    subscribeLibrary,
    getLibrarySnapshot,
    getLibrarySnapshot,
  );
}
