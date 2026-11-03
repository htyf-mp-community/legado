const mockStore = new Map<string, string>();
jest.mock('../src/data/storage', () => ({appStorage:{
  getString: (key: string) => mockStore.get(key),
  set: (key: string, value: string) => mockStore.set(key, value),
  remove: (key: string) => mockStore.delete(key),
}}));
jest.mock('../src/data/generalPreferences', () => ({loadGeneralPreferences: () => ({})}));
jest.mock('../src/data/httpLog', () => ({addHttpLog: jest.fn()}));
jest.mock('../src/data/appLog', () => ({addAppLog: jest.fn()}));
import {saveDocumentCookies, sourceCookieHeader} from '../src/data/sourceCookies';
import {buildSourceRequest, executeSourceRequest} from '../src/core/sourceRequest';
import type {BookSource} from '../src/types';

const source: BookSource = {bookSourceUrl:'https://example.org',bookSourceName:'书源',bookSourceType:0,customOrder:0,enabled:true,enabledExplore:true,enabledCookieJar:false};
beforeEach(() => mockStore.clear());
afterEach(() => jest.restoreAllMocks());

test('uses saved login cookies even when automatic cookie collection is disabled', () => {
  saveDocumentCookies(source.bookSourceUrl, 'session=verified; user=reader');
  const request = buildSourceRequest(source, '/search');
  expect(request.headers.Cookie).toBe('session=verified; user=reader');
  expect(request.cookieJar).toBe(false);
  expect(buildSourceRequest({...source,bookSourceUrl:'https://other.org'}, '/search').headers.Cookie).toBeUndefined();
});

test('request-specific cookies override stored values without duplicate names', () => {
  saveDocumentCookies(source.bookSourceUrl, 'session=old; user=reader');
  const request = buildSourceRequest(source, '/search,{"headers":{"Cookie":"session=new; extra=x"}}');
  expect(request.headers.Cookie).toBe('session=new; user=reader; extra=x');
});

test('the latest cookie header wins even when its casing differs', () => {
  saveDocumentCookies(source.bookSourceUrl, 'session=old');
  const request = buildSourceRequest({...source, header:'{"Cookie":"session=header; first=yes"}'}, '/search,{"headers":{"cookie":"session=option"}}');
  expect(request.headers.cookie).toBe('session=option; first=yes');
  expect(request.headers.Cookie).toBeUndefined();
  expect(request.sensitiveHeaderNames).toContain('Cookie');
});

test('disabling automatic cookie collection keeps response cookies out of saved login state', async () => {
  saveDocumentCookies(source.bookSourceUrl, 'session=verified');
  jest.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,status:200,url:'https://example.org/search',headers:{get:(name:string)=>name === 'set-cookie' ? 'session=changed' : null,forEach:()=>{}},text:async()=>''} as unknown as Response);
  await executeSourceRequest(buildSourceRequest(source, '/search'));
  expect(sourceCookieHeader(source.bookSourceUrl)).toBe('session=verified');
});
