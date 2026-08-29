const mockValues = new Map<string, string | number>();
jest.mock('../src/data/storage', () => ({
  appStorage: {
    getString: (key: string) =>
      typeof mockValues.get(key) === 'string' ? mockValues.get(key) : undefined,
    getNumber: (key: string) =>
      typeof mockValues.get(key) === 'number' ? mockValues.get(key) : undefined,
    set: (key: string, value: string | number) => mockValues.set(key, value),
    remove: (key: string) => mockValues.delete(key),
  },
}));

import {
  clearAudioSleepDeadline,
  getAudioSleepDeadline,
  loadAudioPreferences,
  saveAudioPreferences,
  setAudioSleepDeadline,
} from '../src/data/audioPreferences';

beforeEach(() => mockValues.clear());

test('persists supported playback rates and media-button policy', () => {
  expect(saveAudioPreferences({ rate: 1.5, mediaButtonPerNext: true })).toEqual({ rate: 1.5, mediaButtonPerNext: true });
  expect(loadAudioPreferences()).toEqual({ rate: 1.5, mediaButtonPerNext: true });
  expect(saveAudioPreferences({ rate: 3, mediaButtonPerNext: false })).toEqual({ rate: 1, mediaButtonPerNext: false });
});

test('stores and clears the background sleep deadline', () => {
  const deadline = Date.now() + 60_000;
  setAudioSleepDeadline(deadline);
  expect(getAudioSleepDeadline()).toBe(deadline);
  clearAudioSleepDeadline();
  expect(getAudioSleepDeadline()).toBe(0);
});
