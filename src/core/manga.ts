export function parseMangaImages(content: string, baseUrl = '') {
  const html = [...content.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi)].map(match => match[1]);
  const raw = html.length ? html : content.split(/[\n,]+/).map(item => item.trim()).filter(item => /^(?:https?:\/\/|\/|\.\/|data:image\/)/i.test(item));
  const unique = [...new Set(raw)];
  return unique.map(value => { try { return new URL(value, baseUrl || undefined).toString(); } catch { return value; } });
}
