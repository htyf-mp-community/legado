jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));

import { loadChapterPayload } from '../src/core/webBook';
import type { BookSource } from '../src/types';
import native from './fixtures/contentFormat.native.json';
import { readerContentSegments, applyReaderTagPreferences } from '../src/core/readerImages';
import * as readerPreferences from '../src/data/readerPreferences';
import { formatReaderParagraphs } from '../src/core/htmlFormatter';
import { parseMangaImages } from '../src/core/manga';

const source: BookSource = {
  bookSourceUrl: 'https://books.example',
  bookSourceName: '正文原版对照',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: false,
  ruleContent: { content: '$.content' },
};
const chapter = {
  url: 'https://books.example/dir/chapter.html',
  title: '第一章',
  index: 0,
  bookUrl: 'https://books.example/book',
  baseUrl: 'https://books.example/book',
  isVolume: false,
  isVip: false,
  isPay: false,
};

describe('online chapter native formatting', () => {
  test.each([
    '<div>A</div><div>B</div>',
    'A<p>B</p>C',
    '&lt;b&gt;literal&lt;/b&gt; &amp;lt;b&amp;gt; &amp;amp;',
  ])('matches native formatKeepImg then HTML4 unescape for %s', async html => {
    const reference = native.cases.find(row => row.mode === 'web' && row.html === html)!;
    const mock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(
      JSON.stringify({ content: html }),
      { headers: { 'Content-Type': 'application/json' } },
    ));
    try {
      expect((await loadChapterPayload(source, chapter)).content).toBe(reference.value);
    } finally {
      mock.mockRestore();
    }
  });

  test('formats each displayed paragraph once and preserves literal nonbreaking spaces', () => {
    expect(formatReaderParagraphs(applyReaderTagPreferences('　　　　A\n　　B\n　　'), '　　')).toBe('　　A\n　　B');
    expect(formatReaderParagraphs(applyReaderTagPreferences('\u00a0A\u00a0\nB'), '')).toBe('\u00a0A\u00a0\nB');
  });

  test('keeps source image URLs and literal tags through the reader adapter', async () => {
    const mock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(
      JSON.stringify({ content: 'A<img data-original="/lazy.jpg" src="/thumb.jpg">B &lt;b&gt;C&lt;/b&gt;' }),
      { headers: { 'Content-Type': 'application/json' } },
    ));
    try {
      expect(readerContentSegments((await loadChapterPayload(source, chapter)).content)).toEqual([
        { type: 'text', text: 'A' },
        { type: 'image', image: { src: 'https://books.example/lazy.jpg' } },
        { type: 'text', text: 'B <b>C</b>' },
      ]);
      const manga = await loadChapterPayload({ ...source, bookSourceType: 2 }, chapter);
      expect(parseMangaImages(manga.content)).toEqual(['https://books.example/lazy.jpg']);
    } finally { mock.mockRestore(); }
  });

  test('keeps protected rich HTML atomic and applies source cleanup when adaptation is disabled', async () => {
    const mock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(
      JSON.stringify({ content: '<usehtml><p>A</p><p>B</p></usehtml>' }),
      { headers: { 'Content-Type': 'application/json' } },
    ));
    try {
      const content = (await loadChapterPayload(source, chapter)).content;
      expect(readerContentSegments(content)).toContainEqual({
        type: 'html', html: { html: '<p>A</p><p>B</p>', baseUrl: chapter.url, sourceFormatted: true },
      });
      const preference = jest.spyOn(readerPreferences, 'loadReaderPreferences').mockResolvedValue({ ...readerPreferences.defaultReaderPreferences, adaptSpecialStyle: false });
      try { expect(formatReaderParagraphs((await loadChapterPayload(source, chapter)).content, '')).toBe('A\nB'); }
      finally { preference.mockRestore(); }
    } finally { mock.mockRestore(); }
  });

  test.each([1, 4])('preserves media type %i content without HTML cleanup', async bookSourceType => {
    const raw = '<video src="https://cdn.test/play.m3u8"></video>\n';
    const mock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(
      JSON.stringify({ content: raw }), { headers: { 'Content-Type': 'application/json' } },
    ));
    try { expect((await loadChapterPayload({ ...source, bookSourceType }, chapter)).content).toBe(raw); }
    finally { mock.mockRestore(); }
  });

  test('applies source replacement to formatted raw HTML before reader markers', async () => {
    const mock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(
      JSON.stringify({ content: '<p>A<img src="/a.jpg"></p>' }),
      { headers: { 'Content-Type': 'application/json' } },
    ));
    try {
      const result = await loadChapterPayload({ ...source, ruleContent: { content: '$.content', replaceRegex: '##<img[^>]+>##图片' } }, chapter);
      expect(result.content).toBe('A图片\n');
    } finally { mock.mockRestore(); }
  });
});

