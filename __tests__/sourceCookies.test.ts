import {
  clearSourceCookies,
  loadSourceCookies,
  saveDocumentCookies,
  saveResponseCookies,
  sourceCookieHeader,
} from '../src/data/sourceCookies';
import { buildSourceRequest } from '../src/core/sourceRequest';
import type { BookSource } from '../src/types';

jest.mock('../src/data/storage', () => {
  const values = new Map<string, string>();
  return {
    appStorage: {
      getString: (key: string) => values.get(key),
      set: (key: string, value: string) => values.set(key, value),
      remove: (key: string) => values.delete(key),
    },
  };
});

test('isolates cookies by source and updates response values', () => {
  saveResponseCookies(
    'https://a.example',
    'sid=one; Path=/, token=abc; HttpOnly',
  );
  saveResponseCookies('https://b.example', 'sid=two; Path=/');
  expect(loadSourceCookies('https://a.example')).toEqual({
    sid: 'one',
    token: 'abc',
  });
  expect(sourceCookieHeader('https://b.example')).toBe('sid=two');
});

test('deletes expired cookies and can clear a source jar', () => {
  saveResponseCookies('source', 'sid=value; Path=/');
  saveResponseCookies('source', 'sid=; Max-Age=0');
  expect(sourceCookieHeader('source')).toBe('');
  saveResponseCookies('source', 'next=value');
  clearSourceCookies('source');
  expect(loadSourceCookies('source')).toEqual({});
});

test('merges browser document cookies without treating pairs as attributes', () => {
  saveDocumentCookies('browser', 'sid=one; token=two=parts');
  saveDocumentCookies('browser', 'sid=updated');
  expect(loadSourceCookies('browser')).toEqual({
    sid: 'updated',
    token: 'two=parts',
  });
});

test('injects only the matching source jar into enabled requests', () => {
  saveResponseCookies('https://cookie.example', 'sid=persisted');
  const source: BookSource = {
    bookSourceUrl: 'https://cookie.example',
    bookSourceName: 'Cookie source',
    bookSourceType: 0,
    customOrder: 0,
    enabled: true,
    enabledExplore: false,
    enabledCookieJar: true,
    header: '{"Cookie":"manual=yes"}',
  };
  expect(buildSourceRequest(source, '/search').headers.Cookie).toBe(
    'sid=persisted; manual=yes',
  );
  expect(
    buildSourceRequest(
      { ...source, bookSourceUrl: 'https://other.example' },
      '/search',
    ).headers.Cookie,
  ).toBe('manual=yes');
});
