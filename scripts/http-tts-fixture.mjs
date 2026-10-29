import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// 仅用于模拟器验收的本机语音服务，不属于小程序运行时或生产降级逻辑。
// 使用 macOS 自带 say/afconvert，无第三方服务，监听地址固定为回环地址。
const execute = promisify(execFile),
  port = 8098;
const engine = {
  id: -8098,
  name: '本机朗读验收（仅调试）',
  url: `http://127.0.0.1:${port}/tts?text={{encodeURIComponent(speakText)}}&speed={{speakSpeed}}`,
  contentType: 'audio/wav',
  pauseDuration: 300,
};
http
  .createServer(async (request, response) => {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/engines') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify([engine]));
      return;
    }
    if (url.pathname !== '/tts') {
      response.writeHead(404);
      response.end();
      return;
    }
    const text = url.searchParams.get('text') ?? '',
      speed = Number(url.searchParams.get('speed') ?? 10);
    if (!text || text.length > 10_000) {
      response.writeHead(400);
      response.end('invalid text');
      return;
    }
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'legado-tts-fixture-'),
    );
    const abort = new AbortController();
    response.on('close', () => abort.abort());
    try {
      const audio = path.join(directory, 'speech.aiff'),
        wave = path.join(directory, 'speech.wav');
      await execute(
        '/usr/bin/say',
        [
          '-v',
          'Tingting',
          '-r',
          String(Math.min(400, Math.max(80, speed * 18))),
          '-o',
          audio,
          '--',
          text,
        ],
        { signal: abort.signal },
      );
      await execute(
        '/usr/bin/afconvert',
        ['-f', 'WAVE', '-d', 'LEI16', audio, wave],
        { signal: abort.signal },
      );
      const bytes = await readFile(wave);
      console.log(
        JSON.stringify({
          type: 'speech',
          characters: text.length,
          speed,
          bytes: bytes.length,
        }),
      );
      response.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': bytes.length,
      });
      response.end(bytes);
    } catch (error) {
      if (!response.destroyed) {
        response.writeHead(500, { 'Content-Type': 'text/plain' });
        response.end(String(error));
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  })
  .listen(port, '127.0.0.1', () =>
    console.log(`HTTP TTS iOS test fixture: http://127.0.0.1:${port}/engines`),
  );
