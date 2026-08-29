import {
  boundedSpecialHtmlHeight,
  readerSpecialHtmlDocument,
  sanitizeReaderSpecialHtml,
} from '../src/core/readerSpecialHtml';

describe('reader special HTML safety and layout', () => {
  test('removes executable and interactive source markup but keeps formatting', () => {
    const clean = sanitizeReaderSpecialHtml(
      '<style>b{color:red}</style><script>alert(1)</script><form><input></form><b onclick="steal()">正文</b><a href="javascript:steal()">链接</a>',
    );
    expect(clean).toContain('<style>b{color:red}</style>');
    expect(clean).toContain('<b>正文</b>');
    expect(clean).not.toMatch(/script|onclick|<form|<input|javascript:/i);
    expect(
      sanitizeReaderSpecialHtml('<a href=javascript:steal()>坏链接</a>'),
    ).not.toMatch(/javascript:/i);
  });
  test('wraps source HTML with bounded reader appearance and a safe base URL', () => {
    const document = readerSpecialHtmlDocument(
      '<img src="cover.jpg"><p>正文</p>',
      'https://books.example/chapter/1',
      { color: '#111111', fontSize: 20, lineHeight: 32, background: '#ffffff' },
    );
    expect(document).toContain('<base href="https://books.example/chapter/1">');
    expect(document).toContain('font-size:20px');
    expect(document).toContain('line-height:32px');
    expect(document).toContain('<img src="cover.jpg">');
  });
  test('bounds measured WebView heights and rejects invalid messages', () => {
    expect(boundedSpecialHtmlHeight(1)).toBe(24);
    expect(boundedSpecialHtmlHeight(200)).toBe(200);
    expect(boundedSpecialHtmlHeight(99_999)).toBe(12_000);
    expect(boundedSpecialHtmlHeight('bad')).toBeUndefined();
  });
});
