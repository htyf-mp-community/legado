import { parseMangaImages } from '../src/core/manga';
describe('manga image parser', () => {
  it('extracts HTML images and resolves relative URLs', () => expect(parseMangaImages('<img src="/1.jpg"><img data-src="2.jpg">','https://x/book/')).toEqual(['https://x/1.jpg','https://x/book/2.jpg']));
  it('parses and deduplicates line based image content', () => expect(parseMangaImages('https://x/1.jpg\nhttps://x/1.jpg\n/2.png','https://x/a')).toEqual(['https://x/1.jpg','https://x/2.png']));
});
