import React from 'react';
import {act, create} from 'react-test-renderer';
import type {SourceWorkerHostHandle} from '../src/components/SourceWorkerHost';
jest.mock('react-native',()=>({View:'View',StyleSheet:{create:(value:unknown)=>value}}));
jest.mock('react-native-webview',()=>{
  const ReactRuntime=require('react');
  return ReactRuntime.forwardRef((props:object,ref:unknown)=>{
    ReactRuntime.useImperativeHandle(ref,()=>({injectJavaScript:mockInject}));
    return ReactRuntime.createElement('WebView',props);
  });
});
jest.mock('react-native-quick-crypto',()=>({randomUUID:()=>`page_${++mockNonce}`}));
jest.mock('../src/services/localServerRuntime',()=>({acquireLocalWorkerPage:jest.fn()}));
import {SourceWorkerHost} from '../src/components/SourceWorkerHost';
import {acquireLocalWorkerPage} from '../src/services/localServerRuntime';
const mockInject=jest.fn();
let mockNonce=0;
const bridge={baseUrl:'https://example.org',sourceUrl:'https://example.org',key:'书',page:1,ajax:async()=>'',removeCookie:()=>{}};
beforeEach(()=>{(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;mockNonce=0;mockInject.mockClear();});
afterEach(()=>jest.clearAllMocks());

test('owns its WebView and lease across execution, failure and reload',async()=>{
 const release=jest.fn(async()=>{});
 jest.mocked(acquireLocalWorkerPage).mockResolvedValue({url:'http://127.0.0.1:1234/page',release});
 const ref=React.createRef<SourceWorkerHostHandle>();let tree!:ReturnType<typeof create>;
 await act(async()=>{tree=create(<SourceWorkerHost ref={ref}/>);});
 expect(acquireLocalWorkerPage).not.toHaveBeenCalled();
 await act(async()=>{await ref.current!.start();});
 let view=tree.root.findByType('WebView' as never);
 expect(view.props.source.uri).toBe('http://127.0.0.1:1234/page#page_1');
 let task!:Promise<unknown>;
 await act(async()=>{task=ref.current!.runJavaScript('6*7',bridge);});
 expect(mockInject).not.toHaveBeenCalled();
 await act(async()=>view.props.onMessage({nativeEvent:{data:JSON.stringify({type:'ready',nonce:'page_1'})}}));
 expect(mockInject).toHaveBeenCalledWith(expect.stringContaining('6*7'));
 await act(async()=>view.props.onMessage({nativeEvent:{data:JSON.stringify({type:'result',nonce:'page_1',task:1,value:42})}}));
 await expect(task).resolves.toBe(42);
 await act(async()=>view.props.onHttpError({nativeEvent:{url:'http://127.0.0.1:1234/page',statusCode:404}}));
 expect(tree.root.findAllByType('WebView' as never)).toHaveLength(0);
 await act(async()=>{await ref.current!.start();});
 view=tree.root.findByType('WebView' as never);
 expect(view.props.source.uri).toBe('http://127.0.0.1:1234/page#page_2');
 await act(async()=>tree.unmount());
 expect(release).toHaveBeenCalledTimes(1);
});

test('unmount during acquisition releases the eventual lease without mounting a WebView',async()=>{
 let finish!:(lease:{url:string;release:()=>Promise<void>})=>void;
 const release=jest.fn(async()=>{});
 jest.mocked(acquireLocalWorkerPage).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const ref=React.createRef<SourceWorkerHostHandle>();let tree!:ReturnType<typeof create>;
 await act(async()=>{tree=create(<SourceWorkerHost ref={ref}/>);});
 const start=ref.current!.start();
 await act(async()=>tree.unmount());
 await act(async()=>finish({url:'http://127.0.0.1:1234/page',release}));
 await expect(start).rejects.toThrow(/关闭/);
 expect(release).toHaveBeenCalledTimes(1);
});
