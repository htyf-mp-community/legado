import {
  applyReaderSpecialStylePreference,
  protectReaderHtmlMarkers,
  applyReaderTagPreferences,
  readerContentSegments,
  readerHtmlToText,
} from '../src/core/readerImages';
import { paginateText } from '../src/core/pagination';

describe('reader inline images', () => {
  test('preserves plain and linked images with absolute URLs', () => {
    const text = readerHtmlToText(
      '<p>前文</p><img data-src="/a.jpg"><a href="/open"><img src="b.png"></a><p>后文</p>',
      'https://books.example/chapter/1',
    );
    expect(readerContentSegments(text)).toEqual([
      { type: 'text', text: '前文\n\n' },
      { type: 'image', image: { src: 'https://books.example/a.jpg' } },
      { type: 'text', text: '\n\n' },
      {
        type: 'image',
        image: {
          src: 'https://books.example/chapter/b.png',
          click: 'https://books.example/open',
        },
      },
      { type: 'text', text: '\n后文' },
    ]);
  });
  test('preserves accessible text links and resolves their targets', () => {
    const text = readerHtmlToText(
      '<p>访问 <a href="../next?q=1&amp;x=2"><b>下一章</b></a> 继续</p>',
      'https://books.example/book/chapter/1',
    );
    expect(readerContentSegments(text)).toEqual([
      { type: 'text', text: '访问 ' },
      {
        type: 'link',
        link: {
          text: '下一章',
          url: 'https://books.example/book/next?q=1&x=2',
        },
      },
      { type: 'text', text: ' 继续' },
    ]);
  });
  test('keeps image markers atomic across pagination', () => {
    const text = readerHtmlToText(
      `<p>${'甲'.repeat(30)}</p><img src="https://x.test/${'a'.repeat(80)}.jpg"><p>结尾</p>`,
    );
    const pages = paginateText(text, 40);
    expect(
      pages.every(
        page => !page.includes('{{HTYF_IMAGE:') || page.includes('}}'),
      ),
    ).toBe(true);
    expect(
      readerContentSegments(pages.join('\n')).some(
        segment => segment.type === 'image',
      ),
    ).toBe(true);
  });
  test('keeps long link markers atomic across pagination', () => {
    const text = readerHtmlToText(
      `<a href="https://x.test/${'z'.repeat(100)}">${'链接'.repeat(30)}</a>`,
    );
    const pages = paginateText(text, 30);
    expect(
      pages.every(
        page => !page.includes('{{HTYF_LINK:') || page.includes('}}'),
      ),
    ).toBe(true);
    expect(
      readerContentSegments(pages.join('')).some(x => x.type === 'link'),
    ).toBe(true);
  });
  test('ignores source-less image markup without corrupting text', () => {
    expect(readerHtmlToText('A<img alt="missing">B')).toBe('AB');
    expect(readerContentSegments('plain')).toEqual([
      { type: 'text', text: 'plain' },
    ]);
  });
  test('preserves ruby and heading semantics for per-book reader toggles', () => {
    const text = readerHtmlToText(
      '<h2>重复标题</h2><p><ruby>漢<rp>(</rp><rt>かん</rt><rp>)</rp>字</ruby>正文</p>',
    );
    expect(applyReaderTagPreferences(text)).toBe('重复标题\n漢字(かん)正文');
    expect(applyReaderTagPreferences(text, true, false)).toBe(
      '重复标题\n漢字正文',
    );
    expect(applyReaderTagPreferences(text, false, true)).toBe('漢字(かん)正文');
    expect(applyReaderTagPreferences(text, true, true)).toBe('漢字正文');
  });
  test('preserves usehtml as an atomic rich segment with its base URL', () => {
    const text = readerHtmlToText(
      '<p>前</p><usehtml><div style="text-align:center"><b>居中</b><img src="cover.jpg"></div></usehtml><p>后</p>',
      'https://books.example/chapter/1',
    );
    const segments = readerContentSegments(text);
    expect(segments).toEqual([
      { type: 'text', text: '前\n\n' },
      {
        type: 'html',
        html: {
          html: '<div style="text-align:center"><b>居中</b><img src="cover.jpg"></div>',
          baseUrl: 'https://books.example/chapter/1',
        },
      },
      { type: 'text', text: '\n后' },
    ]);
    expect(
      paginateText(text, 20).every(
        page => !page.includes('{{HTYF_HTML:') || page.includes('}}'),
      ),
    ).toBe(true);
  });
  test('falls usehtml back to normal parsed text when adaptation is disabled', () => {
    const marked = readerHtmlToText(
      '<usehtml><p><b>普通正文</b></p><img src="/a.jpg"></usehtml>',
      'https://books.example/chapter/1',
    );
    const plain = applyReaderSpecialStylePreference(marked, false);
    expect(plain).toContain('普通正文');
    expect(plain).not.toContain('HTYF_HTML');
    expect(readerContentSegments(plain)).toContainEqual({
      type: 'image',
      image: { src: 'https://books.example/a.jpg' },
    });
    expect(applyReaderSpecialStylePreference(marked, true)).toBe(marked);
  });
  test('protects rich HTML from chapter replacement and restores it exactly', () => {
    const marked = readerHtmlToText(
      '<p>替换正文</p><usehtml><b>替换不应进入这里</b></usehtml>',
      'https://books.example/chapter',
    );
    const protectedValue = protectReaderHtmlMarkers(marked);
    expect(protectedValue.text).not.toContain('替换不应进入这里');
    const replaced = protectedValue.text.replace(/替换/g, '净化');
    const restored = protectedValue.restore(replaced);
    expect(restored).toContain('净化正文');
    expect(readerContentSegments(restored)).toContainEqual({
      type: 'html',
      html: {
        html: '<b>替换不应进入这里</b>',
        baseUrl: 'https://books.example/chapter',
      },
    });
  });
});
