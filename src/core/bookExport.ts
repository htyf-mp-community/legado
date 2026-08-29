import {
  DocumentDirectoryPath,
  mkdir,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import { fromByteArray } from 'react-native-quick-base64';
import type { Book } from '../types';

export type BookExportFormat = 'txt' | 'json' | 'epub' | 'pdf';
export function safeExportName(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 100) || 'book';
}
const plain = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\r/g, '')
    .trim();
export type BookRenderOptions = { noChapterName?: boolean };
export function renderBookTxt(book: Book, options: BookRenderOptions = {}) {
  const chapters = book.chapters?.length
    ? book.chapters
    : [
        {
          id: `${book.id}-legacy`,
          title: book.chapterTitle,
          content: book.content,
        },
      ];
  return [
    `《${book.name}》`,
    `作者：${book.author || '未知'}`,
    book.intro ? `简介：${plain(book.intro)}` : '',
    '',
    ...chapters.flatMap(chapter => [
      options.noChapterName ? '' : `\n${chapter.title}\n`,
      plain(chapter.content),
      '',
    ]),
  ]
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n');
}
export function renderBookExport(book: Book, format: BookExportFormat) {
  return format === 'json'
    ? JSON.stringify({ type: 'legadoBook', version: 1, book }, null, 2)
    : renderBookTxt(book);
}
const utf8 = (value: string) => {
  const encoded = encodeURIComponent(value),
    out: number[] = [];
  for (let index = 0; index < encoded.length; index++) {
    if (encoded[index] === '%') {
      out.push(parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else out.push(encoded.charCodeAt(index));
  }
  return Uint8Array.from(out);
};
const join = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, item) => sum + item.length, 0));
  let offset = 0;
  parts.forEach(item => {
    out.set(item, offset);
    offset += item.length;
  });
  return out;
};
const u16 = (value: number) => Uint8Array.of(value & 255, (value >>> 8) & 255),
  u32 = (value: number) =>
    Uint8Array.of(
      value & 255,
      (value >>> 8) & 255,
      (value >>> 16) & 255,
      (value >>> 24) & 255,
    );
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
export function createStoreZip(
  files: Array<{ name: string; content: string }>,
) {
  const local: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = utf8(file.name),
      data = utf8(file.content),
      crc = crc32(data),
      header = join([
        u32(0x04034b50),
        u16(20),
        u16(0x800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        name,
      ]);
    local.push(header, data);
    central.push(
      join([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += header.length + data.length;
  }
  const directory = join(central);
  return join([
    ...local,
    directory,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(directory.length),
    u32(offset),
    u16(0),
  ]);
}
const xml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const paragraphs = (value: string) =>
  plain(value)
    .split(/\n+/)
    .filter(Boolean)
    .map(line => `<p>${xml(line)}</p>`)
    .join('\n');
export function renderBookEpub(book: Book, options: BookRenderOptions = {}) {
  const chapters = book.chapters?.length
      ? book.chapters
      : [
          {
            id: `${book.id}-legacy`,
            title: book.chapterTitle,
            content: book.content,
          },
        ],
    id = `urn:legado:${encodeURIComponent(book.id)}`,
    items = chapters
      .map(
        (_, index) =>
          `<item id="chapter-${index}" href="chapter-${index}.xhtml" media-type="application/xhtml+xml"/>`,
      )
      .join(''),
    spine = chapters
      .map((_, index) => `<itemref idref="chapter-${index}"/>`)
      .join(''),
    nav = chapters
      .map(
        (chapter, index) =>
          `<li><a href="chapter-${index}.xhtml">${xml(chapter.title)}</a></li>`,
      )
      .join(''),
    ncx = chapters
      .map(
        (chapter, index) =>
          `<navPoint id="chapter-${index}" playOrder="${index + 1}"><navLabel><text>${xml(chapter.title)}</text></navLabel><content src="chapter-${index}.xhtml"/></navPoint>`,
      )
      .join('');
  return createStoreZip([
    { name: 'mimetype', content: 'application/epub+zip' },
    {
      name: 'META-INF/container.xml',
      content:
        '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    },
    {
      name: 'OEBPS/styles.css',
      content:
        'body{font-family:serif;line-height:1.7;margin:5%;}h1{font-size:1.5em;}p{text-indent:2em;margin:.5em 0;}',
    },
    {
      name: 'OEBPS/nav.xhtml',
      content: `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>目录</title></head><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><h1>目录</h1><ol>${nav}</ol></nav></body></html>`,
    },
    {
      name: 'OEBPS/toc.ncx',
      content: `<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${xml(id)}"/></head><docTitle><text>${xml(book.name)}</text></docTitle><navMap>${ncx}</navMap></ncx>`,
    },
    {
      name: 'OEBPS/content.opf',
      content: `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${xml(id)}</dc:identifier><dc:title>${xml(book.name)}</dc:title><dc:creator>${xml(book.author || '未知')}</dc:creator><dc:language>zh-CN</dc:language><dc:description>${xml(plain(book.intro))}</dc:description><meta property="dcterms:modified">${new Date(book.updatedAt || Date.now()).toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="styles.css" media-type="text/css"/>${items}</manifest><spine toc="ncx">${spine}</spine></package>`,
    },
    ...chapters.map((chapter, index) => ({
      name: `OEBPS/chapter-${index}.xhtml`,
      content: `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xml(chapter.title)}</title><link rel="stylesheet" href="styles.css"/></head><body>${options.noChapterName ? '' : `<h1>${xml(chapter.title)}</h1>`}${paragraphs(chapter.content)}</body></html>`,
    })),
  ]);
}
const utf16hex = (value: string) => {
  let out = 'FEFF';
  for (let index = 0; index < value.length; index++)
    out += value.charCodeAt(index).toString(16).padStart(4, '0').toUpperCase();
  return out;
};
const wrap = (value: string, width = 38) => {
  const lines: string[] = [];
  for (const paragraph of plain(value).split('\n')) {
    let line = '',
      units = 0;
    for (const char of paragraph) {
      const size = char.charCodeAt(0) > 255 ? 2 : 1;
      if (units + size > width * 2 && line) {
        lines.push(line);
        line = '';
        units = 0;
      }
      line += char;
      units += size;
    }
    lines.push(line || ' ');
  }
  return lines;
};
export function renderBookPdf(book: Book, options: BookRenderOptions = {}) {
  const chapters = book.chapters?.length
      ? book.chapters
      : [
          {
            id: `${book.id}-legacy`,
            title: book.chapterTitle,
            content: book.content,
          },
        ],
    lines = [
      book.name,
      `作者：${book.author || '未知'}`,
      ...(book.intro ? ['', ...wrap(book.intro)] : []),
      ...chapters.flatMap(chapter => [
        '',
        ...(options.noChapterName ? [] : [chapter.title]),
        ...wrap(chapter.content),
      ]),
    ],
    pages: Array<string[]> = [];
  for (let index = 0; index < lines.length; index += 44)
    pages.push(lines.slice(index, index + 44));
  const objects: string[] = [];
  const add = (value: string) => {
    objects.push(value);
    return objects.length;
  };
  const catalog = add(''),
    pagesId = add(''),
    font = add(
      '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 5 >> >>] >>',
    );
  const pageIds = pages.map(page => {
    const commands = page
        .map(
          (line, index) =>
            `1 0 0 1 48 ${790 - index * 17} Tm <${utf16hex(line)}> Tj`,
        )
        .join('\n'),
      stream = `BT /F1 12 Tf\n${commands}\nET`,
      content = add(
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      );
    return add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
    );
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let pdf = '%PDF-1.4\n%1234\n',
    offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map(value => String(value).padStart(10, '0') + ' 00000 n ')
    .join(
      '\n',
    )}\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return utf8(pdf);
}
export async function exportBookFile(book: Book, format: BookExportFormat) {
  const directory = `${DocumentDirectoryPath}/LegadoExports`;
  await mkdir(directory);
  const path = `${directory}/${safeExportName(`${book.name}_${book.author}`)}.${format}`;
  if (format === 'epub' || format === 'pdf') {
    const bytes =
      format === 'epub' ? renderBookEpub(book) : renderBookPdf(book);
    await writeFile(path, fromByteArray(bytes), 'base64');
  } else await writeFile(path, renderBookExport(book, format), 'utf8');
  return path;
}
