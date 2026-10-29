const mockTaskStore = new Map<string, string>();
jest.mock('../src/data/storage', () => ({
  appStorage: {
    getString: (key: string) => mockTaskStore.get(key),
    set: (key: string, value: string) => mockTaskStore.set(key, value),
  },
}));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
jest.mock('../src/services/autoTaskProtocol', () => ({
  executeAutoTaskProtocolAction: jest.fn(async () => 'Book: +1'),
}));
import { executeDueAutoTasks, runAutoTask } from '../src/core/autoTask';
import {
  loadAutoTasks,
  normalizeAutoTask,
  saveAutoTasks,
  updateAutoTasks,
} from '../src/data/autoTasks';
import { executeAutoTaskProtocolAction } from '../src/services/autoTaskProtocol';
const task = (id = 'one') =>
  normalizeAutoTask({
    id,
    name: id,
    cron: '* * * * *',
    script: '{"type":"http","url":"https://example.test"}',
  });
beforeEach(() => {
  mockTaskStore.clear();
  jest.clearAllMocks();
});
test('finishing an asynchronous task keeps tasks added in the meantime and preserves edits to the running task', async () => {
  let resolve!: (response: Response) => void;
  const response = new Promise<Response>(done => {
      resolve = done;
    }),
    fetcher = jest.spyOn(globalThis, 'fetch').mockReturnValue(response);
  saveAutoTasks([task()]);
  const batch = executeDueAutoTasks();
  updateAutoTasks(current => [
    { ...current[0], name: 'Edited', enable: false, cron: '0 8 * * *' },
    task('new'),
  ]);
  resolve({ ok: true, status: 200, text: async () => 'body' } as Response);
  await expect(batch).resolves.toBe(1);
  expect(loadAutoTasks()).toHaveLength(2);
  expect(loadAutoTasks()[0]).toMatchObject({
    id: 'one',
    name: 'Edited',
    enable: false,
    cron: '0 8 * * *',
    lastResult: 'body',
  });
  expect(loadAutoTasks()[1].lastRunAt).toBe(0);
  fetcher.mockRestore();
});
test('a late run result cannot recreate a task deleted during execution', async () => {
  let resolve!: (response: Response) => void;
  const fetcher = jest.spyOn(globalThis, 'fetch').mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  saveAutoTasks([task()]);
  const batch = executeDueAutoTasks();
  updateAutoTasks(() => []);
  resolve({ ok: true, status: 200, text: async () => 'body' } as Response);
  await batch;
  expect(loadAutoTasks()).toEqual([]);
  fetcher.mockRestore();
});
test('declarative protocol actions execute in order and appear as native action summaries in the debug log', async () => {
  const value = normalizeAutoTask({
    id: 'protocol',
    name: 'Task',
    script:
      '({"actions":[{"type":"refreshToc","bookUrl":"one"},{"type":"notify","title":"Done"}]})',
  });
  const result = await runAutoTask(value);
  expect(result.success).toBe(true);
  expect(executeAutoTaskProtocolAction).toHaveBeenCalledTimes(2);
  expect(result.log).toContain('- Book: +1');
  expect(result.log).toMatch(/\[OK\] \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
});
