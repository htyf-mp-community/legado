import iconv from 'iconv-lite';
import { parseFragment, html } from 'parse5';
import { adapter } from 'parse5-htmlparser2-tree-adapter';
import { isTag, type AnyNode } from 'domhandler';
import { detectSourceCharset } from './sourceCharset';
import { SourceRuleError } from './errors';
import { canDecodeSourceCharset, decodeSourceCharset } from './sourceCharsetDecode';

const openHead = new Uint8Array([60, 104, 101, 97, 100, 62]);
const closeHead = new Uint8Array([60, 47, 104, 101, 97, 100, 62]);
const byteIndex = (bytes: Uint8Array, pattern: Uint8Array, start = 0) => {
  scan: for (let i = start; i <= bytes.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) if (bytes[i + j] !== pattern[j]) continue scan;
    return i;
  }
  return -1;
};

/** EncodingDetect.getHtmlEncode: strict head scan, UTF-8 regex fallback, then ICU. */
export function sourceHtmlCharset(bytes: Uint8Array) {
  let head: string | undefined;
  const start = byteIndex(bytes, openHead), end = start < 0 ? -1 : byteIndex(bytes, closeHead, start);
  if (end >= 0) head = iconv.decode(bytes.subarray(start, end + closeHead.length), 'UTF-8', { stripBOM: false });
  else head = /<head>[\s\S]*?<\/head>/i.exec(iconv.decode(bytes, 'UTF-8', { stripBOM: false }))?.[0];
  if (head !== undefined) {
    const document = parseFragment(adapter.createElement('body', html.NS.HTML, []), head, { treeAdapter: adapter, scriptingEnabled: false });
    const visit = (node: AnyNode): string | undefined => {
      if (isTag(node) && node.name === 'meta') {
        const charset = node.attribs.charset;
        if (charset) return charset;
        if (node.attribs['http-equiv']?.toLowerCase() === 'content-type') {
          const content = node.attribs.content ?? '', index = content.toLowerCase().indexOf('charset=');
          const value = index >= 0 ? content.slice(index + 8) : content.slice(content.indexOf(';') + 1);
          if (value) return value;
        }
      }
      if ('children' in node) for (const child of node.children) { const value = visit(child); if (value !== undefined) return value; }
      return undefined;
    };
    const declared = visit(document);
    if (declared !== undefined) return declared;
  }
  return detectSourceCharset(bytes);
}

/** OkHttp MediaType charset parsing, including invalid-header fallback and first parameter. */
export function sourceHeaderCharset(contentType?: string | null) {
  if (!contentType) return undefined;
  const token = "[a-zA-Z0-9-!#$%&'*+.^_`{|}~]+";
  const first = new RegExp(`^(${token})/(${token})`).exec(contentType);
  if (!first) return undefined;
  const parameter = new RegExp(`;[\\t\\n\\v\\f\\r ]*(?:(${token})=(?:(${token})|"([^"]*)"))?`, 'y');
  let offset = first[0].length, charset: string | undefined;
  while (offset < contentType.length) {
    parameter.lastIndex = offset;
    const match = parameter.exec(contentType);
    if (!match) return undefined;
    offset = parameter.lastIndex;
    if (match[1]?.toLowerCase() === 'charset' && charset === undefined) {
      let value = match[2] ?? match[3];
      if (match[2] && value.length > 2 && value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      charset = value;
    }
  }
  return charset && canDecodeSourceCharset(charset) ? charset : undefined;
}

export function decodeSourceResponse(input: Uint8Array, contentType?: string | null) {
  const bytes = input.length > 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf ? input.subarray(3) : input;
  const charset = sourceHeaderCharset(contentType) ?? sourceHtmlCharset(bytes);
  if (!canDecodeSourceCharset(charset)) throw new SourceRuleError(`不支持的响应字符集: ${charset}`);
  return decodeSourceCharset(bytes, charset);
}
