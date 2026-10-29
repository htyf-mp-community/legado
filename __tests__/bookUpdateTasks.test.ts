const mockTaskStore = new Map<string, string>();
jest.mock('react-native-quick-crypto', () => require('crypto'));
jest.mock('../src/data/storage', () => ({
  appStorage: {
    getString: (key: string) => mockTaskStore.get(key),
    set: (key: string, value: string) => mockTaskStore.set(key, value),
  },
}));
import type { Book } from '../src/types';
import {
  buildBookUpdateTasks,
  bookUpdateTaskId,
  findBookUpdateTask,
} from '../src/core/bookUpdateTasks';
import { createBookUpdateTasks } from '../src/services/bookUpdateTasks';
import {
  DEFAULT_AUTO_TASK_CRON,
  loadAutoTasksStrict,
  mergeAutoTasks,
  saveAutoTasks,
  type AutoTaskRule,
} from '../src/data/autoTasks';
const book = (
  bookUrl = 'https://source/book',
  patch: Partial<Book> = {},
): Book => ({
  id: bookUrl,
  bookUrl,
  name: 'Name',
  author: 'Author',
  intro: '',
  content: '',
  chapterTitle: '',
  progress: 0,
  updatedAt: 1,
  ...patch,
});
const make = (value: Book, patch: Partial<AutoTaskRule> = {}) => ({
  ...buildBookUpdateTasks(
    [value],
    [],
    DEFAULT_AUTO_TASK_CRON,
    item => `更新 ${item.name}`,
  )[0],
  ...patch,
});
beforeEach(() => mockTaskStore.clear());
test('uses the native MD5 middle 16 hexadecimal digits and exact generated protocol defaults', () => {
  expect(bookUpdateTaskId('abc')).toBe('book_update:3cd24fb0d6963f7d');
  const task = make(book());
  expect(task).toMatchObject({
    cron: '*/30 * * * *',
    enable: true,
    enabledCookieJar: true,
    lastRunAt: 0,
  });
  expect(JSON.parse(task.script.slice(1, -1))).toEqual({
    type: 'refreshToc',
    bookUrl: 'https://source/book',
    bookName: 'Name',
    bookAuthor: 'Author',
    generatedBy: 'bookUpdate',
    respectCanUpdate: true,
    notify: { enable: true, minCount: 1 },
    cache: { enable: false },
  });
});
test('regeneration retains the exact task ID, disabled state, order and run state, replacing generated action and schedule', () => {
  const current = make(book(), {
    enable: false,
    customOrder: 9,
    cron: '0 8 * * *',
    lastRunAt: 77,
    lastLog: ' log\n',
    lastResult: '',
    lastError: undefined,
    comment: 'old comment',
  });
  saveAutoTasks([current]);
  createBookUpdateTasks([book()], '* * * * *', value => `更新 ${value.name}`);
  expect(loadAutoTasksStrict()).toHaveLength(1);
  expect(loadAutoTasksStrict()[0]).toMatchObject({
    id: current.id,
    enable: false,
    customOrder: 9,
    lastRunAt: 77,
    lastLog: ' log\n',
    lastResult: '',
    cron: '* * * * *',
  });
  expect(loadAutoTasksStrict()[0].comment).toBeUndefined();
});
test('a unique generated identity follows a source change, while ambiguous/manual candidates are not reused', () => {
  const old = make(book('https://old/book'), { enable: false }),
    moved = book('https://new/book');
  expect(findBookUpdateTask([old], moved)).toBe(old);
  expect(
    buildBookUpdateTasks([moved], [old], '0 9 * * *', item => item.name)[0],
  ).toMatchObject({ id: old.id, enable: false, cron: '0 9 * * *' });
  expect(
    findBookUpdateTask([old, make(book('https://other/book'))], moved),
  ).toBeUndefined();
  expect(findBookUpdateTask([{ ...old, id: 'manual' }], moved)).toBeUndefined();
});
test('exact incoming IDs are reserved before assigning migrated aliases, and each migrated task is consumed once', () => {
  const a = book('https://new/a'),
    b = book('https://new/b'),
    alias = make(book('https://old/a')),
    exact = make(b, { enable: false });
  expect(
    buildBookUpdateTasks(
      [a, b],
      [alias, exact],
      '* * * * *',
      item => item.name,
    ).map(task => task.id),
  ).toEqual([alias.id, exact.id]);
  expect(
    buildBookUpdateTasks([a, b], [alias], '* * * * *', item => item.name).map(
      task => task.id,
    ),
  ).toEqual([alias.id, bookUpdateTaskId(b.bookUrl!)]);
});
test('generation filters local/disabled books and preserves unrelated tasks and service opt-in', () => {
  const other = make(book('https://other', { name: 'Other' }), {
    customOrder: 5,
  });
  saveAutoTasks([other]);
  mockTaskStore.set('auto.tasks.service.enabled.v1', 'false');
  expect(
    createBookUpdateTasks(
      [
        book(),
        book('file:///local', { localUri: 'file:///local' }),
        book('https://disabled', { canUpdate: false }),
      ],
      '* * * * *',
      item => item.name,
    ),
  ).toBe(1);
  expect(loadAutoTasksStrict().map(task => task.customOrder)).toEqual([5, 6]);
  expect(loadAutoTasksStrict()[0]).toEqual(other);
  expect(mockTaskStore.get('auto.tasks.service.enabled.v1')).toBe('false');
});
test('invalid Cron, no eligible books and corrupt stored task data never overwrite the store', () => {
  mockTaskStore.set('auto.tasks.v1', '{broken');
  expect(() =>
    createBookUpdateTasks([book()], 'invalid', item => item.name),
  ).toThrow('Cron');
  expect(() =>
    createBookUpdateTasks([book()], '* * * * *', item => item.name),
  ).toThrow('原始数据已保留');
  expect(mockTaskStore.get('auto.tasks.v1')).toBe('{broken');
  expect(() =>
    createBookUpdateTasks(
      [book('file:///local', { origin: 'local' })],
      '* * * * *',
      item => item.name,
    ),
  ).toThrow('没有可更新');
});
test('an empty stored collection accepts generation, while cleared local run state wins over imported foreign state', () => {
  saveAutoTasks([]);
  createBookUpdateTasks([book()], '* * * * *', item => item.name);
  expect(loadAutoTasksStrict()).toHaveLength(1);
  const local = make(book(), {
      lastError: undefined,
      lastLog: '',
      lastResult: undefined,
    }),
    incoming = { ...local, lastError: 'foreign error', lastLog: 'foreign log' };
  expect(mergeAutoTasks([local], [incoming])[0]).toMatchObject({
    lastError: undefined,
    lastLog: '',
    lastResult: undefined,
  });
});
