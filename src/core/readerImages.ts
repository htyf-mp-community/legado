export type ReaderImage = { src: string; click?: string };
export type ReaderLink = { text: string; url: string };
export type ReaderHtml = { html: string; baseUrl: string };
const IMAGE_PREFIX = '{{HTYF_IMAGE:',
  LINK_PREFIX = '{{HTYF_LINK:',
  RUBY_PREFIX = '{{HTYF_RUBY:',
  HEADING_PREFIX = '{{HTYF_HEADING:',
  HTML_PREFIX = '{{HTYF_HTML:',
  SUFFIX = '}}';

const attribute = (html: string, name: string) =>
  html.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] ?? '';
const absolute = (value: string, baseUrl: string) => {
  try {
    return new URL(value, baseUrl || undefined).toString();
  } catch {
    return value;
  }
};
export const readerImageMarker = (image: ReaderImage) =>
  `${IMAGE_PREFIX}${encodeURIComponent(JSON.stringify(image))}${SUFFIX}`;
export const readerLinkMarker = (link: ReaderLink) =>
  `${LINK_PREFIX}${encodeURIComponent(JSON.stringify(link))}${SUFFIX}`;
export const readerHtmlMarker = (value: ReaderHtml) =>
  `${HTML_PREFIX}${encodeURIComponent(JSON.stringify(value))}${SUFFIX}`;
const semanticMarker = (prefix: string, value: Record<string, string>) =>
  `${prefix}${encodeURIComponent(JSON.stringify(value))}${SUFFIX}`;
const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

export function readerHtmlToText(value: string, baseUrl = '') {
  const image = (tag: string, click = '') => {
    const src = attribute(tag, 'data-src') || attribute(tag, 'src');
    return src
      ? `\n${readerImageMarker({ src: absolute(decodeEntities(src), baseUrl), click: click ? absolute(decodeEntities(click), baseUrl) : undefined })}\n`
      : '';
  };
  return value
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
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function applyReaderSpecialStylePreference(
  value: string,
  enabled: boolean,
) {
  if (enabled) return value;
  return value.replace(/\{\{HTYF_HTML:([^}]+)\}\}/g, (marker, payload) => {
    try {
      const decoded = JSON.parse(decodeURIComponent(payload)) as ReaderHtml;
      return readerHtmlToText(decoded.html, decoded.baseUrl);
    } catch {
      return marker;
    }
  });
}

export function protectReaderHtmlMarkers(value: string) {
  const entries = new Map<string, string>();
  const text = value.replace(/\{\{HTYF_HTML:[^}]+\}\}/g, marker => {
    let suffix = 0,
      placeholder = `HTYF特殊格式占位${entries.size}。`;
    while (value.includes(placeholder) || entries.has(placeholder))
      placeholder = `HTYF特殊格式占位${entries.size}-${++suffix}。`;
    entries.set(placeholder, marker);
    return placeholder;
  });
  return {
    text,
    restore: (replaced: string) => {
      let result = replaced;
      entries.forEach((marker, placeholder) => {
        result = result.split(placeholder).join(marker);
      });
      return result;
    },
  };
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
    .trim();
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
