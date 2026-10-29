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
import { executeAutoTaskProtocolAction } from '../src/services/autoTaskProtocol';
import { loadLibrary, updateLibrary } from '../src/data/library';
import { loadSources } from '../src/data/sources';
import {
  loadBookInfo,
  loadChapterContent,
  loadChapters,
} from '../src/core/webBook';
import type { Book } from '../src/types';
import type { AutoTaskRule } from '../src/data/autoTasks';
const task: AutoTaskRule = {
  id: 'task',
  name: 'Task',
  script: '{}',
  enable: true,
  cron: '* * * * *',
  enabledCookieJar: true,
  customOrder: 0,
  lastRunAt: 0,
};
let stored: Book[];
beforeEach(() => {
  jest.resetAllMocks();
  stored = [
    {
      id: 'book',
      bookUrl: 'https://source/old',
      origin: 'source',
      name: 'Old',
      author: 'Author',
      intro: '',
      chapters: [],
      chapterTitle: '',
      content: '',
      progress: 0,
      updatedAt: 1,
    },
  ];
  jest.mocked(loadLibrary).mockImplementation(async () => stored);
  jest.mocked(updateLibrary).mockImplementation(async transform => {
    stored = transform(stored);
    return stored;
  });
  jest
    .mocked(loadSources)
    .mockResolvedValue([
      {
        bookSourceUrl: 'source',
        bookSourceName: 'Source',
        enabled: true,
        enabledExplore: false,
        customOrder: 0,
        bookSourceType: 0,
      },
    ]);
  jest
    .mocked(loadBookInfo)
    .mockImplementation(async (_source, value) => ({
      ...value,
      name: 'Canonical',
      author: 'Canonical author',
      bookUrl: 'https://source/canonical',
      intro: '',
      coverUrl: undefined,
      tocUrl: 'https://source/toc',
      latestChapterTitle: undefined,
    }));
  jest
    .mocked(loadChapters)
    .mockResolvedValue([
      {
        index: 0,
        title: 'One',
        url: '/one',
        bookUrl: 'https://source/canonical',
        baseUrl: 'https://source/toc',
        isVolume: false,
        isVip: false,
        isPay: false,
      },
    ]);
});
test('first refresh uses information-derived identity and metadata for notification, caching and summary', async () => {
  jest.mocked(loadChapterContent).mockResolvedValue('Body');
  const notify = jest.fn(async () => true);
  await expect(
    executeAutoTaskProtocolAction(
      {
        type: 'refreshToc',
        bookUrl: 'https://source/old',
        notify: { enable: true },
        cache: { enable: true },
      },
      task,
      { notify },
    ),
  ).resolves.toBe('Canonical: +1, notified, cached 1');
  expect(notify).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Canonical 已更新' }),
  );
  expect(loadChapterContent).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ bookUrl: 'https://source/canonical' }),
  );
  expect(stored[0].content).toBe('Body');
});
test('deletion while fetching chapter content aborts cache completion instead of claiming it was saved', async () => {
  jest.mocked(loadChapterContent).mockImplementation(async () => {
    stored = [];
    return 'Body';
  });
  await expect(
    executeAutoTaskProtocolAction(
      {
        type: 'refreshToc',
        bookUrl: 'https://source/old',
        cache: { enable: true },
      },
      task,
    ),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(loadChapterContent).toHaveBeenCalledTimes(1);
  expect(stored).toEqual([]);
});
