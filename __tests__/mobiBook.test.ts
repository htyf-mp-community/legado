jest.mock('@dr.pogodin/react-native-fs', () => ({
  readFile: jest.fn(),
  unlink: jest.fn(),
}));
jest.mock('@react-native-documents/picker', () => ({ keepLocalCopy: jest.fn() }));
jest.mock('react-native-quick-base64', () => ({ toByteArray: jest.fn() }));

import { readFile, unlink } from '@dr.pogodin/react-native-fs';
import { keepLocalCopy } from '@react-native-documents/picker';
import { toByteArray } from 'react-native-quick-base64';
import { decompressPalmDoc, importMobiBook, parseMobi } from '../src/core/mobiBook';

const setU16 = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = value >>> 8;
  bytes[offset + 1] = value;
};

const setU32 = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = value >>> 24;
  bytes[offset + 1] = value >>> 16;
  bytes[offset + 2] = value >>> 8;
  bytes[offset + 3] = value;
};

function mobiFixture() {
  const encode = (value: string) => {
    const encoded = encodeURIComponent(value);
    const output: number[] = [];
    for (let index = 0; index < encoded.length; index++) {
      if (encoded[index] === '%') {
        output.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
        index += 2;
      } else output.push(encoded.charCodeAt(index));
    }
    return Uint8Array.from(output);
  };
  const html = encode('<h1>第一章</h1><p>甲</p><mbp:pagebreak/><h1>第二章</h1><p>乙</p>');
  const title = encode('测试 MOBI');
  const firstRecord = 94;
  const textRecord = 240;
  const bytes = new Uint8Array(textRecord + html.length);

  setU16(bytes, 76, 2);
  setU32(bytes, 78, firstRecord);
  setU32(bytes, 86, textRecord);
  setU16(bytes, firstRecord, 1);
  setU32(bytes, firstRecord + 4, html.length);
  setU16(bytes, firstRecord + 8, 1);
  bytes.set(encode('MOBI'), firstRecord + 16);
  setU32(bytes, firstRecord + 28, 65001);
  setU32(bytes, firstRecord + 84, 110);
  setU32(bytes, firstRecord + 88, title.length);
  bytes.set(title, firstRecord + 110);
  bytes.set(html, textRecord);
  return bytes;
}

test('decompresses PalmDOC literal, compact-space and back-reference codes', () => {
  expect(Array.from(decompressPalmDoc(Uint8Array.of(3, 65, 66, 67, 0xc1)))).toEqual([65, 66, 67, 32, 65]);
  expect(Array.from(decompressPalmDoc(Uint8Array.of(3, 65, 66, 67, 0x80, 0x18)))).toEqual([65, 66, 67, 65, 66, 67]);
});

test('parses MOBI metadata and page-break chapters', () => {
  expect(parseMobi(mobiFixture())).toMatchObject({
    title: '测试 MOBI',
    chapters: [
      { title: '第一章', content: '第一章\n甲' },
      { title: '第二章', content: '第二章\n乙' },
    ],
  });
});

test('imports a MOBI file and removes its temporary copy', async () => {
  (keepLocalCopy as jest.Mock).mockResolvedValue([{ status: 'success', localUri: 'file:///cache/book.mobi' }]);
  (readFile as jest.Mock).mockResolvedValue('base64');
  (toByteArray as jest.Mock).mockReturnValue(mobiFixture());

  const book = await importMobiBook('content://book', 'fallback.mobi');

  expect(book).toMatchObject({ name: '测试 MOBI', chapterTitle: '第一章', content: '第一章\n甲' });
  expect(book.chapters).toHaveLength(2);
  expect(unlink).toHaveBeenCalledWith('/cache/book.mobi');
});
