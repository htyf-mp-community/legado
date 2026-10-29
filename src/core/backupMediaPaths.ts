import type { BackupPayload } from '../data/backup';

export type BackupMediaIndex = {
  version: 1;
  references: Record<string, string>;
  files: { path: string; sha256: string; size: number }[];
};
export function localMediaPath(value: string): string | undefined {
  if (value.startsWith('/')) return value;
  if (!/^file:\/\/(?:\/|localhost\/)/i.test(value)) return;
  try {
    // RN's built-in URL pathname handles HTTP only. File paths need their own URI decoding.
    return decodeURIComponent(
      value.replace(/^file:\/\/(?:localhost)?/i, '').split(/[?#]/)[0],
    );
  } catch {
    return;
  }
}
export const persistedCoverFile = (value: string) =>
  /\/covers\/[a-f\d]{32}\.cover$/i.test(localMediaPath(value) ?? '');
export const safeBackupMediaPath = (value: string) =>
  /^(?:covers|bg)\//.test(value) &&
  !value.includes('\\') &&
  !value
    .split('/')
    .some(
      part =>
        !part || part === '.' || part === '..' || /[\u0000-\u001f]/.test(part),
    );
export function validateBackupMedia(
  value: unknown,
): asserts value is BackupMediaIndex {
  if (!value || typeof value !== 'object') throw new Error('备份媒体索引无效');
  const media = value as Partial<BackupMediaIndex>;
  if (
    media.version !== 1 ||
    !Array.isArray(media.files) ||
    !media.references ||
    typeof media.references !== 'object' ||
    Array.isArray(media.references)
  )
    throw new Error('备份媒体索引无效');
  const paths = new Set<string>();
  for (const file of media.files) {
    if (
      !file ||
      typeof file.path !== 'string' ||
      !safeBackupMediaPath(file.path) ||
      paths.has(file.path) ||
      !/^[a-f\d]{64}$/i.test(file.sha256) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0
    )
      throw new Error('备份媒体文件无效');
    paths.add(file.path);
  }
  for (const [original, relative] of Object.entries(media.references))
    if (
      !localMediaPath(original) ||
      typeof relative !== 'string' ||
      !paths.has(relative)
    )
      throw new Error('备份媒体引用无效');
}

/** Only known media fields are rewritten; source URLs and unrelated settings are preserved. */
export function mapBackupMedia(
  payload: BackupPayload,
  remap: (value: string, kind: 'cover' | 'background') => string | undefined,
  includePersisted = true,
): BackupPayload {
  const entries = { ...payload.entries };
  const change = (key: string, update: (value: unknown) => unknown) => {
    const entry = entries[key];
    if (entry?.type !== 'string') return;
    let value: unknown;
    try {
      value = JSON.parse(entry.value);
    } catch {
      throw new Error(`备份中的 ${key} 数据无效`);
    }
    entries[key] = { type: 'string', value: JSON.stringify(update(value)) };
  };
  const fields = (
    value: unknown,
    keys: string[],
    kind: 'cover' | 'background',
  ) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return value;
    const result = { ...(value as Record<string, unknown>) };
    for (const key of keys)
      if (typeof result[key] === 'string')
        result[key] = remap(result[key], kind);
    return result;
  };
  change('library.v1', value => {
    if (!Array.isArray(value)) throw new Error('备份中的书架数据无效');
    return value.map(item => {
      const book = fields(
        item,
        ['customCoverUrl', ...(includePersisted ? ['persistedCoverUrl'] : [])],
        'cover',
      );
      if (!includePersisted && book && typeof book === 'object')
        delete (book as Record<string, unknown>).persistedCoverUrl;
      return book;
    });
  });
  change('bookshelf.groups.v1', value => {
    if (!Array.isArray(value)) throw new Error('备份中的分组数据无效');
    return value.map(item => fields(item, ['cover'], 'cover'));
  });
  change('reader.preferences.v1', value =>
    fields(
      value,
      ['paperBackgroundImage', 'nightBackgroundImage', 'epaperBackgroundImage'],
      'background',
    ),
  );
  return { ...payload, entries };
}

export function referencedBackupMedia(payload: BackupPayload) {
  const references = new Map<string, 'cover' | 'background'>();
  mapBackupMedia(payload, (value, kind) => {
    const path = localMediaPath(value);
    if (path) references.set(path, kind);
    return value;
  });
  return references;
}
