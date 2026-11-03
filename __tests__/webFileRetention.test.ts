// Mirrors the iOS picker's FileManager.moveItem semantics with an in-memory file system.
const mockFiles = new Map<string, string>();
let mockCounter = 0;
const mockPath = (uri: string) =>
  decodeURIComponent(uri.replace(/^file:\/\//, ''));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  DocumentDirectoryPath: '/documents',
  downloadFile: jest.fn(({ toFile }: { toFile: string }) => {
    mockFiles.set(toFile, 'downloaded');
    return { promise: Promise.resolve({ statusCode: 200, bytesWritten: 10 }) };
  }),
  copyFile: jest.fn(async (from: string, to: string) => {
    if (!mockFiles.has(from)) throw new Error(`Missing source ${from}`);
    mockFiles.set(to, mockFiles.get(from)!);
  }),
  readFile: jest.fn(async (path: string) => {
    const value = mockFiles.get(path);
    if (value === undefined) throw new Error(`Missing file ${path}`);
    return value;
  }),
  unlink: jest.fn(async (path: string) => {
    mockFiles.delete(path);
  }),
}));
jest.mock('@react-native-documents/picker', () => ({
  keepLocalCopy: jest.fn(
    async ({
      files,
      destination,
    }: {
      files: Array<{ uri: string; fileName: string }>;
      destination: string;
    }) =>
      files.map(file => {
        const from = mockPath(file.uri),
          to = `/${destination === 'documentDirectory' ? 'documents' : 'cache'}/picker-${++mockCounter}/${file.fileName}`;
        if (!mockFiles.has(from))
          return { status: 'error', copyError: 'Missing input' };
        mockFiles.set(to, mockFiles.get(from)!);
        mockFiles.delete(from); // iOS FileOperations.swift uses FileManager.moveItem.
        return { status: 'success', localUri: `file://${to}` };
      }),
  ),
}));
jest.mock('react-native-nitro-unzip', () => ({
  getUnzip: () => ({
    extract: (_path: string, dir: string) => ({
      await: async () => {
        mockFiles.set(
          `${dir}/META-INF/container.xml`,
          '<container><rootfile full-path="book.opf"/></container>',
        );
        mockFiles.set(
          `${dir}/book.opf`,
          '<package><metadata><dc:title>内置书名</dc:title></metadata><manifest><item id="c" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>',
        );
        mockFiles.set(
          `${dir}/chapter.xhtml`,
          '<html><head><title>第一章</title></head><body><p>正文</p></body></html>',
        );
        return { success: true };
      },
    }),
  }),
}));
jest.mock('react-native-quick-base64', () => ({
  toByteArray: () => {
    const bytes = new Uint8Array(250);
    const u16 = (at: number, value: number) => {
      bytes[at] = value >>> 8;
      bytes[at + 1] = value;
    };
    const u32 = (at: number, value: number) => {
      bytes[at] = value >>> 24;
      bytes[at + 1] = value >>> 16;
      bytes[at + 2] = value >>> 8;
      bytes[at + 3] = value;
    };
    u16(76, 2);
    u32(78, 94);
    u32(86, 240);
    u16(94, 1);
    u32(98, 10);
    u16(102, 1);
    bytes.set([77, 79, 66, 73], 110);
    u32(122, 65001);
    bytes.set([60, 112, 62, 116, 101, 120, 116, 60, 47, 112], 240);
    return bytes;
  },
  fromByteArray: () => '',
}));
jest.mock('../src/core/sourceRequest', () => ({
  buildSourcePageRequest: (_source: unknown, url: string) => ({
    url,
    method: 'GET',
    headers: {},
    cookieJar: false,
  }),
}));
jest.mock('../src/core/readerImages', () => ({
  readerHtmlToText: (html: string) => html.replace(/<[^>]*>/g, ''),
}));
jest.mock('../src/data/sourceCookies', () => ({
  saveResponseCookies: jest.fn(),
}));
import { prepareWebFile } from '../src/core/webFileImport';
import type { BookSource, SearchBook } from '../src/types';
const source = { bookSourceUrl: 'https://source.test' } as BookSource;
const book = { name: '书', author: '作者' } as SearchBook;

beforeEach(() => {
  mockFiles.clear();
  mockCounter = 0;
});
test.each(['epub', 'mobi'])(
  'downloaded %s remains available after parsing and staging cleanup',
  async extension => {
    const prepared = await prepareWebFile(
      source,
      book,
      `https://source.test/book.${extension}`,
    );
    const imported = await prepared.importFile(prepared.files[0], []);
    await prepared.dispose();
    expect(imported.content).toBeTruthy();
    const retainedUri = imported.localUri || imported.bookUrl!;
    expect(mockFiles.has(mockPath(retainedUri))).toBe(true);
  },
);
