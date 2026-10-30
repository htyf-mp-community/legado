jest.mock('../src/data/storage', () => ({ appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() } }));
import iconv from 'iconv-lite';
import { buildSourceRequest, executeSourceRequest } from '../src/core/sourceRequest';
import type { BookSource } from '../src/types';

const source: BookSource = { bookSourceUrl: 'https://encoding.test', bookSourceName: 'Encoding test', bookSourceType: 0, customOrder: 0, enabled: true, enabledExplore: false };

test('decodes a headerless GBK source page from its HTML head declaration', async () => {
  const html = '<html><head><meta charset="GBK"></head><body>书名：西游记，作者：吴承恩。</body></html>';
  const bytes = new Uint8Array(iconv.encode(html, 'GBK'));
  const previous = globalThis.fetch;
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, url: `${source.bookSourceUrl}/book`,
    headers: { get: () => null, forEach: () => {} }, arrayBuffer: async () => bytes.buffer,
    text: async () => iconv.decode(bytes, 'UTF-8'),
  } as unknown as Response));
  try { await expect(executeSourceRequest(buildSourceRequest(source, '/book'))).resolves.toMatchObject({ data: html }); }
  finally { globalThis.fetch = previous; }
});

test.each([
  ['UTF-8', undefined, 'GBK'],
  ['GB18030', undefined, 'GBK'],
  ['UTF-16LE', 'application/json; charset=UTF-16LE', 'GBK'],
] as const)('decodes %s response bytes independently of request encoding', async (charset, contentType, requestCharset) => {
  const value = { name: '西游记𠮷', author: '吴承恩', intro: '小说目录，第一回，天地之数，阅读书屋。'.repeat(40) };
  const bytes = new Uint8Array(iconv.encode(JSON.stringify(value), charset));
  const previous = globalThis.fetch, text = jest.fn(async () => 'incorrect platform UTF-8 fallback');
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, url: `${source.bookSourceUrl}/book`,
    headers: { get: () => contentType ?? null, forEach: () => {} }, arrayBuffer: async () => bytes.buffer, text,
  } as unknown as Response));
  try {
    const request = buildSourceRequest(source, `/book,{"charset":"${requestCharset}"}`);
    await expect(executeSourceRequest(request)).resolves.toMatchObject({ data: value });
    expect(text).not.toHaveBeenCalled();
  } finally { globalThis.fetch = previous; }
});

test('an explicit response header takes precedence over a conflicting HTML declaration', async () => {
  const html = '<head><meta charset=GBK></head><body>正文编码验收：𠮷，书名：西游记。</body>';
  const bytes = new Uint8Array(iconv.encode(html, 'UTF-16LE'));
  const previous = globalThis.fetch;
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, url: `${source.bookSourceUrl}/chapter`,
    headers: { get: () => 'text/html; charset=UTF-16LE', forEach: () => {} }, arrayBuffer: async () => bytes.buffer,
  } as unknown as Response));
  try { await expect(executeSourceRequest(buildSourceRequest(source, '/chapter'))).resolves.toMatchObject({ data: html }); }
  finally { globalThis.fetch = previous; }
});

test('rejects an invalid HTML declaration instead of silently returning garbled content', async () => {
  const bytes = new Uint8Array(iconv.encode('<head><meta charset="no-such-charset"></head><body>正文</body>', 'UTF-8'));
  const previous = globalThis.fetch;
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, url: `${source.bookSourceUrl}/chapter`,
    headers: { get: () => null, forEach: () => {} }, arrayBuffer: async () => bytes.buffer,
  } as unknown as Response));
  try { await expect(executeSourceRequest(buildSourceRequest(source, '/chapter'))).rejects.toThrow('不支持的响应字符集'); }
  finally { globalThis.fetch = previous; }
});
