jest.mock('react-native-nitro-http-server', () => ({ HttpServer: jest.fn() }));
import { HttpServer } from 'react-native-nitro-http-server';
import {
  localServerState,
  startLocalServer,
  stopLocalServer,
  LocalServiceConflictError,
} from '../src/services/localServerRuntime';
const server = {
  start: jest.fn(),
  stop: jest.fn(),
  isRunning: jest.fn(),
  port: 1122,
};
const handler = () => ({ statusCode: 200, body: 'OK' });
beforeEach(async () => {
  await stopLocalServer('web');
  await stopLocalServer('mcp');
  jest.clearAllMocks();
  jest
    .mocked(HttpServer)
    .mockImplementation(() => server as unknown as HttpServer);
  server.start.mockImplementation(async (port: number) => {
    server.port = port;
    return port;
  });
  server.isRunning.mockResolvedValue(true);
  server.stop.mockResolvedValue(undefined);
});
test('starting the other service preserves the running listener and reports a conflict', async () => {
  await startLocalServer('web', 1122, handler);
  await expect(startLocalServer('mcp', 1236, handler)).rejects.toBeInstanceOf(
    LocalServiceConflictError,
  );
  expect(server.start).toHaveBeenCalledTimes(1);
  expect(server.stop).not.toHaveBeenCalled();
  await expect(localServerState('web', 1122)).resolves.toEqual({
    running: true,
    port: 1122,
  });
  await expect(localServerState('mcp', 1236)).resolves.toEqual({
    running: false,
    port: 1236,
  });
});
test('stopping an inactive service leaves the active service available', async () => {
  await startLocalServer('web', 1122, handler);
  await stopLocalServer('mcp');
  expect(server.stop).not.toHaveBeenCalled();
  await stopLocalServer('web');
  await startLocalServer('mcp', 1236, handler);
  expect(server.stop).toHaveBeenCalledTimes(1);
  await expect(localServerState('mcp', 1236)).resolves.toMatchObject({
    running: true,
    port: 1236,
  });
});
test('concurrent starts are serialized and cannot overwrite one native listener', async () => {
  const results = await Promise.allSettled([
    startLocalServer('web', 1122, handler),
    startLocalServer('mcp', 1236, handler),
  ]);
  expect(results.map(result => result.status)).toEqual([
    'fulfilled',
    'rejected',
  ]);
  expect(server.start).toHaveBeenCalledTimes(1);
});
test('a failed start releases ownership so the other service can start', async () => {
  server.start.mockRejectedValueOnce(new Error('port busy'));
  await expect(startLocalServer('web', 1122, handler)).rejects.toThrow(
    'port busy',
  );
  await expect(startLocalServer('mcp', 1236, handler)).resolves.toBe(1236);
});
