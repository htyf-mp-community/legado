import { appStorage } from './storage';

export const LOCAL_PASSWORD_KEY = 'backup.local-password.v1';

export function loadLocalPassword() {
  return appStorage.getString(LOCAL_PASSWORD_KEY) ?? '';
}

export function saveLocalPassword(value: string) {
  const password = value.trim();
  if (password) appStorage.set(LOCAL_PASSWORD_KEY, password);
  else appStorage.remove(LOCAL_PASSWORD_KEY);
  return password;
}
