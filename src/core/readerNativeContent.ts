import {
  readerHtmlMarker,
  readerImageMarker,
  type ReaderHtml,
  type ReaderImage,
} from './readerImages';

/** Recover source-visible bytes from the existing target cache without rewriting it. */
export function decodeReaderContent(value: string, fallbackBaseUrl = '') {
  const images = new Map<string, ReaderImage>();
  const htmlBases = new Map<string, string>();
  let content = '', cursor = 0, baseUrl = fallbackBaseUrl, hasHtmlBase = false;
  for (const match of value.matchAll(/\{\{HTYF_(HTML|IMAGE):([^}]+)\}\}/g)) {
    let prefix = value.slice(cursor, match.index);
    let replacement = match[0];
    let next = match.index + match[0].length;
    try {
      const decoded = JSON.parse(decodeURIComponent(match[2]));
      if (match[1] === 'HTML' && typeof decoded?.html === 'string') {
        const html = decoded as ReaderHtml;
        replacement = `<usehtml>${html.html}</usehtml>`;
        // formattedSourceToReaderContent inserts exactly one LF on each side.
        if (html.sourceFormatted === true) {
          if (prefix.endsWith('\n')) prefix = prefix.slice(0, -1);
          if (value[next] === '\n') next++;
        }
        if (typeof html.baseUrl === 'string') {
          htmlBases.set(html.html, html.baseUrl);
          if (!hasHtmlBase) { baseUrl = html.baseUrl; hasHtmlBase = true; }
        }
      } else if (match[1] === 'IMAGE' && typeof decoded?.src === 'string') {
        const image = decoded as ReaderImage;
        replacement = `<img src="${image.src}">`;
        images.set(image.src, image);
      }
    } catch { /* Malformed existing markers remain literal reader text. */ }
    content += prefix + replacement;
    cursor = next;
  }
  return { content: content + value.slice(cursor), baseUrl, images, htmlBases };
}

/** Exact ContentProcessor placeholders, LF removal and sequential literal restoration. */
export function protectNativeReaderHtml(value: string, enabled: boolean) {
  const entries = new Map<string, string>();
  const text = enabled ? value.replace(/<usehtml>[\s\S]*?<\/usehtml>/g, original => {
    const placeholder = `特殊格式的占位不应该被看见${entries.size}。`;
    entries.set(placeholder, `\n${original.replace(/\n/g, '')}\n`);
    return placeholder;
  }) : value;
  return {
    text,
    restore: (replaced: string) => {
      let result = replaced;
      entries.forEach((original, placeholder) => { result = result.split(placeholder).join(original); });
      return result;
    },
  };
}

/** Adapt only after ContentProcessor's paragraph pass, using TextChapterLayout's entry checks. */
export function renderNativeReaderContent(
  value: string,
  context: ReturnType<typeof decodeReaderContent>,
  adaptSpecialStyle: boolean,
) {
  return value.split('\n').map(line => {
    const text = line.replace(/^[\t-\r\x1C-\x20\p{Zs}\u2028\u2029]+|[\t-\r\x1C-\x20\p{Zs}\u2028\u2029]+$/gu, '');
    if (adaptSpecialStyle && text.startsWith('<usehtml>')) {
      const end = text.lastIndexOf('<');
      if (end > 9) {
        const html = text.slice(9, end);
        return readerHtmlMarker({ html, baseUrl: context.htmlBases.get(html) ?? context.baseUrl, sourceFormatted: true });
      }
    }
    // AppPattern.imgPattern is case sensitive and recognises double-quoted src.
    return line.replace(/<img[^>]*src="([^"]*(?:"[^>]+\})?)"[^>]*>/g, (_tag, src: string) =>
      readerImageMarker(context.images.get(src) ?? { src }));
  }).join('\n');
}
