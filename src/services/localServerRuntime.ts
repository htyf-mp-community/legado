import {
  HttpServer,
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
// react-native-nitro-http-server 1.9.2 uses g_serverContext/g_serverPort and one Rust listener.
// TODO(htyf-native): Independent listeners are required for the source's simultaneous Web/MCP services.
let active: { owner: LocalService; server: HttpServer } | undefined;
let operations: Promise<unknown> = Promise.resolve();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = operations.then(operation, operation);
  operations = next.catch(() => undefined);
  return next;
}
export function startLocalServer(
  owner: LocalService,
  port: number,
  handler: RequestHandler,
) {
  return serial(async () => {
    if (active) {
      if (active.owner !== owner && (await active.server.isRunning()))
        throw new LocalServiceConflictError(active.owner, owner);
      await active.server.stop();
      active = undefined;
    }
    const server = new HttpServer();
    try {
      const actualPort = await server.start(port, handler, {
        host: '127.0.0.1',
        autoRestart: true,
      });
      if (!(actualPort > 0)) throw new Error('本机服务启动失败');
      active = { owner, server };
      return actualPort;
    } catch (error) {
      await server.stop().catch(() => undefined);
      throw error;
    }
  });
}
export function stopLocalServer(owner: LocalService) {
  return serial(async () => {
    // Stopping an inactive logical service must never shut down the other service.
    if (active?.owner !== owner) return;
    await active.server.stop();
    active = undefined;
  });
}
export function localServerState(owner: LocalService, configuredPort: number) {
  return serial(async () => ({
    running: active?.owner === owner ? await active.server.isRunning() : false,
    port: active?.owner === owner ? active.server.port : configuredPort,
  }));
}
