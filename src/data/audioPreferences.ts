import { appStorage } from './storage';

const KEY = 'audio.preferences.v1';
const SLEEP_KEY = 'audio.sleep.deadline.v1';
export type AudioPreferences = {
  rate: number;
  mediaButtonPerNext: boolean;
};
export const defaultAudioPreferences: AudioPreferences = {
  rate: 1,
  mediaButtonPerNext: false,
};

export function normalizeAudioPreferences(value: Partial<AudioPreferences>) {
  const rate = Number(value.rate);
  return {
    rate: [0.5, 0.75, 1, 1.25, 1.5, 2].includes(rate) ? rate : 1,
    mediaButtonPerNext: value.mediaButtonPerNext === true,
  };
}

export function loadAudioPreferences() {
  const raw = appStorage.getString(KEY);
  if (!raw) return defaultAudioPreferences;
  try {
    return normalizeAudioPreferences(JSON.parse(raw) as AudioPreferences);
  } catch {
    return defaultAudioPreferences;
  }
}

export function saveAudioPreferences(value: AudioPreferences) {
  const normalized = normalizeAudioPreferences(value);
  appStorage.set(KEY, JSON.stringify(normalized));
  return normalized;
}

export function getAudioSleepDeadline() {
  return Math.max(0, appStorage.getNumber(SLEEP_KEY) ?? 0);
}

export function setAudioSleepDeadline(deadline: number) {
  if (deadline > Date.now()) appStorage.set(SLEEP_KEY, deadline);
  else appStorage.remove(SLEEP_KEY);
}

export function clearAudioSleepDeadline() {
  appStorage.remove(SLEEP_KEY);
}
