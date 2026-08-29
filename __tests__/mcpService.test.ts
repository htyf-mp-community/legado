import { createMcpServiceHandler, normalizeMcpPort } from '../src/data/mcpService';
import { saveSources } from '../src/data/sources';

jest.mock('react-native-nitro-http-server', () => ({ HttpServer: class {} }));
jest.mock('../src/data/storage', () => { const values = new Map<string, string>(); return { appStorage: { getString: (key: string) => values.get(key), set: (key: string, value: unknown) => values.set(key, String(value)), remove: (key: string) => values.delete(key) } }; });

const request = (handler: ReturnType<typeof createMcpServiceHandler>, body: unknown, token?: string) => handler({ requestId: 'mcp', method: 'POST', path: '/mcp', headers: token ? { 'x-legado-token': token } : {}, body: JSON.stringify(body) });

test('MCP service initializes and exposes the Android-compatible tool names', async () => {
  const handler = createMcpServiceHandler({ port: 1236, token: '' });
  const initialized = await request(handler, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  const listed = await request(handler, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  expect(JSON.parse(String(initialized.body)).result.serverInfo.name).toBe('legado-htyf');
  expect(JSON.parse(String(listed.body)).result.tools.map((item: { name: string }) => item.name)).toEqual(expect.arrayContaining(['save_source', 'debug_source', 'list_sources', 'get_source', 'delete_sources', 'get_http_logs', 'get_http_log', 'set_http_log_recording', 'get_cookies', 'set_cookie', 'clear_cookies', 'eval_js', 'check_source']));
});

test('MCP service protects the endpoint and provides source CRUD', async () => {
  await saveSources([]);
  const handler = createMcpServiceHandler({ port: 1236, token: 'secret' });
  expect((await request(handler, { jsonrpc: '2.0', id: 1, method: 'ping' })).statusCode).toBe(401);
  const source = { bookSourceUrl: 'https://mcp.test', bookSourceName: 'MCP', bookSourceType: 0, customOrder: 0, enabled: true, enabledExplore: true };
  const saved = await request(handler, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'save_source', arguments: { source: JSON.stringify(source) } } }, 'secret');
  const fetched = await request(handler, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_source', arguments: { url: source.bookSourceUrl } } }, 'secret');
  expect(JSON.parse(String(saved.body)).result.isError).toBeUndefined();
  expect(JSON.parse(String(fetched.body)).result.content[0].text).toContain(source.bookSourceName);
});

test('MCP service reports sandboxed JS tools as explicitly unavailable', async () => {
  const response = await request(createMcpServiceHandler({ port: 1236, token: '' }), { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'eval_js', arguments: { js: '1 + 1' } } });
  const tool = JSON.parse(String(response.body)).result;
  expect(tool.isError).toBe(true);
  expect(tool.content[0].text).toContain('TODO(htyf-native)');
  expect(normalizeMcpPort(80)).toBe(1236);
});
