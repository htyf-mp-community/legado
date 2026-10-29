import { AppState } from 'react-native';
import {
  loadAutoTasks,
  loadAutoTaskServiceEnabled,
  subscribeAutoTasks,
} from '../data/autoTasks';
import { nextAutoTaskAt, runDueAutoTasks } from '../core/autoTask';
import { addAppLog } from '../data/appLog';
/** Only dispatch while foregrounded. The host has no persistent iOS background-job bridge. */
export function startAutoTaskScheduler() {
  let foreground = AppState.currentState === 'active' || !AppState.currentState,
    disposed = false,
    busy = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
    plan = (afterBatch: boolean, retry = false) => {
      clear();
      if (disposed || !foreground || !loadAutoTaskServiceEnabled()) return;
      const now = Date.now(),
        at = nextAutoTaskAt(loadAutoTasks(), now, afterBatch);
      if (at !== undefined)
        timer = setTimeout(
          () => {
            void check();
          },
          Math.min(2147483647, Math.max(retry ? 60000 : 0, at - now)),
        );
    },
    check = async () => {
      clear();
      if (disposed || busy || !foreground || !loadAutoTaskServiceEnabled())
        return;
      busy = true;
      let count = 0,
        retry = false;
      try {
        count = await runDueAutoTasks();
      } catch (cause) {
        retry = true;
        addAppLog('Automatic task scheduling failed', cause);
      } finally {
        busy = false;
        plan(count > 0, retry);
      }
    },
    changed = () => {
      clear();
      if (!busy) void check();
    };
  const unsubscribe = subscribeAutoTasks(changed),
    subscription = AppState.addEventListener('change', state => {
      foreground = state === 'active';
      if (foreground) changed();
      else clear();
    });
  void check();
  return () => {
    disposed = true;
    clear();
    unsubscribe();
    subscription.remove();
  };
}
