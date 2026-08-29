export function normalizeBrowserInput(input: string): string {
  const value = input.trim();
  if (!value) return 'about:blank';
  if (/^(https?:|about:)/i.test(value)) return value;
  if (/^[\w.-]+(?::\d+)?(?:\/.*)?$/i.test(value) && value.includes('.')) {
    return `https://${value}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

export function isBrowserNavigationAllowed(url: string): boolean {
  return /^(https?:|about:blank$)/i.test(url);
}

export function isExternalBrowserScheme(url: string): boolean {
  return /^(?:mailto:|tel:|sms:|geo:|intent:|market:|legado:|yuedu:)/i.test(url);
}

export function browserDownloadName(url: string, disposition = '') {
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ?? disposition.match(/filename="?([^";]+)"?/i)?.[1];
  if (encoded) { try { return decodeURIComponent(encoded); } catch { return encoded; } }
  try { const name = new URL(url).pathname.split('/').filter(Boolean).pop(); return name ? decodeURIComponent(name) : 'web-download'; } catch { return 'web-download'; }
}
