import type { MMKV } from 'react-native-mmkv';

/** 备份与事务快照使用的逻辑值；不通过错误类型的 MMKV getter 猜测类型。 */
export type StorageEntry =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean };
type ValueType = StorageEntry['type'];
type Reader = Pick<
  MMKV,
  'getAllKeys' | 'getString' | 'getNumber' | 'getBoolean'
>;
type Writer = Reader & Pick<MMKV, 'set'>;

/** 只保存未知导入键的类型，不含值；内部实现键不进入用户备份。 */
export const STORAGE_VALUE_TYPES_KEY = 'storage.value-types.v1';

// 已有安装没有类型索引，必须按现有功能的读写契约读取，不能靠 getter 顺序。
// 新增非 string 的应用键时同步扩展此表；动态分组排序见下方前缀。
const scalarTypes: Readonly<Record<string, ValueType>> = {
  'bookshelf.manage.open-title.v1': 'boolean',
  'bookshelf.manage.delete-original.v1': 'boolean',
  'bookshelf.sort.v1': 'number',
  'book-source.batch-delay-seconds.v1': 'number',
  'keyboard-assists.lines.v1': 'number',
  'audio.sleep.deadline.v1': 'number',
  'storage.schema.version': 'number',
};

/** 应用已有非字符串键的类型；其他应用键保存原始字符串或 JSON 字符串。 */
export function declaredStorageType(key: string): ValueType | undefined {
  return Object.hasOwn(scalarTypes, key)
    ? scalarTypes[key]
    : key.startsWith('bookshelf.group-sort.v1.')
      ? 'number'
      : undefined;
}

function readTypeIndex(storage: Reader): Record<string, ValueType> {
  const raw = storage.getString(STORAGE_VALUE_TYPES_KEY);
  if (raw === undefined) return Object.create(null);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('存储值类型索引不是有效的 JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('存储值类型索引无效');
  const result: Record<string, ValueType> = Object.create(null);
  for (const [key, type] of Object.entries(value)) {
    if (!key || !['string', 'number', 'boolean'].includes(String(type)))
      throw new Error('存储值类型索引无效');
    result[key] = type as ValueType;
  }
  return result;
}

/**
 * 读取备份/回滚快照，保留空串、false、0 和 JSON 字符串的原始类型。
 * 现有应用键使用声明；未知导入键使用持久类型索引。未声明的旧键按原字符串
 * 合同读取；只有 getter 返回 undefined 才允许兼容严格类型的注入存储适配器。
 * 不读取 MMKV 文件；不支持应用未使用的 ArrayBuffer 值。
 */
export function readStorageEntries(
  storage: Reader,
  filter: (key: string) => boolean = () => true,
): Record<string, StorageEntry> {
  const types = readTypeIndex(storage);
  const entries: Record<string, StorageEntry> = Object.create(null);
  for (const key of storage.getAllKeys()) {
    if (key === STORAGE_VALUE_TYPES_KEY || !filter(key)) continue;
    const type = declaredStorageType(key) ?? types[key];
    if (type === 'boolean') {
      const value = storage.getBoolean(key);
      if (value !== undefined) entries[key] = { type, value };
    } else if (type === 'number') {
      const value = storage.getNumber(key);
      if (value !== undefined) {
        if (!Number.isFinite(value))
          throw new Error(`存储条目 ${key} 不是有限数字`);
        entries[key] = { type, value };
      }
    } else {
      const value = storage.getString(key);
      if (value !== undefined) entries[key] = { type: 'string', value };
      else if (type === undefined) {
        // 严格类型的测试/注入适配器可可靠返回 undefined；原生类型不能据此推断。
        const number = storage.getNumber(key);
        if (number !== undefined) {
          if (!Number.isFinite(number))
            throw new Error(`存储条目 ${key} 不是有限数字`);
          entries[key] = { type: 'number', value: number };
        } else {
          const boolean = storage.getBoolean(key);
          if (boolean !== undefined)
            entries[key] = { type: 'boolean', value: boolean };
        }
      }
    }
    // 旧版本可能已把错误 getter 的结果恢复成字符串。类型化 getter 失败时
    // 保留仍可读取的原串，不能静默丢键，更不能猜测曾经的数字/开关值。
    if (!Object.hasOwn(entries, key) && type !== undefined) {
      const value = storage.getString(key);
      if (value !== undefined) entries[key] = { type: 'string', value };
      else throw new Error(`无法读取存储条目 ${key}`);
    }
  }
  return entries;
}

/** 拒绝备份覆盖内部索引；旧备份的合法字符串类型仍按原值导入，不猜测原值。 */
export function validateStorageEntryType(key: string) {
  if (key === STORAGE_VALUE_TYPES_KEY)
    throw new Error('备份不能覆盖内部存储类型索引');
}

/**
 * 写入已验证条目并记住未知导入键的类型，保证重建实例后的再次导出不依赖 getter 猜测。
 * 可能写入多次；调用方必须在失败时以完整快照回滚，包括本索引的逻辑类型。
 */
export function writeStorageEntries(
  storage: Writer,
  entries: Record<string, StorageEntry>,
) {
  for (const key of Object.keys(entries)) validateStorageEntryType(key);
  const types = readTypeIndex(storage);
  for (const [key, entry] of Object.entries(entries)) {
    storage.set(key, entry.value);
    if (!declaredStorageType(key) && entry.type !== 'string')
      types[key] = entry.type;
    else delete types[key];
  }
  if (
    Object.keys(types).length ||
    storage.getString(STORAGE_VALUE_TYPES_KEY) !== undefined
  )
    storage.set(STORAGE_VALUE_TYPES_KEY, JSON.stringify(types));
}
