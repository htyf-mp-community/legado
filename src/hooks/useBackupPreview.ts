import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackupPreview } from '../core/restoreBackupPreview';
import { discardLegacyMedia } from '../core/legacyBackupArchive';

/** Pending files belong to the preview until restore commits, including dismiss/back/unmount. */
export function useBackupPreview() {
  const [pending, update] = useState<BackupPreview | null>(null);
  const current = useRef<BackupPreview | null>(null),
    mounted = useRef(true);
  const setPending = useCallback((next: BackupPreview | null) => {
    const previous = current.current;
    current.current = next;
    if (previous?.mediaPlan && previous !== next)
      void discardLegacyMedia(previous.mediaPlan);
    if (mounted.current) update(next);
    else if (next?.mediaPlan) void discardLegacyMedia(next.mediaPlan);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (current.current?.mediaPlan)
        void discardLegacyMedia(current.current.mediaPlan);
    };
  }, []);
  return [pending, setPending] as const;
}
