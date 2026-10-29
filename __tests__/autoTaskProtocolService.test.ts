jest.mock('../src/data/library', () => ({
  loadLibrary: jest.fn(),
  updateLibrary: jest.fn(),
}));
jest.mock('../src/data/sources', () => ({ loadSources: jest.fn() }));
jest.mock('../src/core/webBook', () => ({
  loadBookInfo: jest.fn(),
  loadChapters: jest.fn(),
  loadChapterContent: jest.fn(),
}));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
jest.mock('../src/data/appPreferences', () => ({
  loadAppPreferences: () => ({ language: 'zh-CN' }),
  resolvedLanguage: () => 'zh-CN',
}));
import {
  executeAutoTaskProtocolAction,
  type TaskNotification,
} from '../src/services/autoTaskProtocol';
import { loadLibrary, updateLibrary } from '../src/data/library';
import { loadSources } from '../src/data/sources';
import {
  loadBookInfo,
  loadChapterContent,
  loadChapters,
} from '../src/core/webBook';
import { addAppLog } from '../src/data/appLog';
import type { Book, BookChapter } from '../src/types';
import type { AutoTaskRule } from '../src/data/autoTasks';
const task: AutoTaskRule = {
  id: 'task',
  name: '更新 Name',
  enable: true,
  cron: '* * * * *',
  script: '{}',
  enabledCookieJar: true,
  customOrder: 0,
  lastRunAt: 0,
};
const remote = (url: string, index: number, isVolume = false): BookChapter => ({
  url,
  index,
  title: url,
  bookUrl: 'https://source/book',
  baseUrl: 'https://source/toc',
  isVolume,
  isVip: false,
  isPay: false,
});
const book = (): Book => ({
  id: 'book',
  bookUrl: 'https://source/book',
  origin: 'source',
  name: 'Name',
  author: 'Author',
  intro: 'Intro',
  tocUrl: 'https://source/toc',
  chapters: [{ id: 'one', url: '/one', title: '/one', content: 'Old body' }],
  content: 'Old body',
  chapterTitle: '/one',
  progress: 0.4,
  updatedAt: 1,
});
let stored: Book[];
beforeEach(() => {
  jest.resetAllMocks();
  stored = [book()];
  jest.mocked(loadLibrary).mockImplementation(async () => stored);
  jest.mocked(updateLibrary).mockImplementation(async transform => {
    stored = transform(stored);
    return stored;
  });
  jest.mocked(loadSources).mockResolvedValue([
    {
      bookSourceUrl: 'source',
      bookSourceName: 'Source',
      bookSourceType: 0,
      enabled: true,
      enabledExplore: false,
      customOrder: 0,
    },
  ]);
  jest
    .mocked(loadChapters)
    .mockResolvedValue([
      remote('/volume', 0, true),
      remote('/one', 1),
      remote('/two', 2),
    ]);
});
test('generated tasks resolve a moved URL by exact name/author and respect disabled updates', async () => {
  stored[0].canUpdate = false;
  await expect(
    executeAutoTaskProtocolAction(
      {
        TYPE: 'refreshToc',
        bookUrl: 'old-url',
        generatedBy: 'bookUpdate',
        bookName: 'Name',
        bookAuthor: 'Author',
        respectCanUpdate: true,
      },
      task,
    ),
  ).resolves.toBe('Name：已停止更新');
  expect(loadChapters).not.toHaveBeenCalled();
  await expect(
    executeAutoTaskProtocolAction(
      {
        type: 'refreshToc',
        bookUrl: 'old-url',
        bookName: 'Name',
        bookAuthor: 'Author',
      },
      task,
    ),
  ).rejects.toThrow('book was not found');
});
test('directory refresh skips known information, preserves concurrent edits/cache and excludes volume rows from notifications', async () => {
  jest.mocked(loadChapters).mockImplementation(async () => {
    stored[0] = {
      ...stored[0],
      progress: 0.8,
      customIntro: 'Mine',
      groupIds: ['1'],
    };
    return [remote('/volume', 0, true), remote('/one', 1), remote('/two', 2)];
  });
  const notify = jest.fn(async () => true);
  await expect(
    executeAutoTaskProtocolAction(
      {
        type: 'refreshToc',
        bookUrl: 'https://source/book',
        notify: { enable: true, minCount: 1 },
      },
      task,
      { notify },
    ),
  ).resolves.toBe('Name: +1, notified');
  expect(loadBookInfo).not.toHaveBeenCalled();
  expect(stored[0]).toMatchObject({
    progress: 0.8,
    customIntro: 'Mine',
    groupIds: ['1'],
  });
  expect(
    stored[0].chapters?.find(chapter => chapter.url === '/one')?.content,
  ).toBe('Old body');
  expect(notify).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Name 已更新',
      content: '新增 1 章，最新：/two',
    }),
  );
});
test('minimum count and source-style falsy strings suppress notifications, while missing host bridge never claims delivery', async () => {
  const notify = jest.fn(async () => true);
  await executeAutoTaskProtocolAction(
    {
      type: 'refreshToc',
      bookUrl: 'https://source/book',
      notify: { enable: 'no', minCount: 0 },
    },
    task,
    { notify },
  );
  expect(notify).not.toHaveBeenCalled();
  stored = [book()];
  await executeAutoTaskProtocolAction(
    {
      type: 'refreshToc',
      bookUrl: 'https://source/book',
      notify: { enable: true, minCount: 2 },
    },
    task,
    { notify },
  );
  expect(notify).not.toHaveBeenCalled();
  stored = [book()];
  await expect(
    executeAutoTaskProtocolAction(
      {
        type: 'refreshToc',
        bookUrl: 'https://source/book',
        notify: { enable: true },
      },
      task,
    ),
  ).resolves.toBe('Name: +1');
  expect(addAppLog).toHaveBeenCalledWith(
    expect.stringContaining('notification bridge is unavailable'),
  );
});
test('cache option fetches only new non-volume chapters and retries transient content failures', async () => {
  jest
    .mocked(loadChapterContent)
    .mockRejectedValueOnce(new Error('temporary'))
    .mockResolvedValueOnce('New body');
  const pause = jest.fn(async () => {});
  await expect(
    executeAutoTaskProtocolAction(
      {
        type: 'refreshToc',
        bookUrl: 'https://source/book',
        cache: { enable: true },
      },
      task,
      { pause },
    ),
  ).resolves.toBe('Name: +1, cached 1');
  expect(loadChapterContent).toHaveBeenCalledTimes(2);
  expect(loadChapterContent).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ url: '/two', isVolume: false }),
  );
  expect(
    stored[0].chapters?.find(chapter => chapter.url === '/two')?.content,
  ).toBe('New body');
  expect(pause).toHaveBeenCalledWith(1000);
});
test('a source change during fetching cannot overwrite the new book or emit a successful refresh notification', async () => {
  jest.mocked(loadChapters).mockImplementation(async () => {
    stored[0] = { ...stored[0], origin: 'new', bookUrl: 'https://new/book' };
    return [remote('/two', 0)];
  });
  const notify = jest.fn(async () => true);
  await expect(
    executeAutoTaskProtocolAction(
      {
        type: 'refreshToc',
        bookUrl: 'https://source/book',
        notify: { enable: true },
      },
      task,
      { notify },
    ),
  ).rejects.toThrow('更新期间已删除或换源');
  expect(stored[0].content).toBe('Old body');
  expect(notify).not.toHaveBeenCalled();
});
test('standalone notification retains native templates, length limits, priority and stable explicit ID', async () => {
  const notify = jest.fn(async (_notification: TaskNotification) => true);
  await expect(
    executeAutoTaskProtocolAction(
      {
        type: 'NOTIFY',
        id: -1,
        title: '{task}',
        content: 'x'.repeat(5000),
        level: 'error',
      },
      task,
      { notify },
    ),
  ).resolves.toBe('Notification: 更新 Name');
  expect(notify.mock.calls[0][0]).toMatchObject({
    id: 33647,
    title: task.name,
    priority: 'high',
  });
  expect(notify.mock.calls[0][0].content).toHaveLength(4000);
});
