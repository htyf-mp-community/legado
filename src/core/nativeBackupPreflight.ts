import { trimSourceWhitespace } from './nativeSourceUrl';
import { decryptLegacyBackupText } from './legacyBackupCrypto';
import {
  parseNativeCookieBackup,
  parseNativeRuntimeSourceCacheBackup,
} from './nativeBackupSensitive';
import type { RestoreIgnore } from '../data/restorePreferences';

/** Fatal sensitive-data preflight. Error messages never include ciphertext, values or passwords. */
export class NativeBackupPreflightError extends Error {
  constructor(
    readonly file: 'cookies.json' | 'runtimeSourceCache.json',
    message: string,
  ) {
    super(message);
    this.name = 'NativeBackupPreflightError';
  }
}

/**
 * Decode and validate sensitive native files before any ordinary file conversion/write.
 * Cookies are always encrypted. Legacy plaintext cache arrays still require a nonblank
 * local password. Ignore switches bypass file content entirely, matching Restore.kt.
 * Returns a new file map; never persists the password or changes application data.
 */
export function preflightNativeBackupFiles(
  files: Record<string, string>,
  password: string,
  ignore: Partial<RestoreIgnore> = {},
): Record<string, string> {
  const result = { ...files };
  for (const file of ['cookies.json', 'runtimeSourceCache.json'] as const) {
    if (
      file === 'cookies.json'
        ? ignore.ignoreCookies
        : ignore.ignoreSourceVariables
    ) {
      delete result[file];
      continue;
    }
    if (files[file] === undefined) continue;
    try {
      if (!trimSourceWhitespace(password))
        throw new Error(
          file === 'cookies.json'
            ? '备份或恢复持久 Cookie 前，请先设置非空的本地密码。'
            : '备份或恢复源变量前，请先设置非空的本地密码。',
        );
      const raw = files[file],
        trimmed = trimSourceWhitespace(raw);
      const decoded =
        file === 'runtimeSourceCache.json' &&
        trimmed.startsWith('[') &&
        trimmed.endsWith(']')
          ? raw
          : decryptLegacyBackupText(raw, password);
      if (file === 'cookies.json') parseNativeCookieBackup(decoded);
      else parseNativeRuntimeSourceCacheBackup(decoded);
      result[file] = decoded;
    } catch (error) {
      throw new NativeBackupPreflightError(
        file,
        error instanceof Error ? error.message : `${file} 恢复失败`,
      );
    }
  }
  return result;
}
