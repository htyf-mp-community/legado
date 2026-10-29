jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
import {
  convertLegacyBackup,
  convertLegacyReaderPreferences,
} from '../src/data/legacyBackup';
test('converts Android bookshelf, groups, annotations and rules into HTYF entries', () => {
  const result = convertLegacyBackup(
    {
      'bookGroup.json': JSON.stringify([
        { groupId: 1, groupName: '收藏', order: 0 },
      ]),
      'bookshelf.json': JSON.stringify([
        {
          bookUrl: 'https://book',
          name: '书',
          author: '作',
          group: 1,
          durChapterTitle: '第2章',
          durChapterIndex: 1,
          durChapterPos: 20,
          type: 0,
        },
      ]),
      'bookmark.json': JSON.stringify([
        {
          time: 3,
          bookName: '书',
          bookAuthor: '作',
          chapterIndex: 1,
          chapterName: '第2章',
          chapterPos: 8,
          bookText: '摘录',
        },
      ]),
      'bookSource.json': JSON.stringify([
        { bookSourceUrl: 'https://source', bookSourceName: '源' },
      ]),
    },
    100,
  );
  expect(result.importedFiles).toEqual(
    expect.arrayContaining([
      'bookshelf.json',
      'bookGroup.json',
      'bookmark.json',
      'bookSource.json',
    ]),
  );
  const books = JSON.parse(String(result.payload.entries['library.v1'].value));
  expect(books[0]).toMatchObject({
    id: 'https://book',
    groupIds: ['1'],
    progress: 0,
    pendingReadingPosition: { chapterIndex: 1, position: 20, totalChapters: 0 },
  });
  expect(result.payload.createdAt).toBe(100);
});
test('keeps valid files and reports malformed optional files', () => {
  const result = convertLegacyBackup({
    'bookSource.json': JSON.stringify([
      { bookSourceUrl: 'https://source', bookSourceName: '源' },
    ]),
    'replaceRule.json': 'bad',
  });
  expect(result.importedFiles).toEqual(['bookSource.json']);
  expect(result.warnings[0]).toContain('replaceRule.json');
});
test('rejects archives without recognized data', () =>
  expect(() => convertLegacyBackup({ 'readme.txt': 'x' })).toThrow('未识别'));
test('converts decrypted Android cookies into isolated source jars', () => {
  const result = convertLegacyBackup({
    'cookies.json': JSON.stringify([
      { url: 'https://source.example', cookie: 'sid=abc; theme=dark' },
    ]),
  });
  expect(
    JSON.parse(
      String(
        result.payload.entries[
          `source-cookie.v1.${encodeURIComponent('https://source.example')}`
        ].value,
      ),
    ),
  ).toEqual({ sid: 'abc', theme: 'dark' });
});
test('transactionally preserves decrypted runtime caches and server records', () => {
  const result = convertLegacyBackup({
    'runtimeSourceCache.json': JSON.stringify([
      { key: 'sourceVariable_x', value: 'v', deadline: 0 },
    ]),
    'servers.json': JSON.stringify([{ id: 1, name: 'LAN' }]),
  });
  expect(result.importedFiles).toEqual([
    'runtimeSourceCache.json',
    'servers.json',
  ]);
  expect(
    JSON.parse(
      String(result.payload.entries['legacy.runtime-source-cache.v1'].value),
    )[0].key,
  ).toBe('sourceVariable_x');
});
test('imports Android keyboardAssists.json into the dedicated MMKV rule entry', () => {
  const result = convertLegacyBackup({
    'keyboardAssists.json': JSON.stringify([
      { type: 0, key: '@css:', value: '@css:', serialNo: 3 },
    ]),
  });
  expect(result.importedFiles).toEqual(['keyboardAssists.json']);
  expect(
    JSON.parse(String(result.payload.entries['keyboard-assists.v1'].value)),
  ).toEqual([{ type: 0, key: '@css:', value: '@css:', serialNo: 0 }]);
});
test('maps compatible Android reader settings and preserves the original config', () => {
  expect(
    convertLegacyReaderPreferences(
      JSON.stringify([
        {
          textSize: 22,
          lineSpacingExtra: 10,
          pageAnim: 3,
          letterSpacing: 0.2,
          paragraphSpacing: 7,
          paragraphIndent: '　',
          textBold: 1,
          paddingLeft: 12,
          paddingRight: 20,
          paddingTop: 4,
          paddingBottom: 8,
          bgStr: '#eeeeee',
          textColor: '#3e3d3b',
          bgStrNight: '#000000',
          textColorNight: '#adadad',
        },
      ]),
    ),
  ).toMatchObject({
    fontSize: 22,
    lineHeight: 32,
    mode: 'scroll',
    letterSpacing: 0.2,
    paragraphSpacing: 7,
    paragraphIndent: '　',
    textBold: true,
    contentInsetHorizontal: 16,
    contentInsetVertical: 6,
    paperBackground: '#eeeeee',
    paperForeground: '#3e3d3b',
    nightBackground: '#000000',
    nightForeground: '#adadad',
  });
  const result = convertLegacyBackup({
    'readConfig.json': JSON.stringify([
      { textSize: 18, lineSpacingExtra: 8, pageAnim: 4 },
    ]),
  });
  expect(
    JSON.parse(String(result.payload.entries['reader.preferences.v1'].value)),
  ).toMatchObject({
    fontSize: 18,
    lineHeight: 26,
    mode: 'page',
    pageAnimation: 'none',
  });
  expect(result.payload.entries['legacy.read-config.v1']).toBeDefined();
});
test('remaps available persisted Android covers into the staged media target without replacing the source layer', () => {
  const result = convertLegacyBackup(
      {
        'bookshelf.json': JSON.stringify([
          {
            bookUrl: 'b',
            name: '书',
            coverUrl: 'https://source/cover.jpg',
            customCoverUrl: 'https://custom/cover.jpg',
            persistedCoverUrl: '/old/covers/a.jpg',
          },
        ]),
      },
      1,
      { coverRoot: '/docs/import/covers', coverFiles: { 'a.jpg': 'a.jpg' } },
    ),
    books = JSON.parse(String(result.payload.entries['library.v1'].value));
  expect(books[0]).toMatchObject({
    coverUrl: 'https://source/cover.jpg',
    customCoverUrl: 'https://custom/cover.jpg',
    persistedCoverUrl: 'file:///docs/import/covers/a.jpg',
  });
});
test('remaps legacy reader background images into restored document media', () =>
  expect(
    convertLegacyReaderPreferences(
      JSON.stringify([
        {
          bgType: 2,
          bgStr: '/old/bg/paper.jpg',
          bgTypeNight: 2,
          bgStrNight: '/old/bg/night.jpg',
        },
      ]),
      {
        bgRoot: '/docs/import/bg',
        bgFiles: { 'paper.jpg': 'themes/paper.jpg', 'night.jpg': 'night.jpg' },
      },
    ),
  ).toMatchObject({
    paperBackgroundImage: 'file:///docs/import/bg/themes/paper.jpg',
    nightBackgroundImage: 'file:///docs/import/bg/night.jpg',
  }));
test('maps legacy reader header and footer slots and custom templates', () =>
  expect(
    convertLegacyReaderPreferences(
      JSON.stringify([
        {
          headerMode: 1,
          footerMode: 0,
          tipTextSize: 14,
          tipHeaderLeft: 7,
          tipHeaderMiddleTemplate: '{章节序号}/{章节总数}',
          tipFooterRight: 4,
        },
      ]),
    ),
  ).toMatchObject({
    showReaderHeader: true,
    showReaderFooter: true,
    readerInfoTextSize: 14,
    headerLeftTemplate: '{书名}',
    headerMiddleTemplate: '{章节序号}/{章节总数}',
    footerRightTemplate: '{页码}/{总页数}',
  }));

test('native cover restore preserves network URLs even when their basenames also exist in the archive', () => {
  const files = {
    'bookshelf.json': JSON.stringify([
      {
        bookUrl: 'b',
        name: 'Book',
        intro: 'Source',
        customIntro: 'Private',
        customCoverUrl: 'https://cdn.test/a.jpg',
        persistedCoverUrl: '/old/covers/missing.cover',
      },
    ]),
    'bookGroup.json': JSON.stringify([
      { groupId: 1, groupName: 'G', cover: '/old/covers/a.jpg' },
    ]),
  };
  const preview = convertLegacyBackup(files, 1, {
      coverRoot: '/new/covers',
      coverFiles: { 'a.jpg': 'a.jpg' },
    }),
    book = JSON.parse(String(preview.payload.entries['library.v1'].value))[0],
    group = JSON.parse(
      String(preview.payload.entries['bookshelf.groups.v1'].value),
    )[0];
  expect(book).toMatchObject({
    intro: 'Source',
    customIntro: 'Private',
    customCoverUrl: 'https://cdn.test/a.jpg',
  });
  expect(book.persistedCoverUrl).toBeUndefined();
  expect(group.cover).toBe('file:///new/covers/a.jpg');
});
test('missing native cover files can reuse a current local cover with the same filename', () => {
  const preview = convertLegacyBackup(
    {
      'bookshelf.json': JSON.stringify([
        { bookUrl: 'b', persistedCoverUrl: '/old/covers/a.cover' },
      ]),
    },
    1,
    {
      coverFiles: {},
      existingCoverFiles: { 'a.cover': '/current/covers/a.cover' },
    },
  );
  expect(
    JSON.parse(String(preview.payload.entries['library.v1'].value))[0]
      .persistedCoverUrl,
  ).toBe('file:///current/covers/a.cover');
});

test('retains native reading cursor separately from progress and requires a complete first-read catalogue', () => {
  const preview = convertLegacyBackup({
    'bookshelf.json': JSON.stringify([
      {
        bookUrl: 'https://book',
        origin: 'https://source',
        name: 'Book',
        durChapterIndex: 5,
        durChapterTitle: '第六章 恢复',
        durChapterUrl: 'https://chapter/5',
        durChapterPos: 1234,
        totalChapterNum: 12,
      },
    ]),
  });
  const book = JSON.parse(
    String(preview.payload.entries['library.v1'].value),
  )[0];
  expect(book.pendingCatalog).toBe(true);
  expect(book.chapters).toEqual([]);
  expect(book.pendingReadingPosition).toEqual({
    chapterIndex: 5,
    chapterTitle: '第六章 恢复',
    position: 1234,
    totalChapters: 12,
    titleVisible: true,
  });
  expect(book.progress).toBeCloseTo(5 / 12);
  expect(book.progress).toBeLessThanOrEqual(1);
});
