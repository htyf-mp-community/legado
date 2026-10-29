import { useSyncExternalStore } from 'react';
import {
  getCoverPreferencesSnapshot,
  subscribeCoverPreferences,
} from '../data/coverPreferences';

export function useCoverPreferences() {
  return useSyncExternalStore(
    subscribeCoverPreferences,
    getCoverPreferencesSnapshot,
    getCoverPreferencesSnapshot,
  );
}
