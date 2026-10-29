type State = 'queued' | 'running';
const batches = new Set<Map<string, State>>(),
  listeners = new Set<() => void>();
let snapshot = { pending: 0, running: new Set<string>() };
const emit = () => {
  const all = new Set<string>(),
    running = new Set<string>();
  batches.forEach(batch =>
    batch.forEach((state, id) => {
      all.add(id);
      if (state === 'running') running.add(id);
    }),
  );
  snapshot = { pending: all.size, running };
  listeners.forEach(listener => listener());
};
export function observeBookshelfRefresh(changed: () => void) {
  listeners.add(changed);
  return () => {
    listeners.delete(changed);
  };
}
export const getBookshelfRefreshSnapshot = () => snapshot;
export function trackBookshelfRefresh(ids: string[]) {
  const batch = new Map(ids.map(id => [id, 'queued' as State]));
  batches.add(batch);
  emit();
  return {
    start(id: string) {
      if (batch.has(id)) {
        batch.set(id, 'running');
        emit();
      }
    },
    finish(id: string) {
      batch.delete(id);
      emit();
    },
    dispose() {
      batches.delete(batch);
      emit();
    },
  };
}
