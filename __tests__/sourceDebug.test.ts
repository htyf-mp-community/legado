jest.mock('../src/data/storage', () => ({
  appStorage: {
    getString: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

import { runSourceDebug, SourceDebugPipelineError } from '../src/core/sourceDebug';
import type { BookSource } from '../src/types';

const source: BookSource = {
  bookSourceUrl: 'https://debug.example',
  bookSourceName: '调试源',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
  searchUrl: '/search?key={{key}}',
  ruleSearch: {
    bookList: '$.books[*]',
    name: '$.name',
    author: '$.author',
    bookUrl: '$.url',
  },
  ruleBookInfo: {
    name: '$.name',
    author: '$.author',
    tocUrl: '$.toc',
  },
  ruleToc: {
    chapterList: '$.chapters[*]',
    chapterName: '$.name',
    chapterUrl: '$.url',
  },
  ruleContent: { content: '$.content' },
};

test('runs search, detail, toc and content stages in order', async () => {
  const responses = [
    { books: [{ name: '测试书', author: '作者', url: '/book' }] },
    { name: '测试书', author: '作者', toc: '/toc' },
    { chapters: [{ name: '第一章', url: '/chapter/1' }] },
    { content: '<p>正文</p>' },
  ];
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
    async (input: Parameters<typeof fetch>[0]) =>
      ({
        ok: true,
        headers: { get: () => null },
        text: async () => JSON.stringify(responses.shift()),
        url: String(input),
      }) as unknown as Response,
  );
  const events: string[] = [];
  const result = await runSourceDebug(source, '测试', event =>
    events.push(`${event.stage}:${event.status}`),
  );
  expect(result.content).toBe('　　　　正文\n　　');
  expect(events).toEqual([
    'search:running',
    'search:success',
    'info:running',
    'info:success',
    'toc:running',
    'toc:success',
    'content:running',
    'content:success',
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(4);
  fetchMock.mockRestore();
});

test('emits the failing stage and stops the pipeline', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false,
    status: 503,
    headers: { get: () => null },
    text: async () => '',
    url: 'https://debug.example/search',
    } as unknown as Response);
  const events: string[] = [];
  await expect(
    runSourceDebug(source, '测试', event => events.push(event.status)),
  ).rejects.toThrow('HTTP 503');
  expect(events).toEqual(['running', 'error']);
  fetchMock.mockRestore();
});

test('uses the caller formatter for every user-facing stage message', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, headers: { get: () => null }, text: async () => JSON.stringify({ books: [] }), url: 'https://debug.example/search' } as unknown as Response);
  const messages: string[] = [];
  await expect(runSourceDebug(source, 'none', event => messages.push(event.message), (key, values = {}) => `${key}:${Object.values(values).join('|')}`)).rejects.toMatchObject({ code: 'debugNoSearchResult' });
  expect(messages).toEqual(['debugStageRunning:debugSearch:', 'debugSearchSuccess:0']);
  fetchMock.mockRestore();
});

test('returns a translatable error when contents has no readable chapter', async () => {
  const responses = [{ books: [{ name: 'Book', url: '/book' }] }, { name: 'Book', toc: '/toc' }, { chapters: [] }];
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => ({ ok: true, headers: { get: () => null }, text: async () => JSON.stringify(responses.shift()), url: 'https://debug.example' }) as unknown as Response);
  await expect(runSourceDebug(source, 'Book')).rejects.toEqual(new SourceDebugPipelineError('debugNoChapter'));
  fetchMock.mockRestore();
});
