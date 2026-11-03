import React from 'react';
import {act, create} from 'react-test-renderer';
const mockInject = jest.fn(), mockCookies = jest.fn();
jest.mock('react-native', () => ({View:'View',Text:'Text',Pressable:'Pressable',ActivityIndicator:'ActivityIndicator',StyleSheet:{create:(x:unknown)=>x,absoluteFill:{},hairlineWidth:1},BackHandler:{addEventListener:()=>({remove:jest.fn()})}}));
jest.mock('react-native-webview', () => {
  const React = require('react');
  return React.forwardRef((props: object, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({injectJavaScript:mockInject}));
    return React.createElement('WebView',props);
  });
});
jest.mock('../src/components/PageHeader', () => ({PageHeader:({action}:{action:React.ReactNode})=>require('react').createElement('View',null,action)}));
jest.mock('../src/theme/AppTheme', () => ({useAppTheme:()=>({colors:{},t:(key:string)=>key})}));
jest.mock('../src/data/sourceCookies', () => ({saveDocumentCookies:(...args:unknown[])=>mockCookies(...args)}));
import {SourceVerificationOverlay} from '../src/components/SourceVerificationOverlay';
import {sourceVerification} from '../src/core/sourceVerification';
beforeEach(()=>{mockInject.mockClear();mockCookies.mockClear();});

test('shows the browser, synchronizes same-origin cookies and returns the page on confirmation', async () => {
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT = true;
  let tree!: ReturnType<typeof create>;
  await act(async()=>{tree=create(<SourceVerificationOverlay/>);});
  let result!: ReturnType<typeof sourceVerification.request>;
  await act(async()=>{result=sourceVerification.request({sourceUrl:'https://example.org',url:'https://example.org/check',title:'验证'});});
  const web = tree.root.findByType('WebView' as never);
  await act(async()=>{web.props.onLoadEnd();});
  await act(async()=>{tree.root.findByProps({accessibilityLabel:'verificationDone'}).props.onPress();});
  expect(mockInject).toHaveBeenCalled();
  const id = sourceVerification.current()!.id;
  await act(async()=>{web.props.onMessage({nativeEvent:{data:JSON.stringify({type:'legado-verification',id,url:'https://example.org/check',cookie:'session=ok',html:'<p>通过</p>'})}});});
  await expect(result).resolves.toEqual({url:'https://example.org/check',html:'<p>通过</p>'});
  expect(mockCookies).toHaveBeenCalledWith('https://example.org','session=ok');
  await act(async()=>tree.unmount());
});

test('ignores stale and cross-origin cookie messages and lets the user cancel', async () => {
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT = true;
  let tree!: ReturnType<typeof create>;
  await act(async()=>{tree=create(<SourceVerificationOverlay/>);});
  let result!: ReturnType<typeof sourceVerification.request>;
  await act(async()=>{result=sourceVerification.request({sourceUrl:'https://example.org',url:'https://example.org/check',title:'验证'});});
  const rejected = expect(result).rejects.toThrow(/取消/);
  const web = tree.root.findByType('WebView' as never), id = sourceVerification.current()!.id;
  await act(async()=>{
    web.props.onMessage({nativeEvent:{data:JSON.stringify({type:'legado-verification-cookie',id:id+1,url:'https://example.org/check',cookie:'bad=stale'})}});
    web.props.onMessage({nativeEvent:{data:JSON.stringify({type:'legado-verification-cookie',id,url:'https://other.org/check',cookie:'bad=foreign'})}});
  });
  expect(mockCookies).not.toHaveBeenCalled();
  await act(async()=>{sourceVerification.cancel(id);});
  await rejected;
  await act(async()=>tree.unmount());
});
