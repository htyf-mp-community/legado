import { readFile, stat } from '@dr.pogodin/react-native-fs';
import { fromByteArray, toByteArray } from 'react-native-quick-base64';
import type { HttpResponse } from 'react-native-nitro-http-server';
import type { Book } from '../types';
import { displayBookCover } from '../core/bookCover';
import { localMediaPath } from '../core/backupMediaPaths';
import { buildBookCoverRequest } from '../core/bookCoverRequest';
import {
  bitmapMime,
  coverThumbnail,
  defaultCoverSources,
  validCoverPng,
  type CoverBitmap,
} from '../core/coverThumbnail';
import { loadSources } from '../data/sources';
import { checkCancelled } from '../core/cancellation';

const MAX_BYTES = 25 * 1024 * 1024;
const binary = (bytes: Uint8Array): ArrayBuffer => {
  const result = new Uint8Array(bytes.length);
  result.set(bytes);
  return result.buffer;
};
const asBitmap = (base64: string): CoverBitmap => {
  const bytes = toByteArray(base64, true);
  if (bytes.byteLength > MAX_BYTES) throw new Error('Cover image is too large');
  const mime = bitmapMime(bytes);
  if (!mime) throw new Error('Unsupported cover bitmap');
  return { base64, mime };
};
const same = (a: string | undefined, b: string) =>
  a === b ||
  Boolean(a && localMediaPath(a) && localMediaPath(a) === localMediaPath(b));
export function requestedWebCover(url: URL, books: Book[]) {
  const id =
    url.searchParams.get('id') ??
    url.searchParams.get('url') ??
    url.searchParams.get('bookUrl');
  const selected = books.find(book => book.id === id || book.bookUrl === id),
    explicit = url.searchParams.get('path');
  const uri = explicit ?? (selected && displayBookCover(selected));
  if (!uri) return;
  const local = localMediaPath(uri);
  const owner =
    selected ??
    books.find(book =>
      [book.persistedCoverUrl, book.customCoverUrl, book.coverUrl].some(value =>
        same(value, uri),
      ),
    );
  const linked =
    owner &&
    [owner.persistedCoverUrl, owner.customCoverUrl, owner.coverUrl].some(
      value => same(value, uri),
    );
  // Never turn /cover into a general filesystem endpoint. Legacy path-only requests still work for known book covers.
  if (local && !linked) return;
  return { uri, local, owner: linked ? owner : undefined };
}
async function thumbnail(uri: string, book?: Book) {
  const local = localMediaPath(uri);
  if (local) {
    const file = await stat(local);
    if (!file.isFile() || file.size > MAX_BYTES)
      throw new Error('Invalid cover file');
    const key = `local:${local}:${file.size}:${file.mtime?.getTime() ?? 0}`;
    return coverThumbnail(key, async signal => {
      const value = await readFile(local, 'base64');
      checkCancelled(signal);
      return asBitmap(value);
    });
  }
  if (/^data:image\/[\w+.-]+;base64,/i.test(uri)) {
    if (uri.length > Math.ceil((MAX_BYTES * 4) / 3) + 256)
      throw new Error('Cover image is too large');
    return coverThumbnail(uri, async () =>
      asBitmap(uri.slice(uri.indexOf(',') + 1)),
    );
  }
  if (!/^https?:\/\//i.test(uri)) throw new Error('Unsupported cover address');
  const context = book
    ? {
        ...book,
        persistedCoverUrl: undefined,
        customCoverUrl: same(book.customCoverUrl, uri)
          ? book.customCoverUrl
          : undefined,
      }
    : {};
  const request = buildBookCoverRequest(
    uri,
    context,
    book ? await loadSources() : [],
    false,
  );
  return coverThumbnail(
    `http:${request.uri}:${JSON.stringify(request.headers)}`,
    async signal => {
      const response = await fetch(request.uri, {
        headers: request.headers,
        signal,
      });
      if (!response.ok) throw new Error(`Cover HTTP ${response.status}`);
      if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES)
        throw new Error('Cover image is too large');
      const bytes = new Uint8Array(await response.arrayBuffer());
      checkCancelled(signal);
      if (bytes.byteLength > MAX_BYTES)
        throw new Error('Cover image is too large');
      return asBitmap(fromByteArray(bytes));
    },
  );
}
export async function webBookCover(
  url: URL,
  books: Book[],
): Promise<HttpResponse> {
  function* candidates() {
    const selected = requestedWebCover(url, books);
    if (selected) yield selected;
    // The theme/default can change while a network image is loading.
    for (const uri of defaultCoverSources()) yield { uri, owner: undefined };
  }
  for (const candidate of candidates()) {
    try {
      const png = toByteArray(
        await thumbnail(candidate.uri, candidate.owner),
        true,
      );
      if (!validCoverPng(png)) throw new Error('Invalid cover thumbnail');
      return {
        statusCode: 200,
        headers: {
          'content-type': 'image/png',
          'cache-control': 'private, no-store',
          'x-content-type-options': 'nosniff',
          'access-control-allow-origin': '*',
        },
        body: binary(png),
      };
    } catch {
      /* Native getCover also falls back to the current default drawable on loading/decoding failure. */
    }
  }
  return {
    statusCode: 502,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    },
    body: JSON.stringify({ isSuccess: false, errorMsg: 'getCover error' }),
  };
}
