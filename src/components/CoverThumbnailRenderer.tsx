import { useCallback, useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import {
  registerCoverRasterizer,
  type CoverBitmap,
} from '../core/coverThumbnail';
import { useCoverPreferences } from '../hooks/useCoverPreferences';
import { useAppTheme } from '../theme/AppTheme';

const bundledCover = require('../assets/image_cover_default.jpg');
// Image bytes only. The page cannot navigate or fetch network resources, and never receives source credentials.
const document = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; script-src 'unsafe-inline'"></head><body><canvas id="cover" width="84" height="112"></canvas><script>window.makeCover=function(value){var image=new Image();image.onload=function(){try{var c=document.getElementById('cover'),x=c.getContext('2d'),s=Math.max(84/image.naturalWidth,112/image.naturalHeight);x.clearRect(0,0,84,112);x.drawImage(image,(84-image.naturalWidth*s)/2,(112-image.naturalHeight*s)/2,image.naturalWidth*s,image.naturalHeight*s);window.ReactNativeWebView.postMessage(JSON.stringify({id:value.id,png:c.toDataURL('image/png').split(',')[1]}))}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({id:value.id,error:String(e)}))}};image.onerror=function(){window.ReactNativeWebView.postMessage(JSON.stringify({id:value.id,error:'Invalid bitmap'}))};image.src='data:'+value.mime+';base64,'+value.base64};window.ReactNativeWebView.postMessage(JSON.stringify({ready:true}));</script></body></html>`;
type Render = {
  id: number;
  bitmap: CoverBitmap;
  resolve: (png: string) => void;
  reject: (error: Error) => void;
  signal: AbortSignal;
  abort: () => void;
};
/** App-owned offscreen image processor; it has no interactive or accessibility surface. */
export function CoverThumbnailRenderer() {
  const web = useRef<WebView<object>>(null),
    current = useRef<Render | undefined>(undefined),
    ready = useRef(false),
    next = useRef(0);
  const preferences = useCoverPreferences(),
    { dark } = useAppTheme();
  const defaults = useRef<string[]>([]);
  defaults.current = [
    dark ? preferences.defaultCoverDark : preferences.defaultCover,
    Image.resolveAssetSource(bundledCover)?.uri,
  ].filter((value): value is string => Boolean(value));
  const send = useCallback(() => {
    const job = current.current;
    if (job && ready.current)
      web.current?.injectJavaScript(
        `window.makeCover(${JSON.stringify({ ...job.bitmap, id: job.id })});true;`,
      );
  }, []);
  const finish = useCallback((value?: string, error?: Error) => {
    const job = current.current;
    if (!job) return;
    current.current = undefined;
    job.signal.removeEventListener('abort', job.abort);
    if (error) job.reject(error);
    else job.resolve(value!);
  }, []);
  useEffect(() => {
    const remove = registerCoverRasterizer({
      defaultSources: () => defaults.current,
      render: (bitmap, signal) =>
        new Promise((resolve, reject) => {
          if (signal.aborted) {
            reject(new Error('Cover render cancelled'));
            return;
          }
          const abort = () =>
            finish(undefined, new Error('Cover render cancelled'));
          current.current = {
            id: ++next.current,
            bitmap,
            signal,
            resolve,
            reject,
            abort,
          };
          signal.addEventListener('abort', abort);
          send();
        }),
    });
    return () => {
      remove();
      finish(undefined, new Error('Cover renderer unmounted'));
      ready.current = false;
    };
  }, [finish, send]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={s.processor}
    >
      <WebView<object>
        ref={web}
        source={{ html: document, baseUrl: 'about:blank' }}
        incognito
        javaScriptEnabled
        originWhitelist={['about:blank']}
        scrollEnabled={false}
        onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
        onMessage={event => {
          try {
            const value = JSON.parse(event.nativeEvent.data) as {
              ready?: boolean;
              id?: number;
              png?: string;
              error?: string;
            };
            if (value.ready) {
              ready.current = true;
              send();
            } else if (value.id === current.current?.id)
              finish(
                value.png,
                value.error || !value.png
                  ? new Error(value.error || 'Empty cover image')
                  : undefined,
              );
          } catch {
            finish(undefined, new Error('Invalid cover response'));
          }
        }}
        onError={() => finish(undefined, new Error('Cover renderer failed'))}
        onContentProcessDidTerminate={() => {
          ready.current = false;
          finish(undefined, new Error('Cover renderer process ended'));
          web.current?.reload();
        }}
      />
    </View>
  );
}
const s = StyleSheet.create({
  processor: {
    position: 'absolute',
    left: -10000,
    top: -10000,
    width: 1,
    height: 1,
  },
});
