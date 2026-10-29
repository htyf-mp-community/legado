import type { Book, BookChapter, BookSource, SearchBook } from '../src/types';
let mockBooks: Book[] = [],
  mockDelay = 0,
  mockStorageFailure = false;
jest.mock('../src/data/library', () => ({
  updateLibrary: async (change: (books: Book[]) => Book[]) => {
    if (mockStorageFailure) throw new Error('disk full');
    mockBooks = change(mockBooks);
    return mockBooks;
  },
}));
jest.mock('../src/data/batchSourcePreferences', () => ({
  loadBatchSourceDelay: () => mockDelay,
}));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
jest.mock('../src/core/webBook', () => ({
  searchSource: jest.fn(),
  loadBookInfo: jest.fn(),
  loadChapters: jest.fn(),
}));
import { startBatchSourceChange } from '../src/services/batchSourceChange';
import { abortableDelay } from '../src/core/cancellation';
import { addAppLog } from '../src/data/appLog';
const source: BookSource = {
  bookSourceUrl: 'new',
  bookSourceName: 'New',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: false,
};
const book = (name = 'Book'): Book => ({
  id: name,
  name,
  author: 'A',
  intro: '',
  origin: 'old',
  bookUrl: `/old/${name}`,
  chapterTitle: '第二章 远行',
  content: 'old',
  progress: 0.35,
  updatedAt: 1,
  currentChapterIndex: 1,
  canUpdate: false,
  chapters: [
    { id: 'one', title: '第一章', content: '' },
    { id: 'two', title: '第二章 远行', content: 'old' },
  ],
  groupIds: ['1'],
  persistedCoverUrl: '/old.cover',
  updateError: true,
});
const candidate = (name = 'Book'): SearchBook => ({
  name,
  author: 'A',
  origin: 'new',
  originName: 'New',
  bookUrl: `/new/${name}`,
});
const chapters = (name = 'Book'): BookChapter[] => [
  {
    url: `/new/${name}/1`,
    title: '第一章',
    index: 0,
    bookUrl: `/new/${name}`,
    baseUrl: '/toc',
    isVolume: false,
    isVip: false,
    isPay: false,
  },
  {
    url: `/new/${name}/2`,
    title: '第二章 远行',
    index: 1,
    bookUrl: `/new/${name}`,
    baseUrl: '/toc',
    isVolume: false,
    isVip: false,
    isPay: false,
  },
];
const effects = () => ({
  search: jest.fn(
    async (
      _source: BookSource,
      name: string,
      _page?: number,
      _signal?: AbortSignal,
    ) => [{ ...candidate(name), author: 'Wrong' }, candidate(name)],
  ),
  info: jest.fn(
    async (_source: BookSource, value: SearchBook, _signal?: AbortSignal) => ({
      ...value,
      tocUrl: '/toc',
    }),
  ),
  toc: jest.fn(
    async (_source: BookSource, value: SearchBook, _signal?: AbortSignal) =>
      chapters(value.name),
  ),
  pause: jest.fn(async () => undefined),
});
beforeEach(() => {
  jest.clearAllMocks();
  mockBooks = [book()];
  mockDelay = 0;
  mockStorageFailure = false;
});
afterEach(() => jest.useRealTimers());
test('skips local and current-source selections, changes disabled-update books, and waits after the last TOC', async () => {
  const local = { ...book('Local'), origin: 'local' },
    same = { ...book('Same'), origin: 'new' };
  mockBooks = [local, same, book()];
  mockDelay = 2;
  const f = effects(),
    progress = jest.fn();
  expect(
    await startBatchSourceChange(mockBooks, source, progress, f).promise,
  ).toEqual({ updated: 1, skipped: 2, failed: 0 });
  expect(f.search).toHaveBeenCalledTimes(1);
  expect(f.info).toHaveBeenCalledWith(
    source,
    candidate(),
    expect.any(AbortSignal),
  );
  expect(f.pause).toHaveBeenCalledWith(2000, expect.any(AbortSignal));
  expect(progress.mock.calls).toEqual([
    [1, 3],
    [2, 3],
    [3, 3],
  ]);
  expect(mockBooks[2]).toMatchObject({
    origin: 'new',
    bookUrl: '/new/Book',
    canUpdate: false,
    currentChapterIndex: 1,
    progress: 0.35,
    persistedCoverUrl: '/old.cover',
    updateError: false,
  });
});
test('search and info failures continue without delay; TOC failure still waits before the next selection', async () => {
  mockBooks = ['Search', 'Info', 'Toc', 'Works'].map(book);
  const old = [...mockBooks],
    f = effects();
  f.search.mockImplementation(async (_source, name) =>
    name === 'Search' ? [] : [candidate(name)],
  );
  f.info.mockImplementation(async (_source, value) => {
    if (value.name === 'Info') throw new Error('info failed');
    return { ...value, tocUrl: '/toc' };
  });
  f.toc.mockImplementation(async (_source, value) => {
    if (value.name === 'Toc') throw new Error('toc failed');
    return chapters(value.name);
  });
  expect(
    await startBatchSourceChange(mockBooks, source, undefined, f).promise,
  ).toEqual({ updated: 1, skipped: 0, failed: 3 });
  expect(f.pause).toHaveBeenCalledTimes(2);
  expect(mockBooks.slice(0, 3)).toEqual(old.slice(0, 3));
  expect(addAppLog).toHaveBeenCalledTimes(3);
});
test('search metadata with a TOC skips the info request', async () => {
  const f = effects();
  f.search.mockResolvedValue([{ ...candidate(), tocUrl: '/direct-toc' }]);
  expect(
    (await startBatchSourceChange(mockBooks, source, undefined, f).promise)
      .updated,
  ).toBe(1);
  expect(f.info).not.toHaveBeenCalled();
  expect(f.toc).toHaveBeenCalledWith(
    source,
    expect.objectContaining({ tocUrl: '/direct-toc' }),
    expect.any(AbortSignal),
  );
});
test('late TOC completion uses current progress, groups, cover and concurrent imports', async () => {
  const f = effects();
  let ready!: () => void, finish!: (value: BookChapter[]) => void;
  const started = new Promise<void>(resolve => {
    ready = resolve;
  });
  f.toc.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
        ready();
      }),
  );
  const task = startBatchSourceChange(mockBooks, source, undefined, f);
  await started;
  mockBooks = [
    {
      ...mockBooks[0],
      currentChapterIndex: 0,
      progress: 0.8,
      groupIds: ['latest'],
      persistedCoverUrl: '/latest.cover',
    },
    book('Imported'),
  ];
  finish(chapters());
  await task.promise;
  expect(mockBooks[0]).toMatchObject({
    currentChapterIndex: 0,
    progress: 0.8,
    groupIds: ['latest'],
    persistedCoverUrl: '/latest.cover',
    origin: 'new',
  });
  expect(mockBooks[1].id).toBe('Imported');
});
test.each(['removed', 'changed-source'])(
  '%s during an in-flight TOC cannot be overwritten or recreated',
  async state => {
    const f = effects();
    let ready!: () => void, finish!: (value: BookChapter[]) => void;
    const started = new Promise<void>(resolve => {
      ready = resolve;
    });
    f.toc.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
          ready();
        }),
    );
    const task = startBatchSourceChange(mockBooks, source, undefined, f);
    await started;
    mockBooks =
      state === 'removed'
        ? []
        : [{ ...book(), origin: 'chosen-elsewhere', bookUrl: '/elsewhere' }];
    const expected = [...mockBooks];
    finish(chapters());
    expect(await task.promise).toEqual({ updated: 0, skipped: 1, failed: 0 });
    expect(mockBooks).toEqual(expected);
  },
);
test.each(['search', 'info', 'toc'] as const)(
  'cancels during %s and makes no partial book write',
  async stage => {
    const f = effects();
    let ready!: () => void;
    const started = new Promise<void>(resolve => {
      ready = resolve;
    });
    const waiting = (signal: AbortSignal) =>
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })),
        );
        ready();
      });
    if (stage === 'search')
      f.search.mockImplementation((_source, _name, _page, signal) =>
        waiting(signal!),
      );
    if (stage === 'info')
      f.info.mockImplementation((_source, _value, signal) => waiting(signal!));
    if (stage === 'toc')
      f.toc.mockImplementation((_source, _value, signal) => waiting(signal!));
    const old = [...mockBooks],
      task = startBatchSourceChange(mockBooks, source, undefined, f),
      rejected = expect(task.promise).rejects.toMatchObject({
        name: 'AbortError',
      });
    await started;
    task.cancel();
    await rejected;
    expect(mockBooks).toEqual(old);
    expect(addAppLog).not.toHaveBeenCalled();
  },
);
test('cancelling the interval retains completed work and never starts the next selected book', async () => {
  jest.useFakeTimers();
  mockDelay = 9999;
  mockBooks = [book('First'), book('Second')];
  const f = effects();
  let paused!: () => void;
  const ready = new Promise<void>(resolve => {
    paused = resolve;
  });
  const pause = (ms: number, signal: AbortSignal) => {
    paused();
    return abortableDelay(ms, signal);
  };
  const task = startBatchSourceChange(mockBooks, source, undefined, {
      ...f,
      pause,
    }),
    rejected = expect(task.promise).rejects.toMatchObject({
      name: 'AbortError',
    });
  await ready;
  task.cancel();
  await rejected;
  expect(mockBooks[0].origin).toBe('new');
  expect(mockBooks[1].origin).toBe('old');
  expect(f.search).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
test('a restarted batch cannot be overwritten by the previous request even if it ignores abort', async () => {
  const first = effects(),
    second = effects();
  let ready!: () => void, finish!: (value: SearchBook[]) => void;
  const started = new Promise<void>(resolve => {
    ready = resolve;
  });
  first.search.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
        ready();
      }),
  );
  const old = startBatchSourceChange(mockBooks, source, undefined, first),
    cancelled = expect(old.promise).rejects.toMatchObject({
      name: 'AbortError',
    });
  await started;
  const next = startBatchSourceChange(mockBooks, source, undefined, second);
  await next.promise;
  const expected = [...mockBooks];
  finish([candidate()]);
  await cancelled;
  expect(mockBooks).toEqual(expected);
});
test('a storage failure stops the batch instead of being treated as a recoverable source error', async () => {
  mockBooks = [book('First'), book('Second')];
  mockStorageFailure = true;
  const f = effects();
  await expect(
    startBatchSourceChange(mockBooks, source, undefined, f).promise,
  ).rejects.toThrow('disk full');
  expect(f.search).toHaveBeenCalledTimes(1);
  expect(f.pause).not.toHaveBeenCalled();
  expect(mockBooks[0].origin).toBe('old');
});
