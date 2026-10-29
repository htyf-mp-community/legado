import { useEffect, useState } from 'react';
import { appStorage } from '../data/storage';
import { loadSources } from '../data/sources';
import { addAppLog } from '../data/appLog';
import { coverImageUri, type BookCoverLayers } from '../core/bookCover';
import { buildBookCoverRequest } from '../core/bookCoverRequest';
type Request = { uri: string; headers?: Record<string, string> };
export function useBookCoverRequest(
  uri: string | undefined,
  book?: BookCoverLayers,
) {
  const key = JSON.stringify([
      uri,
      book?.origin,
      book?.customCoverUrl,
      book?.persistedCoverUrl,
    ]),
    [revision, setRevision] = useState(0),
    [loaded, setLoaded] = useState<{ key: string; request: Request }>();
  useEffect(() => {
    const listener = appStorage.addOnValueChangedListener(value => {
      if (
        value === 'sources.v1' ||
        value.startsWith('source-cookie.v1.') ||
        value === 'general.preferences.v1'
      )
        setRevision(old => old + 1);
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!uri || !/^https?:\/\//i.test(uri)) return;
    let current = true;
    setLoaded(undefined);
    void loadSources()
      .then(sources => {
        const request = buildBookCoverRequest(uri, book ?? {}, sources);
        if (current)
          setLoaded({
            key,
            request: {
              uri: request.uri,
              ...(Object.keys(request.headers).length
                ? { headers: request.headers }
                : {}),
            },
          });
      })
      .catch(cause => addAppLog('Load book cover request', cause));
    return () => {
      current = false;
    };
  }, [key, revision]);
  if (!uri) return;
  if (!/^https?:\/\//i.test(uri)) return { uri: coverImageUri(uri) };
  return loaded?.key === key ? loaded.request : undefined;
}
