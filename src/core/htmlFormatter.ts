import { resolveNativeResourceUrl } from './nativeSourceUrl';
/** HTML4 named entities; XML-only apos and HTML5-only names remain literal. */
const html4Entities: Record<string, number> = {
  AElig: 198,
  Aacute: 193,
  Acirc: 194,
  Agrave: 192,
  Alpha: 913,
  Aring: 197,
  Atilde: 195,
  Auml: 196,
  Beta: 914,
  Ccedil: 199,
  Chi: 935,
  Dagger: 8225,
  Delta: 916,
  ETH: 208,
  Eacute: 201,
  Ecirc: 202,
  Egrave: 200,
  Epsilon: 917,
  Eta: 919,
  Euml: 203,
  Gamma: 915,
  Iacute: 205,
  Icirc: 206,
  Igrave: 204,
  Iota: 921,
  Iuml: 207,
  Kappa: 922,
  Lambda: 923,
  Mu: 924,
  Ntilde: 209,
  Nu: 925,
  OElig: 338,
  Oacute: 211,
  Ocirc: 212,
  Ograve: 210,
  Omega: 937,
  Omicron: 927,
  Oslash: 216,
  Otilde: 213,
  Ouml: 214,
  Phi: 934,
  Pi: 928,
  Prime: 8243,
  Psi: 936,
  Rho: 929,
  Scaron: 352,
  Sigma: 931,
  THORN: 222,
  Tau: 932,
  Theta: 920,
  Uacute: 218,
  Ucirc: 219,
  Ugrave: 217,
  Upsilon: 933,
  Uuml: 220,
  Xi: 926,
  Yacute: 221,
  Yuml: 376,
  Zeta: 918,
  aacute: 225,
  acirc: 226,
  acute: 180,
  aelig: 230,
  agrave: 224,
  alefsym: 8501,
  alpha: 945,
  amp: 38,
  and: 8743,
  ang: 8736,
  aring: 229,
  asymp: 8776,
  atilde: 227,
  auml: 228,
  bdquo: 8222,
  beta: 946,
  brvbar: 166,
  bull: 8226,
  cap: 8745,
  ccedil: 231,
  cedil: 184,
  cent: 162,
  chi: 967,
  circ: 710,
  clubs: 9827,
  cong: 8773,
  copy: 169,
  crarr: 8629,
  cup: 8746,
  curren: 164,
  dArr: 8659,
  dagger: 8224,
  darr: 8595,
  deg: 176,
  delta: 948,
  diams: 9830,
  divide: 247,
  eacute: 233,
  ecirc: 234,
  egrave: 232,
  empty: 8709,
  emsp: 8195,
  ensp: 8194,
  epsilon: 949,
  equiv: 8801,
  eta: 951,
  eth: 240,
  euml: 235,
  euro: 8364,
  exist: 8707,
  fnof: 402,
  forall: 8704,
  frac12: 189,
  frac14: 188,
  frac34: 190,
  frasl: 8260,
  gamma: 947,
  ge: 8805,
  gt: 62,
  hArr: 8660,
  harr: 8596,
  hearts: 9829,
  hellip: 8230,
  iacute: 237,
  icirc: 238,
  iexcl: 161,
  igrave: 236,
  image: 8465,
  infin: 8734,
  int: 8747,
  iota: 953,
  iquest: 191,
  isin: 8712,
  iuml: 239,
  kappa: 954,
  lArr: 8656,
  lambda: 955,
  lang: 9001,
  laquo: 171,
  larr: 8592,
  lceil: 8968,
  ldquo: 8220,
  le: 8804,
  lfloor: 8970,
  lowast: 8727,
  loz: 9674,
  lrm: 8206,
  lsaquo: 8249,
  lsquo: 8216,
  lt: 60,
  macr: 175,
  mdash: 8212,
  micro: 181,
  middot: 183,
  minus: 8722,
  mu: 956,
  nabla: 8711,
  nbsp: 160,
  ndash: 8211,
  ne: 8800,
  ni: 8715,
  not: 172,
  notin: 8713,
  nsub: 8836,
  ntilde: 241,
  nu: 957,
  oacute: 243,
  ocirc: 244,
  oelig: 339,
  ograve: 242,
  oline: 8254,
  omega: 969,
  omicron: 959,
  oplus: 8853,
  or: 8744,
  ordf: 170,
  ordm: 186,
  oslash: 248,
  otilde: 245,
  otimes: 8855,
  ouml: 246,
  para: 182,
  part: 8706,
  permil: 8240,
  perp: 8869,
  phi: 966,
  pi: 960,
  piv: 982,
  plusmn: 177,
  pound: 163,
  prime: 8242,
  prod: 8719,
  prop: 8733,
  psi: 968,
  quot: 34,
  rArr: 8658,
  radic: 8730,
  rang: 9002,
  raquo: 187,
  rarr: 8594,
  rceil: 8969,
  rdquo: 8221,
  real: 8476,
  reg: 174,
  rfloor: 8971,
  rho: 961,
  rlm: 8207,
  rsaquo: 8250,
  rsquo: 8217,
  sbquo: 8218,
  scaron: 353,
  sdot: 8901,
  sect: 167,
  shy: 173,
  sigma: 963,
  sigmaf: 962,
  sim: 8764,
  spades: 9824,
  sub: 8834,
  sube: 8838,
  sum: 8721,
  sup: 8835,
  sup1: 185,
  sup2: 178,
  sup3: 179,
  supe: 8839,
  szlig: 223,
  tau: 964,
  there4: 8756,
  theta: 952,
  thetasym: 977,
  thinsp: 8201,
  thorn: 254,
  tilde: 732,
  times: 215,
  trade: 8482,
  uArr: 8657,
  uacute: 250,
  uarr: 8593,
  ucirc: 251,
  ugrave: 249,
  uml: 168,
  upsih: 978,
  upsilon: 965,
  uuml: 252,
  weierp: 8472,
  xi: 958,
  yacute: 253,
  yen: 165,
  yuml: 255,
  zeta: 950,
  zwj: 8205,
  zwnj: 8204,
};

// Kotlin Regex uses Java's ASCII whitespace unless UNICODE_CHARACTER_CLASS is
// requested. JS \s includes NBSP/full-width spaces and changes native output.
const asciiSpace = '[\\t\\n\\x0B\\f\\r ]';
const nativeRegex = (pattern: string, flags = 'g') =>
  new RegExp(pattern.replace(/\\s/g, asciiSpace), flags);
const imagePattern = nativeRegex(
  String.raw`<img[^>]*\ssrc\s*=\s*['"]([^'"{>]*\{(?:[^{}]|\{[^}>]+\})+\})['"][^>]*>|<img[^>]*\sdata-(?:src|original|srcset)\s*=\s*['"]([^'">]+)['"][^>]*>|<img[^>]*\ssrc\s*=\s*"([^">]+)"[^>]*>|<img[^>]*\s(?:data-[^=>]*|src)=\s*['"]([^'">]*)['"][^>]*>`,
  'gi',
);

/** Decode one Apache Commons Text unescapeHtml4 pass, after tag cleanup. */
export function unescapeSourceHtml4(value: string): string {
  return value.replace(/&(?:([A-Za-z][A-Za-z0-9]+)|#([xX][0-9a-fA-F]+|[0-9]+));/g,
    (entity, name: string | undefined, numeric: string | undefined) => {
      if (name) {
        return Object.hasOwn(html4Entities, name)
          ? String.fromCodePoint(html4Entities[name])
          : entity;
      }
      const code = /^[xX]/.test(numeric!)
        ? Number.parseInt(numeric!.slice(1), 16)
        : Number.parseInt(numeric!, 10);
      // NumericEntityUnescaper ignores values that do not fit Java's int.
      if (code > 0x7fffffff) return entity;
      return String.fromCodePoint(code);
    });
}

/**
 * Source HtmlFormatter text cleanup, including its case-sensitive tag regexes
 * and ASCII whitespace. The result is a stored source value, not display text;
 * full-width indentation and trailing indented lines must survive this stage.
 */
export function formatSourceHtml(
  value: string | null | undefined,
  mode: 'format' | 'intro' | 'keepImg' = 'format',
  baseUrl = '',
): string {
  if (value == null) return '';
  const indent = mode === 'intro' ? '' : '　　';
  const result = value
    .replace(/(&nbsp;)+/g, ' ')
    .replace(/(&ensp;|&emsp;)/g, ' ')
    .replace(/(&thinsp;|&zwnj;|&zwj;|\u2009|\u200c|\u200d)/g, '')
    .replace(/<\/?(?:div|p|br|hr|h\d|article|dd|dl)[^>]*>/g, '\n')
    .replace(/<!--[^>]*-->/g, '')
    .replace(mode === 'keepImg'
      ? /<\/?(?!img)[a-zA-Z]+(?=[ >])[^<>]*>/g
      : /<\/?[a-zA-Z]+(?=[ >])[^<>]*>/g, '')
    .replace(nativeRegex(String.raw`\s*\n+\s*`), `\n${indent}`)
    .replace(/^[\n\t\x0b\f\r ]+/g, indent)
    .replace(/[\n\t\x0b\f\r ]+$/g, '');
  if (mode !== 'keepImg') return result;
  return result.replace(imagePattern, (_tag, options: string | undefined,
    lazy: string | undefined, quoted: string | undefined, generic: string | undefined) => {
    let src = options ?? lazy ?? quoted ?? generic ?? '', param = '';
    if (options !== undefined) {
      const separator = nativeRegex(String.raw`\s*,\s*(?=\{)`).exec(src);
      if (separator) {
        param = ',' + src.slice(separator.index + separator[0].length);
        src = src.slice(0, separator.index);
      }
    }
    return `<img src="${resolveNativeResourceUrl(src, baseUrl) + param}">`;
  });
}


/**
 * Online BookContent cleanup order: optionally shield usehtml, formatKeepImg,
 * one HTML4 unescape, then restore raw usehtml. No final trim is performed.
 */
export function formatSourceChapter(value: string, baseUrl = '', adaptSpecialStyle = true): string {
  const html = new Map<string, string>();
  const shielded = adaptSpecialStyle ? value.replace(/<usehtml>[\s\S]*?<\/usehtml>/g, match => {
    const placeholder = `{usehtml_${html.size}}`;
    html.set(placeholder, match);
    return placeholder;
  }) : value;
  let result = unescapeSourceHtml4(formatSourceHtml(shielded, 'keepImg', baseUrl));
  html.forEach((original, placeholder) => { result = result.split(placeholder).join(original); });
  return result;
}

/** ContentProcessor's final paragraph pass, with the configured reader indent. */
export function formatReaderParagraphs(value: string, indent: string): string {
  return value.split(/\r\n|\r|\n/)
    .map(line => line.replace(/^[\x00-\x20\u3000]+|[\x00-\x20\u3000]+$/g, ''))
    .filter(line => line.length > 0)
    .map(line => indent + line)
    .join('\n');
}
