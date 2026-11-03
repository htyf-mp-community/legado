import {runSourceJavaScriptAsync} from '../src/core/sourceJavaScript';
import {SourceRuleError, SourceVerificationCancelledError} from '../src/core/errors';

const bridge = () => ({baseUrl:'https://example.org',key:'书',page:1,removeCookie:()=>{},ajax:async (_url:string):Promise<string> => {throw new Error('network failed');}});

test.each([
  ['post', 'java.post(baseUrl,"x",{})', {post: async () => {throw new Error('network failed');}}],
  ['browser', 'java.startBrowserAwait(baseUrl,"test")', {browser: async () => {throw new Error('network failed');}}],
])('allows source scripts to catch a failed %s call', async (_name, expression, override) => {
  const script = `var result='before';try{${expression};result='unexpected'}catch(e){result=e.message}finally{result+=':finally'}result;`;
  expect(await runSourceJavaScriptAsync(script, {...bridge(),...override})).toBe('network failed:finally');
});

test('returns an error text or synthetic response for failed ajax and connect, as the original does', async () => {
  const testBridge = {...bridge(),connect:async()=>{throw new Error('network failed');}};
  const script = 'var a=java.ajax(baseUrl);var r=java.connect(baseUrl+"/page");[a.indexOf("network failed")>=0,r.body().indexOf("network failed")>=0,r.url(),r.code()].join("|")';
  expect(await runSourceJavaScriptAsync(script, testBridge)).toBe('true|true|https://example.org/page|200');
});

test('preserves uncaught network errors and does not swallow security or cancellation errors', async () => {
  await expect(runSourceJavaScriptAsync('java.post(baseUrl,"x",{})', {...bridge(),post:async()=>{throw new Error('network failed');}})).rejects.toThrow('network failed');
  const script = 'try{java.ajax(baseUrl)}catch(e){"caught"}';
  await expect(runSourceJavaScriptAsync(script, {...bridge(),ajax:async()=>{throw new SourceRuleError('JavaScript 请求地址不属于当前书源');}})).rejects.toThrow(/不属于当前书源/);
  await expect(runSourceJavaScriptAsync(script, {...bridge(),ajax:async()=>{const e=new Error('cancelled');e.name='AbortError';throw e;}})).rejects.toMatchObject({name:'AbortError'});
  await expect(runSourceJavaScriptAsync('try{java.startBrowserAwait(baseUrl,"x")}catch(e){"caught"}', {...bridge(),browser:async()=>{throw new SourceVerificationCancelledError();}})).rejects.toBeInstanceOf(SourceVerificationCancelledError);
});

test('runs nested finally blocks and can continue with a later request', async () => {
  let calls = 0;
  const script = 'var x="";try{try{java.post(baseUrl,"x",{})}finally{x+="finally:"}}catch(e){x+=e.message+":"}x+=java.post(baseUrl,"x",{}).body();x;';
  const result = await runSourceJavaScriptAsync(script, {...bridge(),post:async()=>{if (++calls === 1) throw new Error('network failed'); return {data:'recovered',body:'recovered',url:bridge().baseUrl,code:200};}});
  expect(result).toBe('finally:network failed:recovered');
  expect(calls).toBe(2);
});

test('handles synchronous bridge errors while keeping output limits fatal', async () => {
  const postScript = 'try{java.post(baseUrl,"x",{})}catch(e){e.message}';
  await expect(runSourceJavaScriptAsync(postScript, {...bridge(),post:()=>{throw new Error('sync failure');}})).resolves.toBe('sync failure');
  await expect(runSourceJavaScriptAsync('try{java.ajax(baseUrl)}catch(e){"caught"}', {...bridge(),ajax:async()=>'x'.repeat(1_000_001)})).rejects.toThrow(/超过限制/);
});
