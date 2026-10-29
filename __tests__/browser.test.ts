import {
  browserDownloadName,
  isBrowserNavigationAllowed,
  isExternalBrowserScheme,
  normalizeBrowserInput,
} from '../src/core/browser';
import { saveLibrary } from '../src/data/library';
import {
  createLocalWebServiceHandler,
  normalizePort,
} from '../src/data/localWebService';

jest.mock('react-native-nitro-http-server', () => ({ HttpServer: class {} }));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));
jest.mock('react-native-quick-base64', () => ({
  fromByteArray: () => 'Ym9vaw==',
}));
jest.mock('../src/core/localBookImport', () => ({
  SUPPORTED_BOOK_FILE: /\.(?:txt|epub|mobi|prc|azw)$/i,
  importSupportedBook: jest.fn(async (uri: string, fileName: string) => ({
    id: `local:${fileName}`,
    name: fileName.replace(/\.[^.]+$/, ''),
    author: '',
    intro: '',
    chapterTitle: '正文',
    content: 'book',
    chapters: [{ id: '1', title: '正文', content: 'book' }],
    progress: 0,
    updatedAt: 1,
    localUri: uri,
  })),
}));
jest.mock('../src/data/storage', () => {
  const values = new Map<string, string>();
  return {
    appStorage: {
      getString: (key: string) => values.get(key),
      set: (key: string, value: unknown) => values.set(key, String(value)),
      remove: (key: string) => values.delete(key),
    },
  };
});

test('normalizes browser addresses and searches', () => {
  expect(normalizeBrowserInput('example.com/a')).toBe('https://example.com/a');
  expect(normalizeBrowserInput('阅读 app')).toContain('google.com/search?q=');
  expect(normalizeBrowserInput('https://a.test')).toBe('https://a.test');
});
test('blocks non web schemes inside browser', () => {
  expect(isBrowserNavigationAllowed('https://a.test')).toBe(true);
  expect(isBrowserNavigationAllowed('javascript:alert(1)')).toBe(false);
  expect(isBrowserNavigationAllowed('file:///tmp/a')).toBe(false);
});
test('normalizes server port boundaries', () => {
  expect(normalizePort(8080)).toBe(8080);
  expect(normalizePort(80)).toBe(1122);
  expect(normalizePort('bad')).toBe(1122);
});
test('classifies external browser schemes without allowing script URLs', () => {
  expect(isExternalBrowserScheme('legado://import/a')).toBe(true);
  expect(isExternalBrowserScheme('mailto:a@example.com')).toBe(true);
  expect(isExternalBrowserScheme('javascript:alert(1)')).toBe(false);
});
test('derives safe download names from disposition or URL', () => {
  expect(
    browserDownloadName(
      'https://a.test/file.bin',
      "attachment; filename*=UTF-8''book%20one.epub",
    ),
  ).toBe('book one.epub');
  expect(browserDownloadName('https://a.test/files/story.txt')).toBe(
    'story.txt',
  );
});
test('web service authenticates and serves the persisted bookshelf, including an empty installation', async () => {
  const handler = createLocalWebServiceHandler({ port: 1122, token: 'secret' });
  const request = (path: string, token?: string) =>
    handler({
      requestId: '1',
      method: 'GET',
      path,
      headers: token ? { 'x-legado-token': token } : {},
    });
  expect((await request('/getBookshelf')).statusCode).toBe(401);
  const page = await request('/', 'secret');
  expect(page.headers?.['content-type']).toContain('text/html');
  expect(page.body).toContain('Legado HTYF Web');
  expect(page.body).toContain('addLocalBook');
  expect(
    JSON.parse(String((await request('/getBookshelf', 'secret')).body)).data,
  ).toEqual([]);
  await saveLibrary([
    {
      id: 'test-import',
      name: 'Imported book',
      author: '',
      intro: '',
      chapterTitle: 'Chapter',
      content: 'Text',
      progress: 0,
      updatedAt: 1,
    },
  ]);
  expect(
    JSON.parse(String((await request('/getBookshelf', 'secret')).body)).data[0],
  ).toMatchObject({ id: 'test-import', name: 'Imported book' });
});
test('web service accepts Android-compatible postData source management', async () => {
  const handler = createLocalWebServiceHandler({ port: 1122, token: '' }),
    source = {
      bookSourceUrl: 'https://source.test',
      bookSourceName: 'Test',
      bookSourceType: 0,
      customOrder: 0,
      enabled: true,
      enabledExplore: true,
    },
    body = new URLSearchParams({
      postData: JSON.stringify([source]),
    }).toString();
  const saved = await handler({
      requestId: '2',
      method: 'POST',
      path: '/saveBookSources',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    }),
    listed = await handler({
      requestId: '3',
      method: 'GET',
      path: '/getBookSources',
      headers: {},
    });
  expect(saved.statusCode).toBe(200);
  expect(JSON.parse(String(listed.body)).data[0].bookSourceUrl).toBe(
    source.bookSourceUrl,
  );
});
test('web service imports a bounded binary local ebook upload', async () => {
  const handler = createLocalWebServiceHandler({ port: 1122, token: '' }),
    response = await handler({
      requestId: '4',
      method: 'POST',
      path: '/addLocalBook?fileName=story.txt',
      headers: {},
      binaryBody: new Uint8Array([98, 111, 111, 107]).buffer,
    });
  expect(response.statusCode).toBe(200);
  expect(JSON.parse(String(response.body)).data.name).toBe('story');
});
test('web image proxy rejects non HTTP resources', async () => {
  const response = await createLocalWebServiceHandler({
    port: 1122,
    token: '',
  })({
    requestId: '5',
    method: 'GET',
    path: '/image?path=' + encodeURIComponent('file:///secret'),
    headers: {},
  });
  expect(response.statusCode).toBe(400);
  expect(JSON.parse(String(response.body)).errorMsg).toContain('HTTP');
});

test('concurrent Web imports and progress writes retain every book in the shared shelf', async () => {
  await saveLibrary([]);
  const handler = createLocalWebServiceHandler({ port: 1122, token: '' });
  const book = (id: string) => ({
    id,
    name: id,
    author: '',
    intro: '',
    chapterTitle: 'C',
    content: 'Text',
    progress: 0,
    updatedAt: 1,
  });
  const post = (path: string, body: unknown) =>
    handler({
      requestId: path,
      method: 'POST',
      path,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  await Promise.all([
    post('/saveBook', book('one')),
    post('/saveBook', book('two')),
  ]);
  await Promise.all([
    post('/saveBookProgress', { id: 'one', progress: 0.5 }),
    post('/saveBook', book('three')),
  ]);
  const result = await handler({
    requestId: 'read',
    method: 'GET',
    path: '/getBookshelf',
    headers: {},
  });
  const books = JSON.parse(String(result.body)).data;
  expect(books.map((item: { id: string }) => item.id).sort()).toEqual([
    'one',
    'three',
    'two',
  ]);
  expect(books.find((item: { id: string }) => item.id === 'one').progress).toBe(
    0.5,
  );
});

test('public Web bootstrap contains no private data while bookshelf and image APIs still require the configured token', async () => {
  const library = jest.requireActual('../src/data/library'),
    covers = jest.requireActual('../src/services/webBookCover');
  const load = jest.spyOn(library, 'loadLibrary'),
    image = jest
      .spyOn(covers, 'webBookCover')
      .mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'image/png' },
        body: new ArrayBuffer(24),
      });
  try {
    const handler = createLocalWebServiceHandler({
        port: 1122,
        token: 'public-fixture-token',
      }),
      get = (path: string, headers: Record<string, string> = {}) =>
        handler({ requestId: 'auth', method: 'GET', path, headers });
    const page = await get('/');
    expect(page.statusCode).toBe(200);
    expect(String(page.body)).not.toContain('public-fixture-token');
    expect(load).not.toHaveBeenCalled();
    expect((await get('/getBookshelf')).statusCode).toBe(401);
    expect((await get('/cover?id=one')).statusCode).toBe(401);
    expect(image).not.toHaveBeenCalled();
    expect(
      (await get('/cover?id=one', { 'X-Legado-Token': 'public-fixture-token' }))
        .statusCode,
    ).toBe(200);
    expect(
      (await get('/cover?id=one&token=public-fixture-token')).statusCode,
    ).toBe(200);
  } finally {
    load.mockRestore();
    image.mockRestore();
  }
});
test('the shipped Web script uses authorized local cover routes and runs when the page URL supplies its token', async () => {
  const page = await createLocalWebServiceHandler({
      port: 1122,
      token: 'public-fixture-token',
    })({ requestId: 'page', method: 'GET', path: '/', headers: {} }),
    script = String(page.body).match(/<script>([\s\S]*)<\/script>/)![1];
  const app = { innerHTML: '', textContent: '' },
    token = { value: '', onchange: undefined },
    ebook = { files: [] };
  const document = {
    querySelector: (selector: string) =>
      selector === '#app' ? app : selector === '#token' ? token : ebook,
  };
  const fetcher = jest.fn(async () => ({
    json: async () => ({
      isSuccess: true,
      data: [
        {
          id: 'book with space',
          name: '<private name>',
          author: 'Author',
          coverUrl: 'https://source.test/old.png',
          persistedCoverUrl: '/private/covers/new.cover',
        },
      ],
    }),
  }));
  const run = new Function(
    'document',
    'window',
    'localStorage',
    'location',
    'fetch',
    script.replace(/loadBooks\(\)\s*$/, 'return loadBooks()'),
  );
  await run(
    document,
    {},
    { legadoToken: 'stale' },
    { search: '?token=public-fixture-token' },
    fetcher,
  );
  expect(fetcher).toHaveBeenCalledWith(
    '/getBookshelf',
    expect.objectContaining({
      headers: { 'x-legado-token': 'public-fixture-token' },
    }),
  );
  expect(app.innerHTML).toContain(
    '/cover?id=book%20with%20space&token=public-fixture-token',
  );
  expect(app.innerHTML).toContain('&lt;private name&gt;');
  expect(app.innerHTML).not.toContain('/private/covers/new.cover');
  expect(app.innerHTML).not.toContain('https://source.test/old.png');
});
