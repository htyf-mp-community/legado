import { HttpServer, type HttpResponse, type RequestHandler } from 'react-native-nitro-http-server';
import { httpLogDetail, loadHttpLogs } from './httpLog';
import { loadDiagnosticPreferences, saveDiagnosticPreferences } from './diagnosticPreferences';
import { clearSourceCookies, loadSourceCookies, saveDocumentCookies } from './sourceCookies';
import { loadSources, mergeBookSources, parseBookSources, saveSources } from './sources';
import { appStorage } from './storage';
import { checkBookSources } from '../core/sourceCheck';
import { runSourceDebug } from '../core/sourceDebug';

const CONFIG_KEY = 'mcp-service.config.v1';
const DEFAULT_PORT = 1236;
const MAX_TEXT = 200_000;

export type McpServiceConfig = { port: number; token: string };
export type McpServiceStatus = { running: boolean; port: number; url: string };
type RpcId = string | number | null;
type RpcRequest = { jsonrpc?: string; id?: RpcId; method?: string; params?: Record<string, unknown> };
type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

let server: HttpServer | undefined;

export function normalizeMcpPort(value: unknown) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : DEFAULT_PORT;
}

export function loadMcpServiceConfig(): McpServiceConfig {
  const raw = appStorage.getString(CONFIG_KEY);
  if (raw) try { const value = JSON.parse(raw) as Partial<McpServiceConfig>; return { port: normalizeMcpPort(value.port), token: String(value.token ?? '') }; } catch {}
  return { port: DEFAULT_PORT, token: '' };
}

export function saveMcpServiceConfig(value: McpServiceConfig) {
  const normalized = { port: normalizeMcpPort(value.port), token: value.token.trim() };
  appStorage.set(CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
}

const schema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const string = (description: string) => ({ type: 'string', description });
const tools = [
  { name: 'save_source', description: '保存单个声明式 BookSource JSON 书源。JavaScript 单文件源需要沙箱规则运行时。', inputSchema: schema({ source: string('BookSource JSON 对象或 JSON 文本'), format: string('json|js；缺省时自动识别') }, ['source']) },
  { name: 'debug_source', description: '运行应用内书源调试并返回逐步日志。', inputSchema: schema({ url: string('书源 bookSourceUrl'), key: string('调试关键词或入口 URL'), timeoutSec: { type: 'integer' } }, ['url', 'key']) },
  { name: 'list_sources', description: '列出书源摘要，可按名称或 URL 子串过滤。', inputSchema: schema({ search: string('名称或 URL 子串') }) },
  { name: 'get_source', description: '按 bookSourceUrl 读取书源 JSON。', inputSchema: schema({ url: string('书源 bookSourceUrl') }, ['url']) },
  { name: 'delete_sources', description: '按 bookSourceUrl 删除一个或多个书源。', inputSchema: schema({ urls: { type: 'array', items: { type: 'string' } } }, ['urls']) },
  { name: 'get_http_logs', description: '读取最新的应用日志摘要。', inputSchema: schema({ limit: { type: 'integer' } }) },
  { name: 'get_http_log', description: '按 id 读取单条应用日志详情。', inputSchema: schema({ id: string('日志 id') }, ['id']) },
  { name: 'set_http_log_recording', description: '设置 HTTP 日志记录状态。当前 RN 日志始终开启。', inputSchema: schema({ enabled: { type: 'boolean' } }, ['enabled']) },
  { name: 'get_cookies', description: '读取指定书源 URL 的持久 Cookie。', inputSchema: schema({ url: string('URL 或书源地址') }, ['url']) },
  { name: 'set_cookie', description: '合并写入指定书源 URL 的持久 Cookie。', inputSchema: schema({ url: string('URL 或书源地址'), cookie: string('分号分隔 Cookie') }, ['url', 'cookie']) },
  { name: 'clear_cookies', description: '清除指定书源 URL 的持久 Cookie。', inputSchema: schema({ url: string('URL 或书源地址') }, ['url']) },
  { name: 'eval_js', description: '在应用内书源 JavaScript 环境执行脚本。', inputSchema: schema({ js: string('JavaScript 脚本'), url: string('可选书源地址'), timeoutSec: { type: 'integer' } }, ['js']) },
  { name: 'check_source', description: '批量校验书源；声明式规则直接执行，JavaScript 规则逐条报告不兼容。', inputSchema: schema({ urls: { type: 'array', items: { type: 'string' }, maxItems: 50 }, key: string('搜索关键词，默认“三体”') }, ['urls']) },
];

function text(value: string, isError = false): ToolResult { return { content: [{ type: 'text', text: value.slice(0, MAX_TEXT) }], ...(isError ? { isError: true } : {}) }; }
function required(args: Record<string, unknown>, key: string) { const value = String(args[key] ?? '').trim(); if (!value) throw new Error(`参数 ${key} 不能为空`); return value; }

async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  if (name === 'list_sources') { const query = String(args.search ?? '').toLowerCase(); const rows = (await loadSources()).filter(item => !query || item.bookSourceName.toLowerCase().includes(query) || item.bookSourceUrl.toLowerCase().includes(query)).map(({ bookSourceName, bookSourceUrl, bookSourceGroup, enabled }) => ({ bookSourceName, bookSourceUrl, bookSourceGroup, enabled })); return text(`共 ${rows.length} 条\n${JSON.stringify(rows, null, 2)}`); }
  if (name === 'get_source') { const url = required(args, 'url'), source = (await loadSources()).find(item => item.bookSourceUrl === url); return source ? text(JSON.stringify(source, null, 2)) : text('未找到书源，请检查书源地址', true); }
  if (name === 'save_source') { const raw = required(args, 'source'), format = String(args.format ?? (/^\s*[\[{]/.test(raw) ? 'json' : 'js')); if (format === 'js') return text('TODO(htyf-native): JavaScript 单文件书源需要尚未提供的沙箱规则运行时', true); const incoming = parseBookSources(raw); if (incoming.length !== 1) return text('source 必须包含单个有效 BookSource JSON 对象', true); const current = await loadSources(), old = current.find(item => item.bookSourceUrl === incoming[0].bookSourceUrl), saved = old ? { ...incoming[0], enabled: old.enabled, customOrder: old.customOrder, bookSourceGroup: incoming[0].bookSourceGroup || old.bookSourceGroup } : incoming[0]; await saveSources(mergeBookSources(current, [saved])); return text(`已保存：${saved.bookSourceName}\nbookSourceUrl: ${saved.bookSourceUrl}`); }
  if (name === 'delete_sources') { const urls = Array.isArray(args.urls) ? [...new Set(args.urls.map(String).filter(Boolean))] : []; if (!urls.length) throw new Error('参数 urls 不能为空'); const current = await loadSources(), ids = new Set(urls), next = current.filter(item => !ids.has(item.bookSourceUrl)); await saveSources(next); return text(`已删除 ${current.length - next.length} 个书源`); }
  if (name === 'get_http_logs') { const limit = Math.max(1, Math.min(50, Number(args.limit ?? 50))), logs = loadHttpLogs().slice(0,limit),recording=loadDiagnosticPreferences().recordHttpLog; return text(`${recording?'最新':'HTTP 日志记录未开启；以下为关闭前保留的'} ${logs.length} 条：\n${logs.length ? logs.map(item => `#${item.id} ${new Date(item.time).toISOString()} ${item.method} ${item.url} -> ${item.statusCode} ${item.duration}ms${item.error?` | ${item.error}`:''}`).join('\n') : '（空）'}`); }
  if (name === 'get_http_log') { const id = required(args, 'id'), item = loadHttpLogs().find(log => log.id === id); return item ? text(httpLogDetail(item)) : text('未找到日志', true); }
  if (name === 'set_http_log_recording') {if(typeof args.enabled!=='boolean')return text('参数 enabled 必须为布尔值',true);const preferences=loadDiagnosticPreferences();saveDiagnosticPreferences({...preferences,recordHttpLog:args.enabled});return text(`HTTP 日志记录已${args.enabled?'开启':'关闭'}`)}
  if (name === 'get_cookies') { const value = Object.entries(loadSourceCookies(required(args, 'url'))).map(([key, item]) => `${key}=${item}`).join('; '); return text(value || '（该域名没有 Cookie）'); }
  if (name === 'set_cookie') { saveDocumentCookies(required(args, 'url'), required(args, 'cookie')); return text('Cookie 已写入持久层'); }
  if (name === 'clear_cookies') { clearSourceCookies(required(args, 'url')); return text('Cookie 已清除'); }
  if (name === 'check_source') { const urls = Array.isArray(args.urls) ? [...new Set(args.urls.map(String).filter(Boolean))].slice(0, 50) : []; if (!urls.length) throw new Error('参数 urls 不能为空'); const wanted = new Set(urls), sources = (await loadSources()).filter(item => wanted.has(item.bookSourceUrl)), results = await checkBookSources(sources, String(args.key ?? '三体').trim() || '三体'); const missing = urls.filter(url => !sources.some(source => source.bookSourceUrl === url)); return text(JSON.stringify({ keyword: String(args.key ?? '三体'), checked: results.length, missing, summary: Object.fromEntries(['success','empty','unsupported','failed'].map(status => [status, results.filter(item => item.status === status).length])), results }, null, 2), results.every(item => item.status === 'failed' || item.status === 'unsupported')); }
  if (name === 'debug_source') { const url = required(args, 'url'), key = required(args, 'key'), source = (await loadSources()).find(item => item.bookSourceUrl === url); if (!source) return text('未找到书源，请检查书源地址', true); const logs: unknown[] = []; try { const value = await runSourceDebug({ ...source, enabled: true }, key, event => logs.push(event)); return text(JSON.stringify({ logs, book: value.info.name, chapters: value.chapters.length }, null, 2)); } catch (cause) { return text(JSON.stringify({ logs, error: cause instanceof Error ? cause.message : String(cause) }, null, 2), true); } }
  // TODO(htyf-native): Arbitrary JavaScript evaluation still requires the sandbox documented in docs/htyf-migration-gaps.md.
  if (name === 'eval_js') return text('TODO(htyf-native): 此工具依赖尚未提供的沙箱规则 JavaScript 运行时，当前安全降级为不可用', true);
  return text(`未知工具：${name}`, true);
}

const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-legado-token, mcp-protocol-version' };
function response(body: unknown, statusCode = 200): HttpResponse { return { statusCode, headers, body: JSON.stringify(body) }; }
function result(id: RpcId, value: unknown) { return response({ jsonrpc: '2.0', id, result: value }); }
function error(id: RpcId, code: number, message: string, status = 200) { return response({ jsonrpc: '2.0', id, error: { code, message } }, status); }

export function createMcpServiceHandler(config: McpServiceConfig): RequestHandler {
  return async request => {
    if (request.method === 'OPTIONS') return response({ ok: true }, 204);
    const url = new URL(request.path, `http://127.0.0.1:${config.port}`);
    if (url.pathname !== '/mcp') return error(null, -32601, 'Not found', 404);
    if (config.token && request.headers['x-legado-token'] !== config.token) return error(null, -32001, 'Unauthorized', 401);
    if (request.method !== 'POST') return error(null, -32600, 'Only POST is supported', 405);
    let rpc: RpcRequest;
    try { rpc = JSON.parse(request.body ?? '') as RpcRequest; } catch { return error(null, -32700, 'Parse error', 400); }
    if (rpc.jsonrpc !== '2.0' || !rpc.method) return error(rpc.id ?? null, -32600, 'Invalid Request', 400);
    if (rpc.method.startsWith('notifications/')) return { statusCode: 202, headers, body: '' };
    if (rpc.method === 'initialize') return result(rpc.id ?? null, { protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'legado-htyf', version: '1.0.0' } });
    if (rpc.method === 'ping') return result(rpc.id ?? null, {});
    if (rpc.method === 'tools/list') return result(rpc.id ?? null, { tools });
    if (rpc.method === 'tools/call') { const params = rpc.params ?? {}, name = String(params.name ?? ''), args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments) ? params.arguments as Record<string, unknown> : {}; try { return result(rpc.id ?? null, await callTool(name, args)); } catch (cause) { return result(rpc.id ?? null, text(cause instanceof Error ? cause.message : String(cause), true)); } }
    return error(rpc.id ?? null, -32601, 'Method not found');
  };
}

export async function startMcpService(config = loadMcpServiceConfig()): Promise<McpServiceStatus> { if (server) await server.stop(); const saved = saveMcpServiceConfig(config); server = new HttpServer(); const port = await server.start(saved.port, createMcpServiceHandler(saved), { host: '127.0.0.1', autoRestart: true }); return { running: true, port, url: `http://127.0.0.1:${port}/mcp` }; }
export async function stopMcpService(): Promise<McpServiceStatus> { if (server) await server.stop(); server = undefined; const port = loadMcpServiceConfig().port; return { running: false, port, url: `http://127.0.0.1:${port}/mcp` }; }
export async function mcpServiceStatus(): Promise<McpServiceStatus> { const port = server?.port ?? loadMcpServiceConfig().port; return { running: server ? await server.isRunning() : false, port, url: `http://127.0.0.1:${port}/mcp` }; }
