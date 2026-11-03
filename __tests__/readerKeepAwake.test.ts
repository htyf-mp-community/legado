jest.mock('../src/data/storage', () => ({appStorage:{getString:jest.fn(),set:jest.fn()}}));
import {ReaderKeepAwakeController} from '../src/core/readerKeepAwake';
import {normalizeReaderPreferences} from '../src/data/readerPreferences';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('defaults to system timeout and accepts the original timeout choices', () => {
  expect(normalizeReaderPreferences({}).screenTimeoutSeconds).toBe(0);
  for (const value of [-1, 0, 60, 300, 600] as const)
    expect(normalizeReaderPreferences({screenTimeoutSeconds:value}).screenTimeoutSeconds).toBe(value);
  expect(normalizeReaderPreferences({screenTimeoutSeconds:12 as never}).screenTimeoutSeconds).toBe(0);
});

test('releases a timed lock after inactivity and restarts it on reading interaction', async () => {
  const activate=jest.fn().mockResolvedValue(undefined), deactivate=jest.fn().mockResolvedValue(undefined);
  const controller=new ReaderKeepAwakeController({activate,deactivate},'reader');
  controller.configure(true,true,60);
  await controller.settled();
  expect(activate).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(59_000);
  controller.interact();
  jest.advanceTimersByTime(59_000);
  await controller.settled();
  expect(deactivate).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1_000);
  await controller.settled();
  expect(deactivate).toHaveBeenCalledTimes(1);
  controller.interact();
  await controller.settled();
  expect(activate).toHaveBeenCalledTimes(2);
  controller.dispose();
  await controller.settled();
  expect(deactivate).toHaveBeenCalledTimes(2);
});

test('releases on background, blur, system setting and disposal', async () => {
  const activate=jest.fn().mockResolvedValue(undefined), deactivate=jest.fn().mockResolvedValue(undefined);
  const controller=new ReaderKeepAwakeController({activate,deactivate},'reader');
  controller.configure(true,true,-1); await controller.settled();
  controller.configure(true,false,-1); await controller.settled();
  controller.configure(true,true,-1); await controller.settled();
  controller.configure(false,true,-1); await controller.settled();
  controller.configure(true,true,-1); await controller.settled();
  controller.configure(true,true,0); await controller.settled();
  controller.dispose(); await controller.settled();
  expect(activate).toHaveBeenCalledTimes(3);
  expect(deactivate).toHaveBeenCalledTimes(3);
});

test('serializes native calls so late activation cannot leak after unmount', async () => {
  let complete!: () => void;
  const activate=jest.fn().mockImplementation(() => new Promise<void>(resolve => {complete=resolve;}));
  const deactivate=jest.fn().mockResolvedValue(undefined);
  const controller=new ReaderKeepAwakeController({activate,deactivate},'reader');
  controller.configure(true,true,-1);
  await Promise.resolve();
  controller.dispose();
  expect(deactivate).not.toHaveBeenCalled();
  complete();
  await controller.settled();
  expect(deactivate).toHaveBeenCalledTimes(1);
});

test('retries a failed release on disposal and reports the failure', async () => {
  const activate=jest.fn().mockResolvedValue(undefined), deactivate=jest.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValue(undefined), onError=jest.fn();
  const controller=new ReaderKeepAwakeController({activate,deactivate},'reader',onError);
  controller.configure(true,true,-1); await controller.settled();
  controller.configure(false,true,-1); await controller.settled();
  expect(onError).toHaveBeenCalledTimes(1);
  controller.dispose(); await controller.settled();
  expect(deactivate).toHaveBeenCalledTimes(2);
});

test('retries cleanup if activation and its defensive release both fail', async () => {
  const activate=jest.fn().mockRejectedValueOnce(new Error('activation failed'));
  const deactivate=jest.fn().mockRejectedValueOnce(new Error('release failed')).mockResolvedValue(undefined);
  const controller=new ReaderKeepAwakeController({activate,deactivate},'reader');
  controller.configure(true,true,-1); await controller.settled();
  controller.dispose(); await controller.settled();
  expect(deactivate).toHaveBeenCalledTimes(2);
});

test('does not discard a newer activation request after an older one fails', async () => {
  let fail!: (error: Error) => void;
  const activate=jest.fn().mockImplementationOnce(() => new Promise<void>((_resolve,reject) => {fail=reject;})).mockResolvedValue(undefined);
  const deactivate=jest.fn().mockResolvedValue(undefined);
  const controller=new ReaderKeepAwakeController({activate,deactivate},'reader');
  controller.configure(true,true,-1); await Promise.resolve();
  controller.configure(false,true,-1);
  controller.configure(true,true,-1);
  fail(new Error('failed')); await controller.settled();
  expect(activate).toHaveBeenCalledTimes(2);
  controller.dispose(); await controller.settled();
  expect(deactivate).toHaveBeenCalledTimes(2);
});
