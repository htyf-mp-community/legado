import { parseBookSources } from '../data/sources';
import type { BookSource } from '../types';

type FetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

export async function importBookSourcesInput(
  input: string,
  fetcher: (url: string) => Promise<FetchResponse> = fetch,
): Promise<BookSource[]> {
  const value = input.trim();
  if (!value) throw new Error('书源内容为空');
  if (!/^https?:\/\//i.test(value)) return parseBookSources(value);
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('书源地址必须使用 HTTP 或 HTTPS');
  const response = await fetcher(url.toString());
  if (!response.ok) throw new Error(`书源下载失败：HTTP ${response.status}`);
  return parseBookSources(await response.text());
}
