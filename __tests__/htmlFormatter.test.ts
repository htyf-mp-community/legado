import {
  formatSourceChapter,
  formatSourceHtml,
  formatReaderParagraphs,
  unescapeSourceHtml4,
} from '../src/core/htmlFormatter';
import native from './fixtures/contentFormat.native.json';
import { compileSourceRegex } from '../src/core/sourceRegex';

describe('native HTML formatter contract', () => {
  test('matches every output from the unchanged Kotlin formatter and HTML4 decoder', () => {
    const mismatches = native.cases.flatMap((row, index) => {
      const value = row.mode === 'web' || row.mode === 'webSpecial'
        ? formatSourceChapter(row.html ?? '', row.baseUrl, row.mode === 'webSpecial')
        : row.mode === 'paragraphs'
          ? formatReaderParagraphs(row.html ?? '', '　　')
          : row.mode === 'replace'
            ? (row.html ?? '').replace(compileSourceRegex(row.pattern!), row.replacement!)
            : formatSourceHtml(row.html, row.mode as 'format' | 'intro' | 'keepImg', row.baseUrl);
      return value === row.value ? [] : [{ index, mode: row.mode, html: row.html, expected: row.value, actual: value }];
    });
    expect(mismatches).toEqual([]);
  });
  test('keeps decoded tag literals and limits HTML entity decoding to one pass', () => {
    expect(formatSourceChapter('&lt;b&gt;x&lt;/b&gt; &amp;lt; &apos; &NotEqualTilde;')).toBe(
      '<b>x</b> &lt; &apos; &NotEqualTilde;',
    );
    expect(unescapeSourceHtml4('&constructor; &toString; &#128;')).toBe('&constructor; &toString; \x80');
  });
  test('preserves protected rich HTML until the reader preference is applied', () => {
    const raw = '<usehtml><p>A\nB</p><img src="/a.png"></usehtml>';
    expect(formatSourceChapter(raw)).toBe(raw);
    expect(formatSourceChapter(raw, '', false)).toBe(formatSourceChapter(raw.slice(9, -10), '', false));
  });
  test('applies configured indentation to each nonempty native paragraph', () => {
    expect(formatReaderParagraphs('　　　　A\n　　B\n　　', '  ')).toBe('  A\n  B');
    expect(formatReaderParagraphs('A\r\n B\r\n\nC', '')).toBe('A\nB\nC');
    expect(formatReaderParagraphs('\u00a0A\u00a0\n\ufeffB', '')).toBe('\u00a0A\u00a0\n\ufeffB');
  });
});
