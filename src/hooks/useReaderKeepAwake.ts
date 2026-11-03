import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import jssdk from '@htyf-mp/js-sdk';
import {ReaderKeepAwakeController, type ScreenTimeoutSeconds} from '../core/readerKeepAwake';

let nextTag = 0;
export function useReaderKeepAwake(focused: boolean, seconds: ScreenTimeoutSeconds, onError: (error: unknown) => void) {
  const current = useRef<ReaderKeepAwakeController | null>(null);
  const errorHandler = useRef(onError);
  errorHandler.current = onError;
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let lease: typeof jssdk.client;
    const controller = new ReaderKeepAwakeController(
      {
        activate: async () => {
          const client = jssdk.client;
          if (!client?.activateKeepAwake || !client.deactivateKeepAwake)
            throw new Error('当前宿主未提供屏幕常亮能力');
          lease = client;
          await client.activateKeepAwake();
        },
        deactivate: async () => {
          if (!lease) return;
          await lease.deactivateKeepAwake?.();
          lease = undefined;
        },
      },
      `legado.reader.${Date.now()}.${++nextTag}`,
      error => errorHandler.current(error),
    );
    current.current = controller;
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    setForeground(AppState.currentState === 'active');
    return () => {subscription.remove(); current.current = null; controller.dispose();};
  }, []);
  useEffect(() => {current.current?.configure(focused, foreground, seconds);}, [focused, foreground, seconds]);
  return useCallback(() => current.current?.interact(), []);
}
