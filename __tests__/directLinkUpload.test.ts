jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));

import {
  buildDirectUploadRequest,
  DirectLinkUploadError,
  extractDirectDownloadUrl,
  normalizeDirectLinkRule,
  parseDirectLinkRule,
  uploadDirectLink,
  uploadDirectLinkFile,
} from '../src/data/directLinkUpload';

const plainRule = {
  uploadUrl:
    'https://upload.example/file,{"method":"POST","body":{"file":"fileRequest","token":"abc"},"type":"multipart/form-data","headers":{"X-Test":"yes"}}',
  downloadUrlRule: '$.msg',
  summary: '测试网盘',
  compress: false,
  expiryDate: 7,
};

test('parses multipart fileRequest and auxiliary fields', () => {
  expect(buildDirectUploadRequest(plainRule)).toEqual({
    url: 'https://upload.example/file',
    method: 'POST',
    headers: { 'X-Test': 'yes' },
    multipart: true,
    fileField: 'file',
    fields: { token: 'abc' },
  });
});

test('extracts plain JSONPath download links', () => {
  expect(extractDirectDownloadUrl({ msg: 'https://d/a' }, plainRule)).toBe(
    'https://d/a',
  );
});

test('supports the fixed-prefix result expression used by bundled rules', () => {
  expect(
    extractDirectDownloadUrl(
      { data: 'abc.json' },
      {
        ...plainRule,
        downloadUrlRule:
          "$.data@js:if (result == '') '' else 'https://download.example/' + result",
      },
    ),
  ).toBe('https://download.example/abc.json');
});

test('rejects arbitrary JavaScript and retains ZIP compression preference', () => {
  expect(() =>
    extractDirectDownloadUrl(
      { data: 'x' },
      { ...plainRule, downloadUrlRule: '$.data@js:result.reverse()' },
    ),
  ).toThrow('JavaScript');
  expect(normalizeDirectLinkRule({ ...plainRule, compress: true }).compress).toBe(true);
});

test('validates imported rule JSON', () => {
  expect(parseDirectLinkRule(JSON.stringify(plainRule))).toEqual(plainRule);
  try { parseDirectLinkRule('{}'); throw new Error('expected validation error'); } catch (error) { expect(error).toBeInstanceOf(DirectLinkUploadError); expect((error as DirectLinkUploadError).code).toBe('invalid-upload-url'); }
});

test('uploads a plain request and extracts the returned download URL', async () => {
  const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, text: async () => '{"msg":"https://download.example/a"}' } as Response);
  const rule = { ...plainRule, uploadUrl: 'https://upload.example/plain,{"method":"PUT","body":{}}' };
  await expect(uploadDirectLink(rule, 'backup.json', '{"ok":true}')).resolves.toBe('https://download.example/a');
  expect(fetcher).toHaveBeenCalledWith('https://upload.example/plain', expect.objectContaining({ method: 'PUT', body: '{"ok":true}' }));
  fetcher.mockRestore();
});

test('returns typed upload and compression-rule failures', async () => {
  const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503, text: async () => 'offline' } as Response);
  const rule = { ...plainRule, uploadUrl: 'https://upload.example/plain,{"method":"POST","body":{}}' };
  await expect(uploadDirectLink(rule, 'backup.json', '{}')).rejects.toMatchObject({ code: 'upload-http', detail: 'HTTP 503 offline' });
  fetcher.mockRestore();
  await expect(uploadDirectLinkFile(rule, 'backup.zip', '/tmp/backup.zip')).rejects.toMatchObject({ code: 'multipart-required' });
});
