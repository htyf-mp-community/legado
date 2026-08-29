jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  DocumentDirectoryPath: '/documents',
  readFile: jest.fn(),
  unlink: jest.fn(),
}));
jest.mock('@react-native-documents/picker', () => ({
  keepLocalCopy: jest.fn(),
}));
jest.mock('react-native-nitro-unzip', () => ({ getUnzip: jest.fn() }));
import { readFile, unlink } from '@dr.pogodin/react-native-fs';
import { keepLocalCopy } from '@react-native-documents/picker';
import { getUnzip } from 'react-native-nitro-unzip';
import {
  cleanupEpubAssets,
  importEpubBook,
  parseEpubPackage,
} from '../src/core/epubBook';
import { readerContentSegments } from '../src/core/readerImages';
test('parses EPUB metadata and spine order', () => {
  const container =
      '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
    opf =
      '<package><metadata><dc:title>书名</dc:title><dc:creator>作者</dc:creator></metadata><manifest><item id="b" href="Text/b.xhtml" media-type="application/xhtml+xml"/><item id="a" href="Text/a.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>';
  expect(parseEpubPackage(container, opf)).toMatchObject({
    title: '书名',
    author: '作者',
    chapters: [
      { id: 'a', href: 'OEBPS/Text/a.xhtml' },
      { id: 'b', href: 'OEBPS/Text/b.xhtml' },
    ],
  });
});
test('rejects EPUB without readable spine', () =>
  expect(() =>
    parseEpubPackage('<rootfile full-path="x.opf"/>', '<package/>'),
  ).toThrow('书脊'));
test('rejects a container OPF path escaping the extracted archive', () =>
  expect(() =>
    parseEpubPackage('<rootfile full-path="../outside.opf"/>', '<package/>'),
  ).toThrow('路径越界'));
test('imports chapters in spine order and retains extracted EPUB assets', async () => {
  (keepLocalCopy as jest.Mock).mockResolvedValue([
    { status: 'success', localUri: 'file:///cache/book.epub' },
  ]);
  (getUnzip as jest.Mock).mockReturnValue({
    extract: () => ({ await: jest.fn().mockResolvedValue(undefined) }),
  });
  (readFile as jest.Mock).mockImplementation(async (path: string) =>
    path.endsWith('container.xml')
      ? '<container><rootfile full-path="OEBPS/content.opf"/></container>'
      : path.endsWith('content.opf')
        ? '<package><metadata><dc:title>测试书</dc:title><dc:creator>作者</dc:creator><dc:description>简介</dc:description></metadata><manifest><item id="two" href="2.xhtml" media-type="application/xhtml+xml"/><item id="one" href="1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>'
        : path.endsWith('1.xhtml')
          ? '<html><head><title>第一章</title></head><body><p>甲</p><img src="../Images/a.jpg"><p>乙</p></body></html>'
          : '<html><body><h1>第二章</h1><p>丙</p></body></html>',
  );
  const book = await importEpubBook('content://book', '测试.epub');
  expect(book).toMatchObject({
    name: '测试书',
    author: '作者',
    chapterTitle: '第一章',
    localUri: 'content://book',
  });
  const image = readerContentSegments(book.content).find(
    segment => segment.type === 'image',
  );
  expect(image).toMatchObject({
    type: 'image',
    image: {
      src: expect.stringMatching(
        /^file:\/\/\/documents\/legado-epub-.*\/Images\/a\.jpg$/,
      ),
    },
  });
  expect(book.chapters?.map(item => item.title)).toEqual(['第一章', '第二章']);
  expect(unlink).toHaveBeenCalledWith('/cache/book.epub');
  expect(
    (unlink as jest.Mock).mock.calls.some(([path]) =>
      String(path).startsWith('/documents/legado-epub-'),
    ),
  ).toBe(false);
});
test('only removes owned persistent EPUB asset roots', async () => {
  await expect(
    cleanupEpubAssets({ epubAssetRoot: '/documents/legado-epub-1' } as never),
  ).resolves.toBe(true);
  expect(unlink).toHaveBeenCalledWith('/documents/legado-epub-1');
  await expect(
    cleanupEpubAssets({ epubAssetRoot: '/documents/other' } as never),
  ).resolves.toBe(false);
  await expect(
    cleanupEpubAssets({
      epubAssetRoot: '/documents/legado-epub-1/../other',
    } as never),
  ).resolves.toBe(false);
});
