import {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {SourceRuleError} from '../core/errors';
import {SourceWorkerRuntime} from '../core/sourceWorkerRuntime';
import {SOURCE_WORKER_HTML, SOURCE_WORKER_SCRIPT, sourceWorkerCommandScript} from '../core/sourceWorkerResources';
import {acquireLocalWorkerPage} from '../services/localServerRuntime';
import type {SourceJavaScriptRunner} from '../core/sourceJavaScript';
import type {SourceRuleScriptRunner} from '../core/sourceRule';
import {SourceWorkerView} from './SourceWorkerView';

type Page = {url:string; nonce:string};
type WebHandle = {injectJavaScript:(script:string)=>void};
export type SourceWorkerHostHandle = {
  start:()=>Promise<void>;
  reload:()=>void;
  runJavaScript:SourceJavaScriptRunner;
  runRuleJavaScript:SourceRuleScriptRunner;
};

/** Experimental owner for one lazily acquired Worker page and its WebView. */
export const SourceWorkerHost = forwardRef<SourceWorkerHostHandle>(function SourceWorkerHost(_props, ref) {
  const [page, setPage] = useState<Page|null>(null);
  const web = useRef<WebHandle|null>(null);
  const runtime = useRef<SourceWorkerRuntime|undefined>(undefined);
  useEffect(() => {
    let mounted = true;
    const owner = new SourceWorkerRuntime({
      acquire:()=>acquireLocalWorkerPage(SOURCE_WORKER_HTML, SOURCE_WORKER_SCRIPT),
      nonce:()=>require('react-native-quick-crypto').randomUUID(),
      send:command=>{
        if (!web.current) throw new SourceRuleError('JavaScript 运行页面不可用');
        web.current.injectJavaScript(sourceWorkerCommandScript(command));
      },
      showPage:next=>{if (mounted) setPage(next);},
    });
    runtime.current = owner;
    return () => {
      mounted = false;
      if (runtime.current === owner) runtime.current = undefined;
      void owner.dispose().catch(() => undefined);
    };
  }, []);
  useImperativeHandle(ref, () => {
    const owner = () => {
      if (!runtime.current) throw new SourceRuleError('JavaScript 运行通道已关闭');
      return runtime.current;
    };
    return {
      start:()=>{try {return owner().start();} catch (error) {return Promise.reject(error);}},
      reload:()=>owner().reload(),
      runJavaScript:(...args)=>{try {return owner().runJavaScript(...args);} catch (error) {return Promise.reject(error);}},
      runRuleJavaScript:(...args)=>{try {return owner().runRuleJavaScript(...args);} catch (error) {return Promise.reject(error);}},
    };
  }, []);
  return page && runtime.current ? <SourceWorkerView runtime={runtime.current} page={page} webRef={web}/> : null;
});
