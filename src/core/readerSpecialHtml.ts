export function sanitizeReaderSpecialHtml(value: string) {
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /<(script|iframe|object|embed|form|input|button|textarea|select|meta)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      '',
    )
    .replace(
      /<(script|iframe|object|embed|form|input|button|textarea|select|meta)\b[^>]*\/?\s*>/gi,
      '',
    )
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi,
      ' $1="#"',
    )
    .replace(/\s+(href|src)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"');
}

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function readerSpecialHtmlDocument(
  html: string,
  baseUrl: string,
  appearance: {
    color: string;
    fontSize: number;
    lineHeight: number;
    background: string;
  },
) {
  const base = /^(?:https?|file):/i.test(baseUrl)
    ? `<base href="${escapeAttribute(baseUrl)}">`
    : '';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${base}<style>html,body{margin:0;padding:0;background:${appearance.background};color:${appearance.color};font-size:${appearance.fontSize}px;line-height:${appearance.lineHeight}px;overflow:hidden;overflow-wrap:anywhere}img,video,table{max-width:100%;height:auto}a{color:inherit;text-decoration:underline}pre{white-space:pre-wrap}*{box-sizing:border-box}</style></head><body>${sanitizeReaderSpecialHtml(html)}</body></html>`;
}

export const readerSpecialHtmlHeightScript = `
(function(){
  var send=function(){
    var body=document.body,root=document.documentElement;
    var height=Math.max(body?body.scrollHeight:0,root?root.scrollHeight:0);
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'height',height:Math.ceil(height)}));
  };
  if(window.ResizeObserver&&document.body){new ResizeObserver(send).observe(document.body);}
  window.addEventListener('load',send);setTimeout(send,0);setTimeout(send,250);
})();true;
`;

export function boundedSpecialHtmlHeight(value: unknown) {
  const height = Number(value);
  return Number.isFinite(height)
    ? Math.max(24, Math.min(12_000, Math.ceil(height)))
    : undefined;
}
