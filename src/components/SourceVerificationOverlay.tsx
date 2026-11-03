import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View} from 'react-native';
import WebView, {type WebViewMessageEvent} from 'react-native-webview';
import type {ShouldStartLoadRequest, WebViewErrorEvent} from 'react-native-webview/lib/WebViewTypes';
import {sourceVerification, type ActiveSourceVerification} from '../core/sourceVerification';
import {saveDocumentCookies} from '../data/sourceCookies';
import {useAppTheme} from '../theme/AppTheme';
import {PageHeader} from './PageHeader';

type WebHandle = {injectJavaScript: (script: string) => void};
const origin = (value: string) => /^https?:\/\/([^/?#]+)/i.exec(value)?.[1].toLowerCase();
const syncScript = (id: number) => `(function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'legado-verification-cookie',id:${id},url:location.href,cookie:document.cookie||''}));})();true;`;

/** App-owned browser so a script can wait without leaving the mini-program. */
export function SourceVerificationOverlay() {
  const {colors, t} = useAppTheme();
  const [request, setRequest] = useState<ActiveSourceVerification | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [capturing, setCapturing] = useState(false);
  const web = useRef<WebHandle>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);
  useEffect(() => sourceVerification.subscribe(setRequest), []);
  useEffect(() => {
    setLoading(true); setError(''); setCapturing(false); pending.current = false;
    if (timer.current) clearTimeout(timer.current);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [request?.id]);
  useEffect(() => {
    if (!request) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { sourceVerification.cancel(request.id); return true; });
    return () => subscription.remove();
  }, [request]);
  if (!request) return null;
  const cancel = () => sourceVerification.cancel(request.id);
  const complete = () => {
    if (loading || capturing || !web.current) return;
    pending.current = true; setCapturing(true); setError('');
    const html = request.refetch === false ? '(document.documentElement ? document.documentElement.outerHTML : "")' : '""';
    web.current.injectJavaScript(`(function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'legado-verification',id:${request.id},url:location.href,cookie:document.cookie||'',html:${html}}));})();true;`);
    timer.current = setTimeout(() => { pending.current = false; setCapturing(false); setError(t('verificationCaptureFailed')); }, 5000);
  };
  const message = (event: WebViewMessageEvent) => {
    try {
      const value = JSON.parse(event.nativeEvent.data) as {type?: string; id?: number; url?: string; cookie?: string; html?: string};
      if (value.type !== 'legado-verification-cookie' && value.type !== 'legado-verification') return;
      if (value.id !== request.id || sourceVerification.current()?.id !== request.id) return;
      const pageUrl = typeof value.url === 'string' ? value.url : '';
      if (origin(pageUrl) === origin(request.sourceUrl) && typeof value.cookie === 'string' && value.cookie.length <= 64000)
        saveDocumentCookies(request.sourceUrl, value.cookie);
      if (value.type !== 'legado-verification' || value.id !== request.id || !pending.current) return;
      if (!/^https?:\/\//i.test(pageUrl) || typeof value.html !== 'string' || value.html.length > 1000000) throw new Error('Invalid verification result');
      pending.current = false;
      if (timer.current) clearTimeout(timer.current);
      sourceVerification.finish(request.id, {url:pageUrl, html:value.html});
    } catch {
      if (pending.current) { pending.current = false; setCapturing(false); if (timer.current) clearTimeout(timer.current); setError(t('verificationCaptureFailed')); }
    }
  };
  const source = request.html == null ? {uri:request.url, headers:request.headers} : {html:request.html, baseUrl:request.url};
  return <View accessibilityViewIsModal style={[styles.layer,{backgroundColor:colors.background}]}>
    <PageHeader title={request.title || t('verificationTitle')} onBack={cancel} action={<Pressable accessibilityRole="button" accessibilityLabel={t('verificationDone')} disabled={loading || capturing} onPress={complete} style={styles.action}><Text style={{color:colors.primary,opacity:loading || capturing ? 0.5 : 1}}>{t('verificationDone')}</Text></Pressable>}/>
    {error ? <Text accessibilityRole="alert" style={[styles.error,{color:colors.danger}]}>{error}</Text> : null}
    <WebView key={request.id} ref={web as never} source={source} javaScriptEnabled domStorageEnabled sharedCookiesEnabled injectedJavaScript={syncScript(request.id)} onMessage={message} onLoadStart={()=>{setLoading(true);setError('');}} onLoadEnd={()=>{setLoading(false);web.current?.injectJavaScript(syncScript(request.id));}} onError={(event:WebViewErrorEvent): void =>{setLoading(false);setError(event.nativeEvent.description || t('loginPageFailed'));}} onShouldStartLoadWithRequest={(event:ShouldStartLoadRequest): boolean =>/^https?:\/\//i.test(event.url)} />
    {loading || capturing ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={colors.primary}/></View> : null}
  </View>;
}
const styles = StyleSheet.create({layer:{...StyleSheet.absoluteFill,zIndex:200,elevation:200},action:{minHeight:44,justifyContent:'center',paddingHorizontal:10},error:{paddingHorizontal:16,paddingVertical:8},loading:{position:'absolute',left:0,right:0,top:'50%',alignItems:'center'}});
