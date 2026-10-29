import type { HttpTts } from '../data/httpTts';
import { buildSourceRequest, type SourceRequest } from './sourceRequest';
import { UnsupportedRuleError } from './errors';
import { readerContentSegments } from './readerImages';

/** Parse arithmetic only; no eval, Function, property access or host globals. */
function arithmetic(expression: string, speed: number): number {
  const input = expression.replace(/\bspeakSpeed\b/g, String(speed));
  if (input.length > 512 || /[^\d.\s()+*/%\-]/.test(input))
    throw new UnsupportedRuleError('TTS JavaScript');
  const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+*/%\-]/g) ?? [];
  let cursor = 0;
  const factor = (): number => {
    const token = tokens[cursor++];
    if (token === '+') return factor();
    if (token === '-') return -factor();
    if (token === '(') {
      const result = sum();
      if (tokens[cursor++] !== ')')
        throw new UnsupportedRuleError('TTS expression');
      return result;
    }
    if (token === undefined || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token))
      throw new UnsupportedRuleError('TTS expression');
    return Number(token);
  };
  const product = (): number => {
    let result = factor();
    while (['*', '/', '%'].includes(tokens[cursor])) {
      const operator = tokens[cursor++],
        next = factor();
      result =
        operator === '*'
          ? result * next
          : operator === '/'
            ? result / next
            : result % next;
    }
    return result;
  };
  const sum = (): number => {
    let result = product();
    while (['+', '-'].includes(tokens[cursor])) {
      const operator = tokens[cursor++],
        next = product();
      result = operator === '+' ? result + next : result - next;
    }
    return result;
  };
  const result = sum();
  if (cursor !== tokens.length || !Number.isFinite(result))
    throw new UnsupportedRuleError('TTS expression');
  return result;
}

/** Small declarative subset used by the bundled Baidu engine; other scripts stay blocked. */
export function httpTtsValue(
  expression: string,
  text: string,
  speed: number,
): string {
  const value = expression.trim();
  if (value.length > 512) throw new UnsupportedRuleError('TTS JavaScript');
  if (value === 'speakText') return text;
  const call = value.match(
    /^(java\.encodeURI|encodeURIComponent|encodeURI|String)\(([\s\S]*)\)$/,
  );
  if (call) {
    const nested = httpTtsValue(call[2], text, speed);
    if (call[1] === 'String') return nested;
    if (call[1] === 'java.encodeURI')
      return encodeURIComponent(nested)
        .replace(
          /[!~'()]/g,
          char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
        )
        .replace(/%20/g, '+');
    return call[1] === 'encodeURI'
      ? encodeURI(nested)
      : encodeURIComponent(nested);
  }
  return String(arithmetic(value, speed));
}

/** Build an Android URL-rule request; reject arbitrary JS before sending any request. */
export function buildHttpTtsRequest(
  engine: HttpTts,
  text: string,
  speed: number,
): SourceRequest {
  // TODO(htyf-native): Full JS/login/library evaluation requires the sandbox in docs/htyf-migration-gaps.md.
  if (
    engine.jsLib?.trim() ||
    engine.loginCheckJs?.trim() ||
    engine.header?.includes('{{') ||
    /@js:|<js>/i.test(engine.url)
  )
    throw new UnsupportedRuleError('HTTP TTS JavaScript', engine.name);
  const render = (input: string) =>
    input.replace(/\{\{([\s\S]*?)\}\}/g, (_all, expression: string) =>
      httpTtsValue(expression, text, speed),
    );
  // Render inside JSON strings with JSON escaping so spoken quotes/newlines cannot alter the request structure.
  const separator = engine.url.search(/,\s*\{/),
    url = separator < 0 ? engine.url : engine.url.slice(0, separator);
  let rule = render(url);
  if (separator >= 0) {
    const options = engine.url.slice(separator + 1);
    let quoted = false,
      escaped = false,
      output = '';
    for (let i = 0; i < options.length; i++) {
      if (options.startsWith('{{', i)) {
        const end = options.indexOf('}}', i + 2);
        if (end < 0) throw new Error('TTS URL 模板无效');
        const value = httpTtsValue(options.slice(i + 2, end), text, speed);
        output += quoted ? JSON.stringify(value).slice(1, -1) : value;
        i = end + 1;
      } else {
        const char = options[i];
        output += char;
        if (!escaped && char === '"') quoted = !quoted;
        escaped = !escaped && char === '\\';
      }
    }
    rule += `,${output}`;
  }
  if (!/^https?:\/\//i.test(rule))
    throw new Error('HTTP TTS 仅支持 HTTP(S) URL');
  return buildSourceRequest(
    {
      bookSourceUrl: `httpTts:${engine.id}`,
      bookSourceName: engine.name,
      bookSourceType: 0,
      customOrder: 0,
      enabled: true,
      enabledExplore: false,
      header: engine.header,
      enabledCookieJar: engine.enabledCookieJar,
    },
    rule,
    '',
    1,
    false,
  );
}

/** Source's paragraph pauses are inserted only between paragraphs, never after the last. */
export function httpTtsPause(
  index: number,
  lastIndex: number,
  milliseconds: number,
) {
  return index < lastIndex
    ? Math.max(0, Math.min(10_000, Math.trunc(milliseconds)))
    : 0;
}

/** Check the server response before writing audio; never feed JSON error bodies to the player. */
export function validateHttpTtsResponse(
  contentType: string | null,
  expected?: string | null,
) {
  const type = (contentType ?? '').split(';')[0].trim();
  if (/^(?:text\/|application\/json$)/i.test(type))
    throw new Error(`TTS 服务器返回非音频内容：${type}`);
  if (type && expected && !new RegExp(`^(?:${expected})$`).test(type))
    throw new Error(`TTS 音频类型不匹配：${type}`);
}

/** iOS AVURLAsset needs a recognized extension even when the audio bytes are valid. */
export function httpTtsAudioExtension(
  contentType: string | null,
  bytes: Uint8Array,
) {
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return 'wav';
  if (ascii(0, 4) === 'fLaC') return 'flac';
  if (ascii(0, 4) === 'OggS') return 'ogg';
  if (ascii(4, 4) === 'ftyp') return 'm4a';
  if (ascii(0, 3) === 'ID3') return 'mp3';
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase();
  const extensions: Record<string, string> = {
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/aac': 'aac',
    'audio/aacp': 'aac',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/flac': 'flac',
    'audio/x-flac': 'flac',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/aiff': 'aiff',
    'audio/x-aiff': 'aiff',
  };
  return extensions[type] ?? 'mp3';
}

/** Strip renderer markers without reading image addresses or HTML implementation details aloud. */
export function readAloudParagraphs(content: string) {
  const plain = readerContentSegments(content)
    .map(segment => {
      if (segment.type === 'text') return segment.text;
      if (segment.type === 'link') return segment.link.text;
      if (segment.type === 'html')
        return segment.html.html.replace(/<[^>]*>/g, '');
      return '';
    })
    .join('');
  return plain
    .replace(
      /\{\{HTYF_(?:RUBY|HEADING):([^}]+)\}\}/g,
      (_all, encoded: string) => {
        try {
          const value = JSON.parse(decodeURIComponent(encoded));
          return String(value.base ?? value.text ?? '');
        } catch {
          return '';
        }
      },
    )
    .split(/\r?\n/)
    .filter(paragraph => paragraph.length > 0);
}

/** Android AppPattern.notReadAloudRegex: punctuation/symbol-only paragraphs are silent. */
export function isSilentReadAloudParagraph(text: string) {
  return !text || /^[\s\p{C}\p{P}\p{Z}\p{S}]+$/u.test(text);
}
