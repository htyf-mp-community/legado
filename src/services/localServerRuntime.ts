import type { AppStateStatus } from 'react-native';
import {
  HttpServer,
  type HttpResponse,
  type RequestHandler,
} from 'react-native-nitro-http-server';

export type LocalService = 'web' | 'mcp';
export class LocalServiceConflictError extends Error {
  constructor(
    readonly activeService: LocalService,
    readonly requestedService: LocalService,
  ) {
    const label = (service: LocalService) =>
      service === 'web' ? 'Web' : 'MCP';
    super(
      `${label(activeService)} 服务正在运行。当前运行环境一次只能开启一个本机服务，请先关闭后再开启 ${label(requestedService)}。`,
    );
    this.name = 'LocalServiceConflictError';
  }
}
export class LocalServiceOwnershipError extends Error {
  constructor() {
    super('其他本机服务正在运行或无法核实服务归属，请稍后重试。');
    this.name = 'LocalServiceOwnershipError';
  }
}
export class LocalWorkerBusyError extends Error {
  constructor() {
    super('书源脚本正在运行，请稍后再切换本机服务端口。');
    this.name = 'LocalWorkerBusyError';
  }
}
type Listener = {
  server: HttpServer;
  port: number;
  primary?: { owner: LocalService; handler: RequestHandler };
  pages: Map<string, { html: string; workerScript: string }>;
  healthPath: string;
  healthValue: string;
  dispatch: RequestHandler;
  subscription?: { remove: () => void };
};
export type LocalWorkerPageLease = {
  url: string;
  release: () => Promise<void>;
};
const noCache = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const isolatedPageHeaders = {
  ...noCache,
  'Content-Type': 'text/html; charset=utf-8',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'unsafe-inline'; worker-src 'self'; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
  'Referrer-Policy': 'no-referrer',
};
const isolatedWorkerHeaders = {
  ...noCache,
  'Content-Type': 'text/javascript; charset=utf-8',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'unsafe-eval'; worker-src 'none'; connect-src 'none'",
};
let active: Listener | undefined;
let operations: Promise<unknown> = Promise.resolve();
const randomUUID = (): string =>
  require('react-native-quick-crypto').randomUUID();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = operations.then(operation, operation);
  operations = next.catch(() => undefined);
  return next;
}
function pathname(path: string) {
  return path.split('?')[0];
}
function response(statusCode: number, body = ''): HttpResponse {
  return { statusCode, headers: noCache, body };
}
async function nativeRunning(): Promise<boolean> {
  // isRunning() mutates its JS wrapper; never use this probe to stop a server.
  return new HttpServer().isRunning();
}
async function owned(entry: Listener): Promise<boolean> {
  if (!(await nativeRunning())) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(
      `http://127.0.0.1:${entry.port}${entry.healthPath}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
      },
    );
    return res.ok && (await res.text()) === entry.healthValue;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
async function assertOwned(entry: Listener) {
  if (!(await owned(entry))) throw new LocalServiceOwnershipError();
}
async function restartListener(entry: Listener) {
  const replacement = new HttpServer();
  const restored = await replacement.start(entry.port, entry.dispatch, {
    host: '127.0.0.1',
    autoRestart: false,
  });
  if (restored !== entry.port) {
    if (restored > 0) {
      entry.server = replacement;
      entry.port = restored;
      try {
        await stopOwned(entry);
      } catch (_) {
        /* Do not stop an unverified listener. */
      }
    }
    throw new Error('本机服务恢复失败');
  }
  entry.server = replacement;
}
async function createListener(port: number): Promise<Listener> {
  if (await nativeRunning()) throw new LocalServiceOwnershipError();
  const healthValue = randomUUID(),
    healthPath = `/__legado_health__/${randomUUID()}`;
  const entry: Listener = {
    server: new HttpServer(),
    port,
    healthPath,
    healthValue,
    pages: new Map(),
    dispatch: () => response(404),
  };
  entry.dispatch = async request => {
    const path = pathname(request.path);
    if (path === entry.healthPath)
      return request.method === 'GET'
        ? response(200, entry.healthValue)
        : response(405);
    const page = entry.pages.get(path);
    if (page !== undefined)
      return request.method === 'GET'
        ? { statusCode: 200, headers: isolatedPageHeaders, body: page.html }
        : response(405);
    if (path.endsWith('/worker.js')) {
      const parent = entry.pages.get(path.slice(0, -'/worker.js'.length));
      if (parent?.workerScript !== undefined)
        return request.method === 'GET'
          ? {
              statusCode: 200,
              headers: isolatedWorkerHeaders,
              body: parent.workerScript,
            }
          : response(405);
    }
    return entry.primary ? entry.primary.handler(request) : response(404);
  };
  // Automatic native restart may stop a listener now owned by a different mini-app.
  // Recover on foreground only after checking the process-wide listener is absent.
  entry.subscription = require('react-native').AppState.addEventListener(
    'change',
    (state: AppStateStatus) => {
      if (state !== 'active') return;
      void serial(async () => {
        if (active !== entry || (await nativeRunning())) return;
        await restartListener(entry);
      }).catch(() => undefined);
    },
  );
  try {
    const actual = await entry.server.start(port, entry.dispatch, {
      host: '127.0.0.1',
      autoRestart: false,
    });
    if (!(actual > 0)) throw new Error('本机服务启动失败');
    entry.port = actual;
  } catch (error) {
    entry.subscription?.remove();
    throw error;
  }
  active = entry;
  return entry;
}
async function stopOwned(entry: Listener) {
  if (await nativeRunning()) {
    await assertOwned(entry);
    await entry.server.stop();
  }
  entry.subscription?.remove();
  if (active === entry) active = undefined;
}
export function startLocalServer(
  owner: LocalService,
  port: number,
  handler: RequestHandler,
) {
  return serial(async () => {
    let entry = active;
    if (entry) {
      if (!(await nativeRunning())) {
        if (entry.pages.size) {
          if (entry.port !== port) throw new LocalWorkerBusyError();
          await restartListener(entry);
        } else {
          entry.subscription?.remove();
          active = undefined;
          entry = undefined;
        }
      }
    }
    if (entry) {
      await assertOwned(entry);
      if (entry.primary && entry.primary.owner !== owner)
        throw new LocalServiceConflictError(entry.primary.owner, owner);
      if (entry.port !== port) {
        if (entry.pages.size) throw new LocalWorkerBusyError();
        await stopOwned(entry);
        entry = undefined;
      }
    }
    if (!entry) entry = await createListener(port);
    entry.primary = { owner, handler };
    return entry.port;
  });
}
export function stopLocalServer(owner: LocalService) {
  return serial(async () => {
    const entry = active;
    if (!entry || entry.primary?.owner !== owner) return;
    if (!(await nativeRunning())) {
      entry.primary = undefined;
      if (!entry.pages.size) {
        entry.subscription?.remove();
        active = undefined;
      }
      return;
    }
    await assertOwned(entry);
    if (entry.pages.size) {
      entry.primary = undefined;
      return;
    }
    await stopOwned(entry);
  });
}
export function localServerState(owner: LocalService, configuredPort: number) {
  return serial(async () => ({
    running:
      !!active && active.primary?.owner === owner && (await owned(active)),
    port: active?.primary?.owner === owner ? active.port : configuredPort,
  }));
}
/** Reserve an isolated bootstrap page without replacing a running Web/MCP handler. */
export function acquireLocalWorkerPage(
  html: string,
  workerScript: string,
): Promise<LocalWorkerPageLease> {
  return serial(async () => {
    if (typeof html !== 'string' || typeof workerScript !== 'string')
      throw new Error('书源脚本运行页面或脚本无效');
    if (html.length > 1_000_000 || workerScript.length > 1_000_000)
      throw new Error('书源脚本运行页面过大');
    const entry = active ?? (await createListener(0));
    if (active === entry && (entry.primary || entry.pages.size))
      await assertOwned(entry);
    const path = `/__legado_worker__/${randomUUID()}`;
    entry.pages.set(path, { html, workerScript });
    let released = false;
    return {
      url: `http://127.0.0.1:${entry.port}${path}`,
      release: () =>
        serial(async () => {
          if (released) return;
          if (active !== entry) {
            released = true;
            return;
          }
          entry.pages.delete(path);
          if (!entry.primary && !entry.pages.size) await stopOwned(entry);
          released = true;
        }),
    };
  });
}
