import { NativeModules, Platform } from 'react-native';
import { appStorage } from './storage';

const KEY = 'platform.launcher-icon.v1';
export type LauncherIcon = 'default' | 'green' | 'night' | 'paper';
export type LauncherIconErrorCode = 'invalid' | 'android-only' | 'module-unavailable';
export class LauncherIconError extends Error {
  constructor(readonly code: LauncherIconErrorCode) {
    super(code);
    this.name = 'LauncherIconError';
  }
}
export const launcherIcons: LauncherIcon[] = ['default', 'green', 'night', 'paper'];
export function loadLauncherIcon(): LauncherIcon {
  const value = appStorage.getString(KEY);
  return launcherIcons.includes(value as LauncherIcon) ? value as LauncherIcon : 'default';
}
export async function setLauncherIcon(value: LauncherIcon) {
  if (!launcherIcons.includes(value)) throw new LauncherIconError('invalid');
  if (Platform.OS !== 'android') throw new LauncherIconError('android-only');
  const module = NativeModules.LegadoLauncherIcon as { setIcon?: (name: string) => Promise<string> } | undefined;
  if (!module?.setIcon) throw new LauncherIconError('module-unavailable');
  await module.setIcon(value);
  appStorage.set(KEY, value);
  return value;
}
