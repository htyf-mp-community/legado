import { useSyncExternalStore } from 'react';
import { getBookGroupsSnapshot, subscribeBookGroups } from '../data/bookshelf';
export function useBookGroups() {
  return useSyncExternalStore(
    subscribeBookGroups,
    getBookGroupsSnapshot,
    getBookGroupsSnapshot,
  );
}
