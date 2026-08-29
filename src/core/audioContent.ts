export type AudioSegment = {
  url: string;
  title?: string;
  headers?: Record<string, string>;
};

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());

function fromUnknown(value: unknown): AudioSegment[] {
  if (typeof value === 'string')
    return isHttpUrl(value) ? [{ url: value.trim() }] : [];
  if (Array.isArray(value)) return value.flatMap(fromUnknown);
  if (!value || typeof value !== 'object') return [];
  const item = value as Record<string, unknown>,
    url = String(item.url ?? item.src ?? '').trim();
  if (!isHttpUrl(url)) return [];
  const headers =
    item.headers &&
    typeof item.headers === 'object' &&
    !Array.isArray(item.headers)
      ? Object.fromEntries(
          Object.entries(item.headers as Record<string, unknown>).map(
            ([key, header]) => [key, String(header)],
          ),
        )
      : undefined;
  return [
    {
      url,
      title: String(item.title ?? item.name ?? '').trim() || undefined,
      headers,
    },
  ];
}

export function parseAudioContent(content: string): AudioSegment[] {
  const value = content.trim();
  if (!value) return [];
  try {
    const parsed = fromUnknown(JSON.parse(value));
    if (parsed.length) return deduplicate(parsed);
  } catch {}
  const audioTags = [
    ...value.matchAll(/<audio[^>]+src=["']([^"']+)["']/gi),
  ].map(match => ({ url: match[1] }));
  if (audioTags.length)
    return deduplicate(audioTags.filter(item => isHttpUrl(item.url)));
  const urls = value
    .split(/[\r\n]+/)
    .flatMap(line => line.match(/https?:\/\/[^\s"'<>]+/gi) ?? [])
    .map(url => ({ url: url.replace(/[),，。]+$/, '') }));
  return deduplicate(urls);
}

function deduplicate(segments: AudioSegment[]) {
  return [...new Map(segments.map(segment => [segment.url, segment])).values()];
}

export function formatAudioTime(seconds: number) {
  const safe = Math.max(0, Number.isFinite(seconds) ? Math.floor(seconds) : 0),
    hours = Math.floor(safe / 3600),
    minutes = Math.floor((safe % 3600) / 60),
    rest = safe % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`;
}
