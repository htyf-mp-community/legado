import React from 'react';
import {act,create} from 'react-test-renderer';
import {SourceWorkerRuntime} from '../src/core/sourceWorkerRuntime';
jest.mock('react-native',()=>({View:'View',StyleSheet:{create:(value:unknown)=>value}}));
jest.mock('react-native-webview',()=>{const React=require('react');return React.forwardRef((props:object,ref:unknown)=>{React.useImperativeHandle(ref,()=>({injectJavaScript:()=>{}}));return React.createElement('WebView',props);});});
import {SourceWorkerView} from '../src/components/SourceWorkerView';
const page={url:'http://127.0.0.1:1234/page#nonce',nonce:'nonce'};
test('confines navigation and routes WebView events with the page identity',async()=>{
 (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 const runtime={receive:jest.fn(),pageUnavailable:jest.fn()} as unknown as SourceWorkerRuntime,ref=React.createRef<{injectJavaScript:(script:string)=>void}>();
 let tree!:ReturnType<typeof create>;await act(async()=>{tree=create(<SourceWorkerView runtime={runtime} page={page} webRef={ref}/>);});const web=tree.root.findByType('WebView' as never);
 // The library opens non-whitelisted URLs externally before consulting our callback.
 expect(web.props.originWhitelist).toEqual(['*']);
 expect(typeof web.props.onOpenWindow).toBe('function');
 expect(web.props.onShouldStartLoadWithRequest({url:page.url})).toBe(true);expect(web.props.onShouldStartLoadWithRequest({url:page.url.split('#')[0]})).toBe(true);
 expect(web.props.onShouldStartLoadWithRequest({url:'https://example.org/'})).toBe(false);expect(web.props.onShouldStartLoadWithRequest({url:'http://127.0.0.1:1234/page/other'})).toBe(false);
 await act(async()=>{web.props.onMessage({nativeEvent:{data:'message'}});web.props.onHttpError({nativeEvent:{url:'http://127.0.0.1:1234/unrelated',statusCode:404}});});
 expect(runtime.pageUnavailable).not.toHaveBeenCalled();
 await act(async()=>{web.props.onHttpError({nativeEvent:{url:'http://127.0.0.1:1234/page',statusCode:404}});web.props.onError();web.props.onContentProcessDidTerminate();});
 expect(runtime.receive).toHaveBeenCalledWith('message','nonce');expect(runtime.pageUnavailable).toHaveBeenCalledTimes(3);expect(runtime.pageUnavailable).toHaveBeenCalledWith('nonce');
 await act(async()=>tree.unmount());
});
