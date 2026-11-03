import type {RefObject} from 'react';
import {StyleSheet,View} from 'react-native';
import WebView, {type WebViewMessageEvent} from 'react-native-webview';
import type {ShouldStartLoadRequest, WebViewHttpErrorEvent} from 'react-native-webview/lib/WebViewTypes';
import type {SourceWorkerRuntime} from '../core/sourceWorkerRuntime';

type WebHandle={injectJavaScript:(script:string)=>void};
type Props={runtime:SourceWorkerRuntime;page:{url:string;nonce:string};webRef:RefObject<WebHandle|null>};

/** Experimental transport view; the owner starts, reloads and disposes the runtime. */
export function SourceWorkerView({runtime,page,webRef}:Props) {
  const base=page.url.split('#')[0];
  const navigation=(request:ShouldStartLoadRequest)=>request.url===base || request.url===page.url;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.container}>
    {/* WebView opens non-whitelisted URLs externally before calling our guard. */}
    <WebView key={page.nonce} ref={webRef as never} source={{uri:page.url}} style={styles.web} originWhitelist={['*']}
      javaScriptEnabled domStorageEnabled={false} sharedCookiesEnabled={false} allowFileAccess={false} allowUniversalAccessFromFileURLs={false}
      onShouldStartLoadWithRequest={navigation} onOpenWindow={():void=>{}} onMessage={(event:WebViewMessageEvent)=>runtime.receive(event.nativeEvent.data,page.nonce)}
      onHttpError={(event:WebViewHttpErrorEvent):void=>{if(event.nativeEvent.url===base || event.nativeEvent.url===page.url)runtime.pageUnavailable(page.nonce);}}
      onError={()=>runtime.pageUnavailable(page.nonce)} onContentProcessDidTerminate={()=>runtime.pageUnavailable(page.nonce)} />
  </View>;
}
const styles=StyleSheet.create({container:{position:'absolute',width:1,height:1,opacity:0.01},web:{width:1,height:1,flex:0}});
