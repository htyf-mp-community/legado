jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/docs',
  mkdir: jest.fn(),
  writeFile: jest.fn(),
}));
jest.mock('react-native-quick-base64', () => ({ fromByteArray: jest.fn() }));
import {
  renderBookEpub,
  renderBookExport,
  renderBookPdf,
  renderBookTxt,
  safeExportName,
} from '../src/core/bookExport';
const book = {
  id: '1',
  name: '书/名',
  author: '作者',
  intro: '<b>简介</b>',
  chapterTitle: '第一章',
  content: '正文',
  progress: 0,
  updatedAt: 0,
  chapters: [{ id: 'c', title: '第一章', content: '甲<br>乙' }],
};
const ascii = (value: Uint8Array) =>
  Array.from(value, byte => String.fromCharCode(byte)).join('');
describe('book export', () => {
  it('renders structured plain text', () =>
    expect(renderBookTxt(book)).toContain('第一章\n\n甲\n乙'));
  it('omits chapter headings in TXT and EPUB content when configured', () => {
    expect(renderBookTxt(book, { noChapterName: true })).not.toContain(
      '第一章\n\n甲',
    );
    expect(ascii(renderBookEpub(book, { noChapterName: true }))).not.toContain(
      '<h1>第一章</h1>',
    );
  });
  it('renders recoverable JSON envelope', () =>
    expect(JSON.parse(renderBookExport(book, 'json'))).toMatchObject({
      type: 'legadoBook',
      book: { id: '1' },
    }));
  it('sanitizes filenames', () =>
    expect(safeExportName('书/名:*?')).toBe('书_名___'));
  it('creates an EPUB ZIP with uncompressed mimetype first and required package files', () => {
    const epub = renderBookEpub(book),
      raw = ascii(epub);
    expect([...epub.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect([...epub.slice(8, 10)]).toEqual([0, 0]);
    expect(ascii(epub.slice(38, 58))).toContain('application/epub');
    expect(raw).toContain('META-INF/container.xml');
    expect(raw).toContain('OEBPS/content.opf');
    expect(raw).toContain('OEBPS/nav.xhtml');
    expect(raw).toContain('OEBPS/chapter-0.xhtml');
  });
  it('creates a paginated PDF with CJK font mapping and a valid cross-reference trailer', () => {
    const pdf = ascii(renderBookPdf(book)),
      start = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
    expect(pdf).toMatch(/^%PDF-1\.4/);
    expect(pdf).toContain('/UniGB-UCS2-H');
    expect(pdf.slice(start, start + 4)).toBe('xref');
    expect(pdf).toMatch(/trailer\n<< \/Size \d+ \/Root \d+ 0 R >>/);
    expect(pdf.endsWith('%%EOF')).toBe(true);
  });
});
