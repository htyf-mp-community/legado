let mockTaskChanged: () => void, mockStateChanged: (state: string) => void;
const mockRemove = jest.fn(),
  mockUnsubscribe = jest.fn();
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, callback: (state: string) => void) => {
      mockStateChanged = callback;
      return { remove: mockRemove };
    },
  },
}));
jest.mock('../src/data/autoTasks', () => ({
  loadAutoTasks: jest.fn(() => []),
  loadAutoTaskServiceEnabled: jest.fn(() => true),
  subscribeAutoTasks: (callback: () => void) => {
    mockTaskChanged = callback;
    return mockUnsubscribe;
  },
}));
jest.mock('../src/core/autoTask', () => ({
  nextAutoTaskAt: jest.fn(
    (_tasks: unknown, now: number) => Math.ceil((now + 1) / 60000) * 60000,
  ),
  runDueAutoTasks: jest.fn(async () => 1),
}));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
import { startAutoTaskScheduler } from '../src/services/autoTaskScheduler';
import { runDueAutoTasks } from '../src/core/autoTask';
import { loadAutoTaskServiceEnabled } from '../src/data/autoTasks';
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T10:00:30Z'));
  jest.mocked(loadAutoTaskServiceEnabled).mockReturnValue(true);
  jest.mocked(runDueAutoTasks).mockResolvedValue(1);
});
afterEach(() => jest.useRealTimers());
test('foreground tasks continue at the next Cron boundary without requiring an app resume', async () => {
  const stop = startAutoTaskScheduler();
  await flush();
  expect(runDueAutoTasks).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(29999);
  await flush();
  expect(runDueAutoTasks).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  await flush();
  expect(runDueAutoTasks).toHaveBeenCalledTimes(2);
  stop();
  expect(mockRemove).toHaveBeenCalled();
  expect(mockUnsubscribe).toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});
test('service opt-in schedules immediately, while disabling it cancels pending dispatch', async () => {
  jest.mocked(loadAutoTaskServiceEnabled).mockReturnValue(false);
  const stop = startAutoTaskScheduler();
  await flush();
  expect(runDueAutoTasks).not.toHaveBeenCalled();
  jest.mocked(loadAutoTaskServiceEnabled).mockReturnValue(true);
  mockTaskChanged();
  await flush();
  expect(runDueAutoTasks).toHaveBeenCalledTimes(1);
  jest.mocked(loadAutoTaskServiceEnabled).mockReturnValue(false);
  mockTaskChanged();
  jest.advanceTimersByTime(120000);
  await flush();
  expect(runDueAutoTasks).toHaveBeenCalledTimes(1);
  stop();
});
test('background stops dispatch and resume catches due work', async () => {
  const stop = startAutoTaskScheduler();
  await flush();
  mockStateChanged('background');
  jest.advanceTimersByTime(120000);
  await flush();
  expect(runDueAutoTasks).toHaveBeenCalledTimes(1);
  mockStateChanged('active');
  await flush();
  expect(runDueAutoTasks).toHaveBeenCalledTimes(2);
  stop();
});
test('store events during a running batch cannot start duplicate work or reschedule after cleanup', async () => {
  let resolve!: (value: number) => void;
  jest.mocked(runDueAutoTasks).mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  const stop = startAutoTaskScheduler();
  mockTaskChanged();
  mockTaskChanged();
  expect(runDueAutoTasks).toHaveBeenCalledTimes(1);
  stop();
  resolve(1);
  await flush();
  expect(jest.getTimerCount()).toBe(0);
});
test('unexpected runner failure receives a minute backoff instead of an immediate retry loop', async () => {
  jest.mocked(runDueAutoTasks).mockRejectedValueOnce(new Error('failed'));
  const stop = startAutoTaskScheduler();
  await flush();
  jest.advanceTimersByTime(59999);
  await flush();
  expect(runDueAutoTasks).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  await flush();
  expect(runDueAutoTasks).toHaveBeenCalledTimes(2);
  stop();
});
