const mockValues = new Map<string, string>();
jest.mock('../src/data/storage', () => ({
  appStorage: { getString: (key: string) => mockValues.get(key) },
}));
import { buildBookCoverRequest } from '../src/core/bookCoverRequest';
import type { BookSource } from '../src/types';
const source: BookSource = {
  bookSourceUrl: 'https://source.example/source',
  bookSourceName: 'S',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: false,
  enabledCookieJar: true,
  header: '{"Authorization":"source-secret"}',
};
beforeEach(() => {
  mockValues.clear();
  mockValues.set(
    `source-cookie.v1.${encodeURIComponent(source.bookSourceUrl)}`,
    '{"sid":"source-cookie"}',
  );
});
test('native source images and same-origin custom images retain source headers and isolated cookies', () => {
  const book = {
    origin: source.bookSourceUrl,
    coverUrl: 'https://cdn.example/a.jpg',
  };
  expect(buildBookCoverRequest(book.coverUrl, book, [source]).headers).toEqual({
    Authorization: 'source-secret',
    Cookie: 'sid=source-cookie',
  });
  expect(
    buildBookCoverRequest(
      'https://source.example/custom.jpg',
      { ...book, customCoverUrl: 'https://source.example/custom.jpg' },
      [source],
    ).headers,
  ).toEqual({ Authorization: 'source-secret', Cookie: 'sid=source-cookie' });
});
test('cross-origin custom covers discard source credentials but retain explicitly supplied image headers', () => {
  const uri =
    'https://other.example/custom.jpg,{"headers":{"Referer":"https://other.example/"}}';
  expect(
    buildBookCoverRequest(
      uri,
      { origin: source.bookSourceUrl, customCoverUrl: uri },
      [source],
    ),
  ).toEqual({
    uri: 'https://other.example/custom.jpg',
    headers: { Referer: 'https://other.example/' },
  });
});
test('unsupported source image decryption fails explicitly and is not applied to independent custom images', () => {
  const sources = [{ ...source, coverDecodeJs: 'decode(result)' }];
  expect(() =>
    buildBookCoverRequest(
      'https://cdn.example/a',
      { origin: source.bookSourceUrl },
      sources,
    ),
  ).toThrow('JavaScript 封面解密');
  expect(() =>
    buildBookCoverRequest(
      'https://other.example/a',
      {
        origin: source.bookSourceUrl,
        customCoverUrl: 'https://other.example/a',
      },
      sources,
    ),
  ).not.toThrow();
});
