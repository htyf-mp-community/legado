import { resolveNativeResourceUrl } from './nativeSourceUrl';
export type ReaderImage = { src: string; click?: string };
export type ReaderLink = { text: string; url: string };
export type ReaderHtml = { html: string; baseUrl: string; sourceFormatted?: boolean };
const IMAGE_PREFIX = '{{HTYF_IMAGE:',
  LINK_PREFIX = '{{HTYF_LINK:',
  RUBY_PREFIX = '{{HTYF_RUBY:',
  HEADING_PREFIX = '{{HTYF_HEADING:',
  HTML_PREFIX = '{{HTYF_HTML:',
  SUFFIX = '}}';

const attribute = (html: string, name: string) =>
  html.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] ?? '';
const absolute = (value: string, baseUrl: string) => {
  const resolved = resolveNativeResourceUrl(value, baseUrl);
  // Extracted EPUB assets keep the iOS/RN filesystem URI contract.
  return resolved.replace(/^file:\/(?!\/)/i, 'file:///');
};
export const readerImageMarker = (image: ReaderImage) =>
  `${IMAGE_PREFIX}${encodeURIComponent(JSON.stringify(image))}${SUFFIX}`;
export const readerLinkMarker = (link: ReaderLink) =>
  `${LINK_PREFIX}${encodeURIComponent(JSON.stringify(link))}${SUFFIX}`;
export const readerHtmlMarker = (value: ReaderHtml) =>
  `${HTML_PREFIX}${encodeURIComponent(JSON.stringify(value))}${SUFFIX}`;
const semanticMarker = (prefix: string, value: Record<string, string>) =>
  `${prefix}${encodeURIComponent(JSON.stringify(value))}${SUFFIX}`;
const decodeEntitiesOnce = (value: string) =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    );
const decodeEntities = (value: string) => {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decodeEntitiesOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
};

export function readerHtmlToText(value: string, baseUrl = '') {
  // Ignore native serializer indentation before creating semantic markers;
  // usehtml payloads retain their original formatting and marker boundaries.
  const formatted = value
    .split(/(<usehtml>[\s\S]*?<\/usehtml>)/gi)
    .map(part => /^<usehtml>/i.test(part) ? part : part
      .replace(/[ \t\r\n]*(<\/?(?:div|p|hr|article|dd|dl)\b[^>]*>)[ \t\r\n]*/gi, '$1')
      .replace(/[ \t\r\n]*(<br\s*\/?\s*>)[ \t\r\n]*/gi, '$1'))
    .join('');
  const image = (tag: string, click = '') => {
    const src = attribute(tag, 'data-src') || attribute(tag, 'src');
    return src
      ? `\n${readerImageMarker({ src: absolute(decodeEntities(src), baseUrl), click: click ? absolute(decodeEntities(click), baseUrl) : undefined })}\n`
      : '';
  };
  return decodeEntities(formatted)
    .replace(
      /<usehtml>([\s\S]*?)<\/usehtml>/gi,
      (_all, html: string) =>
        `\n${readerHtmlMarker({ html, baseUrl })}\n`,
    )
    .replace(/<ruby\b[^>]*>([\s\S]*?)<\/ruby>/gi, (_all, body: string) => {
      const annotations = [...body.matchAll(/<rt\b[^>]*>([\s\S]*?)<\/rt>/gi)]
          .map(match => decodeEntities(match[1].replace(/<[^>]+>/g, '')).trim())
          .filter(Boolean),
        base = decodeEntities(
          body
            .replace(/<r[tp]\b[^>]*>[\s\S]*?<\/r[tp]>/gi, '')
            .replace(/<[^>]+>/g, ''),
        ).trim();
      return base
        ? semanticMarker(RUBY_PREFIX, {
            base,
            annotation: annotations.join(' '),
          })
        : '';
    })
    .replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_all, body: string) => {
      const text = decodeEntities(body.replace(/<[^>]+>/g, '')).trim();
      return text ? `\n${semanticMarker(HEADING_PREFIX, { text })}\n` : '';
    })
    .replace(
      /<a\b([^>]*)>\s*(<img\b[^>]*>)\s*<\/a>/gi,
      (_all, link: string, tag: string) => image(tag, attribute(link, 'href')),
    )
    .replace(/<img\b[^>]*>/gi, tag => image(tag))
    .replace(
      /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
      (_all, attributes: string, body: string) => {
        const href = attribute(attributes, 'href'),
          text = decodeEntities(body.replace(/<[^>]+>/g, '')).trim();
        return href && text
          ? readerLinkMarker({
              text,
              url: absolute(decodeEntities(href), baseUrl),
            })
          : text;
      },
    )
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39|#x[0-9a-f]+|#\d+);/gi, entity =>
      decodeEntities(entity),
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Adapt already formatted online content to atomic reader segments. Ordinary
 * text is left verbatim: entities have already been decoded once by the source
 * formatter, so a decoded <b> literal must not be parsed/deleted a second time.
 */
export function formattedSourceToReaderContent(value: string, baseUrl = '') {
  return value.split(/(<usehtml>[\s\S]*?<\/usehtml>)/g).map(part => {
    if (part.startsWith('<usehtml>') && part.endsWith('</usehtml>')) {
      return `\n${readerHtmlMarker({ html: part.slice(9, -10), baseUrl, sourceFormatted: true })}\n`;
    }
    return part.replace(/<img src="([\s\S]*?)">/g, (_tag, src: string) => readerImageMarker({ src }));
  }).join('');
}

export function applyReaderTagPreferences(
  value: string,
  deleteRubyTag = false,
  deleteHeadingTag = false,
) {
  return value
    .replace(/\{\{HTYF_RUBY:([^}]+)\}\}/g, (marker, payload: string) => {
      try {
        const ruby = JSON.parse(decodeURIComponent(payload)) as {
          base?: string;
          annotation?: string;
        };
        if (!ruby.base) return marker;
        return deleteRubyTag || !ruby.annotation
          ? ruby.base
          : `${ruby.base}(${ruby.annotation})`;
      } catch {
        return marker;
      }
    })
    .replace(/\{\{HTYF_HEADING:([^}]+)\}\}/g, (marker, payload: string) => {
      try {
        const heading = JSON.parse(decodeURIComponent(payload)) as {
          text?: string;
        };
        if (!heading.text) return marker;
        return deleteHeadingTag ? '' : heading.text;
      } catch {
        return marker;
      }
    })
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[\x00-\x20\u3000]+|[\x00-\x20\u3000]+$/g, '');
}

export type ReaderContentSegment =
  | { type: 'text'; text: string }
  | { type: 'image'; image: ReaderImage }
  | { type: 'link'; link: ReaderLink }
  | { type: 'html'; html: ReaderHtml };

export function readerContentSegments(value: string): ReaderContentSegment[] {
  const result: ReaderContentSegment[] = [];
  let cursor = 0;
  for (const match of value.matchAll(
    /\{\{HTYF_(IMAGE|LINK|HTML):([^}]+)\}\}/g,
  )) {
    if (match.index! > cursor)
      result.push({ type: 'text', text: value.slice(cursor, match.index) });
    try {
      if (match[1] === 'IMAGE') {
        const image = JSON.parse(decodeURIComponent(match[2])) as ReaderImage;
        if (image.src) result.push({ type: 'image', image });
        else result.push({ type: 'text', text: match[0] });
      } else if (match[1] === 'LINK') {
        const link = JSON.parse(decodeURIComponent(match[2])) as ReaderLink;
        if (link.text && link.url) result.push({ type: 'link', link });
        else result.push({ type: 'text', text: match[0] });
      } else {
        const html = JSON.parse(decodeURIComponent(match[2])) as ReaderHtml;
        if (html.html) result.push({ type: 'html', html });
        else result.push({ type: 'text', text: match[0] });
      }
    } catch {
      result.push({ type: 'text', text: match[0] });
    }
    cursor = match.index! + match[0].length;
  }
  if (cursor < value.length)
    result.push({ type: 'text', text: value.slice(cursor) });
  return result.length ? result : [{ type: 'text', text: value }];
}

export function readerMarkerRangeAt(value: string, offset: number) {
  for (const prefix of [IMAGE_PREFIX, LINK_PREFIX, HTML_PREFIX]) {
    const start = value.lastIndexOf(prefix, offset),
      end = start >= 0 ? value.indexOf(SUFFIX, start) : -1;
    if (start >= 0 && end >= offset) return { start, end: end + SUFFIX.length };
  }
  return undefined;
}
