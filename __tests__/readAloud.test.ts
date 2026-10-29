import {
  ReadAloudController,
  type ReadAloudDriver,
  type ReadAloudState,
} from '../src/core/readAloud';
jest.mock('../src/core/sourceRequest', () => ({
  buildSourceRequest: jest.fn(),
}));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function fixture(speak?: ReadAloudDriver['speak']) {
  const states: ReadAloudState[] = [];
  const driver = {
    speak: jest.fn(
      speak ?? (async (_text, _index, _signal, started) => started()),
    ),
    stop: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
    resume: jest.fn(async () => {}),
  };
  return {
    states,
    driver,
    controller: new ReadAloudController(driver, value => states.push(value)),
  };
}
afterEach(() => jest.useRealTimers());
test('reads paragraphs in order, skips punctuation and inserts only inter-paragraph pauses', async () => {
  jest.useFakeTimers();
  const { controller, driver, states } = fixture();
  const done = controller.start(['first', '……', 'third'], 0, 250);
  await flush();
  expect(driver.speak).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(250);
  expect(driver.speak).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(250);
  await done;
  expect(driver.speak.mock.calls.map(call => call[0])).toEqual([
    'first',
    'third',
  ]);
  expect(states.at(-1)).toEqual({
    status: 'ended',
    paragraph: 2,
    error: undefined,
  });
});
test('stopping during a paragraph aborts its request and ignores late completion', async () => {
  let finish!: () => void;
  const { controller, driver, states } = fixture(
    async (_text, _index, _signal, started) => {
      started();
      await new Promise<void>(resolve => {
        finish = resolve;
      });
    },
  );
  const done = controller.start(['one', 'two'], 0, 0);
  await flush();
  const signal = driver.speak.mock.calls[0][2];
  await controller.stop();
  expect(signal.aborted).toBe(true);
  finish();
  await done;
  expect(driver.speak).toHaveBeenCalledTimes(1);
  expect(states.at(-1)?.status).toBe('idle');
});
test('new session invalidates pending setup before any stale paragraph starts', async () => {
  let release!: () => void;
  const { controller, driver } = fixture();
  driver.stop.mockImplementationOnce(
    async () =>
      new Promise<void>(resolve => {
        release = resolve;
      }),
  );
  const old = controller.start(['old'], 0, 0),
    current = controller.start(['new'], 0, 0);
  await current;
  release();
  await old;
  expect(driver.speak.mock.calls.map(call => call[0])).toEqual(['new']);
});
test('errors pause the session visibly without advancing to another paragraph', async () => {
  const { controller, states, driver } = fixture(async () => {
    throw new Error('HTTP 401');
  });
  await controller.start(['one', 'two'], 0, 0);
  expect(states.at(-1)).toEqual({
    status: 'error',
    paragraph: 0,
    error: 'HTTP 401',
  });
  expect(driver.speak).toHaveBeenCalledTimes(1);
});
test('pause and resume retain the same paragraph rather than starting another request', async () => {
  let finish!: () => void;
  const { controller, driver, states } = fixture(
    async (_text, _index, _signal, started) => {
      started();
      await new Promise<void>(resolve => {
        finish = resolve;
      });
    },
  );
  const done = controller.start(['one'], 0, 0);
  await flush();
  await controller.pause();
  expect(states.at(-1)?.status).toBe('paused');
  await controller.resume();
  expect(states.at(-1)?.status).toBe('playing');
  expect(driver.speak).toHaveBeenCalledTimes(1);
  finish();
  await done;
});

test('pausing and resuming during download does not try to play an empty native queue', async () => {
  let finish!: () => void;
  const { controller, driver } = fixture(async () => {
    await new Promise<void>(resolve => {
      finish = resolve;
    });
  });
  const done = controller.start(['one'], 0, 0);
  await flush();
  await controller.pause();
  await controller.resume();
  expect(driver.pause).not.toHaveBeenCalled();
  expect(driver.resume).not.toHaveBeenCalled();
  finish();
  await done;
});
