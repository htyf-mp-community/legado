import { readerMenuTitle } from '../src/core/readerMenuTitle';

describe('reader menu title details', () => {
  test('keeps the book name as the primary title', () => {
    expect(
      readerMenuTitle(
        ' 书名 ',
        ' 第一章 ',
        'https://source.test/1',
        true,
        false,
      ),
    ).toEqual({
      primary: '书名',
      addition: '第一章\nhttps://source.test/1',
    });
  });
  test('can hide all details or retain only the chapter name', () => {
    expect(readerMenuTitle('书', '章', 'https://x/1', false, false)).toEqual({
      primary: '书',
    });
    expect(readerMenuTitle('书', '章', 'https://x/1', true, true)).toEqual({
      primary: '书',
      addition: '章',
    });
  });
  test('does not expose local or invalid chapter paths as remote URLs', () => {
    expect(readerMenuTitle('书', '章', '/local/chapter', true, false)).toEqual({
      primary: '书',
      addition: '章',
    });
  });
});
