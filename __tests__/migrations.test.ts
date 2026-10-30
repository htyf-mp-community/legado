jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getAllKeys: jest.fn(() => []),
    getString: jest.fn(),
    getNumber: jest.fn(),
    getBoolean: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  }),
}));
import {
  CURRENT_STORAGE_SCHEMA,
  runStorageMigrations,
} from '../src/data/migrations';
function store(initial: Record<string, string | number | boolean> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getAllKeys: () => [...values.keys()],
    getString: (key: string) =>
      typeof values.get(key) === 'string'
        ? (values.get(key) as string)
        : undefined,
    getNumber: (key: string) =>
      typeof values.get(key) === 'number'
        ? (values.get(key) as number)
        : undefined,
    getBoolean: (key: string) =>
      typeof values.get(key) === 'boolean'
        ? (values.get(key) as boolean)
        : undefined,
    set: (key: string, value: string | number | boolean) => {
      values.set(key, value);
    },
    remove: (key: string) => values.delete(key),
  };
}
test('migrates legacy auto tasks and records schema', () => {
  const mock = store({ autoTaskRules: '[]' });
  expect(runStorageMigrations(mock)).toBe(CURRENT_STORAGE_SCHEMA);
  expect(mock.values.get('auto.tasks.v1')).toBe('[]');
  expect(mock.values.has('autoTaskRules')).toBe(false);
  expect(mock.values.get('storage.schema.version')).toBe(1);
});
test('is idempotent for current schema', () => {
  const mock = store({ 'storage.schema.version': 1, keep: 'value' });
  expect(runStorageMigrations(mock)).toBe(1);
  expect(Object.fromEntries(mock.values)).toEqual({
    'storage.schema.version': 1,
    keep: 'value',
  });
});
test('restores the complete snapshot when migration fails', () => {
  const mock = store({ autoTaskRules: 'legacy', keep: 'value' }),
    set = mock.set;
  let failed = false;
  mock.set = (key, value) => {
    if (key === 'auto.tasks.v1' && !failed) {
      failed = true;
      throw new Error('disk full');
    }
    set(key, value);
  };
  expect(() => runStorageMigrations(mock)).toThrow('disk full');
  expect(Object.fromEntries(mock.values)).toEqual({
    autoTaskRules: 'legacy',
    keep: 'value',
  });
});

test('failed migration restores native false/numeric values and the persisted type index', () => {
  const mock = store({
    autoTaskRules: '[]',
    'bookshelf.manage.delete-original.v1': false,
    'bookshelf.sort.v1': 4,
    custom: false,
    'storage.value-types.v1': '{"custom":"boolean"}',
  });
  const before = Object.fromEntries(mock.values),
    getString = mock.getString,
    set = mock.set;
  mock.getString = key =>
    typeof mock.values.get(key) === 'boolean' ||
    typeof mock.values.get(key) === 'number'
      ? ''
      : getString(key);
  let failed = false;
  mock.set = (key, value) => {
    if (key === 'storage.schema.version' && !failed) {
      failed = true;
      throw new Error('disk full');
    }
    set(key, value);
  };
  expect(() => runStorageMigrations(mock)).toThrow('disk full');
  expect(Object.fromEntries(mock.values)).toEqual(before);
});
