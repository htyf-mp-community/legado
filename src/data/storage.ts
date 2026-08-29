import { createMMKV } from 'react-native-mmkv';

/** Dedicated storage namespace for the migrated Legado HTYF application. */
// TODO(htyf-native): Remove stale AsyncStorage Gradle/CocoaPods references once native-project cleanup is separately authorized.
export const APP_STORAGE_ID = 'io.legado.htyf.application-storage';
export const SENSITIVE_STORAGE_KEYS = new Set([
  'remote.webdav.password.v1',
  'backup.local-password.v1',
]);
export const ENCRYPTED_BACKUP_KEY_PREFIXES = ['source-cookie.v1.'];
export const appStorage = createMMKV({ id: APP_STORAGE_ID });
