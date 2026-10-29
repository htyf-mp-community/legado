/** Resolve PROPFIND hrefs without RN URL's nonstandard relative constructor. */
export function webDavBackupHref(href: string, directoryUrl: string) {
  const root = new URL(directoryUrl),
    value = href.trim();
  const absolute = /^[a-z][a-z\d+.-]*:/i.test(value)
    ? value
    : value.startsWith('//')
      ? root.protocol + value
      : value.startsWith('/')
        ? root.origin + value
        : directoryUrl + value;
  const parsed = new URL(absolute),
    parts: string[] = [];
  for (const part of parsed.pathname.split('/')) {
    const dot = part.replace(/%2e/gi, '.');
    if (dot === '.') continue;
    if (dot === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return new URL(
    `${parsed.origin}${parts.join('/') || '/'}${parsed.search}${parsed.hash}`,
  );
}
