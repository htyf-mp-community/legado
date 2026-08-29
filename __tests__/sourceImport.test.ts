jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({}) }));
import { importBookSourcesInput } from '../src/core/sourceImport';

const source = JSON.stringify([
  {
    bookSourceName: '酷我小说',
    bookSourceUrl: 'http://appi.kuwo.cn',
    bookSourceType: 0,
    enabled: true,
    enabledExplore: true,
    customOrder: 0,
  },
]);

test('downloads an HTTPS source collection pasted into the import action', async () => {
  const fetcher = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => source,
  }));
  const result = await importBookSourcesInput(
    ' https://legado.aoaostar.com/sources/71e56d4f.json ',
    fetcher,
  );
  expect(fetcher).toHaveBeenCalledWith(
    'https://legado.aoaostar.com/sources/71e56d4f.json',
  );
  expect(result).toHaveLength(1);
  expect(result[0].bookSourceName).toBe('酷我小说');
});

test('retains direct JSON import and reports HTTP failures', async () => {
  await expect(importBookSourcesInput(source)).resolves.toHaveLength(1);
  await expect(
    importBookSourcesInput('https://example.com/sources.json', async () => ({
      ok: false,
      status: 404,
      text: async () => '',
    })),
  ).rejects.toThrow('HTTP 404');
});
