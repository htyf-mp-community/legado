const mockValues = new Map<string, string>();
jest.mock('../src/data/storage', () => ({ appStorage: {
  getString: (key: string) => mockValues.get(key),
  set: (key: string, value: string) => mockValues.set(key, value),
  remove: (key: string) => mockValues.delete(key),
}}));
import { buildSourcePageRequest, executeSourceRequest } from '../src/core/sourceRequest';
import type { BookSource } from '../src/types';
const source: BookSource = {bookSourceUrl:'https://example.org',bookSourceName:'测试',bookSourceType:0,customOrder:0,enabledExplore:true,enabled:true,enabledCookieJar:true};
beforeEach(() => mockValues.clear());
test('retries a failed source request with cookies from the previous response', async () => {
  const fail = { ok:false,status:403,url:'https://example.org/',headers:{get:(name:string)=>name === 'set-cookie' ? 'token=test; Path=/' : null,forEach:()=>{}},text:async()=>'' };
  const success = { ok:true,status:200,url:'https://example.org/',headers:{get:()=>null,forEach:()=>{}},text:async()=>'<form>' };
  globalThis.fetch = jest.fn().mockResolvedValueOnce(fail).mockResolvedValueOnce(success) as jest.Mock;
  const request = buildSourcePageRequest(source, 'https://example.org/,{"retry":2}');
  await expect(executeSourceRequest(request)).resolves.toMatchObject({data:'<form>'});
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  expect((globalThis.fetch as jest.Mock).mock.calls[1][1].headers.Cookie).toContain('token=test');
});

test('honors a source request rate across consecutive requests', async () => {
  const rateLimited = {...source, bookSourceUrl: 'https://rate.example.org', concurrentRate: '1/40'};
  const ok = {ok:true,status:200,url:'https://rate.example.org/',headers:{get:()=>null,forEach:()=>{}},text:async()=>'ok'};
  globalThis.fetch = jest.fn().mockResolvedValue(ok) as jest.Mock;
  const request = buildSourcePageRequest(rateLimited, '/');
  const started = Date.now();
  await executeSourceRequest(request);
  await executeSourceRequest(request);
  expect(Date.now() - started).toBeGreaterThanOrEqual(30);
});

test('does not repeat an HTTP fallback after the initial HTTPS connection fails', async () => {
  const httpSource = {...source,bookSourceUrl:'http://legacy.example.org',enabledCookieJar:false};
  const blocked = {ok:false,status:403,url:'http://legacy.example.org/search',headers:{get:()=>null,forEach:()=>{}},text:async()=>'challenge'};
  globalThis.fetch = jest.fn().mockRejectedValueOnce(new Error('HTTPS unavailable')).mockResolvedValueOnce(blocked).mockResolvedValueOnce({...blocked,ok:true,status:200}) as jest.Mock;
  const request = buildSourcePageRequest(httpSource, '/search');
  await expect(executeSourceRequest(request,15000,undefined,true)).resolves.toMatchObject({code:403,body:'challenge'});
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});

test('still honors an explicitly configured retry after an HTTP fallback', async () => {
  const httpSource = {...source,bookSourceUrl:'http://legacy.example.org'};
  const blocked = {ok:false,status:403,url:'http://legacy.example.org/search',headers:{get:(name:string)=>name === 'set-cookie' ? 'token=test; Path=/' : null,forEach:()=>{}},text:async()=>'challenge'};
  const success = {...blocked,ok:true,status:200,headers:{get:()=>null,forEach:()=>{}},text:async()=>'ok'};
  globalThis.fetch = jest.fn().mockRejectedValueOnce(new Error('HTTPS unavailable')).mockResolvedValueOnce(blocked).mockResolvedValueOnce(success) as jest.Mock;
  const request = buildSourcePageRequest(httpSource, '/search,{"retry":1}');
  await expect(executeSourceRequest(request)).resolves.toMatchObject({code:200,body:'ok'});
  expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  expect((globalThis.fetch as jest.Mock).mock.calls[2][1].headers.Cookie).toContain('token=test');
});
