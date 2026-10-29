import {
  CachesDirectoryPath,
  exists,
  mkdir,
  moveFile,
  readFile,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import { fromByteArray } from 'react-native-quick-base64';
import { createHash } from 'react-native-quick-crypto';
import TrackPlayer, { Event } from 'react-native-track-player';
import { ensureAudioPlayer } from '../core/audioPlayer';
import {
  buildHttpTtsRequest,
  httpTtsAudioExtension,
  validateHttpTtsResponse,
} from '../core/httpTts';
import type { ReadAloudDriver } from '../core/readAloud';
import type { HttpTts } from '../data/httpTts';
import { saveResponseCookies } from '../data/sourceCookies';
import { addAppLog } from '../data/appLog';

/** Cached audio is application-owned and may be removed by normal cache maintenance. */
function checkAborted(signal: AbortSignal) {
  if (signal.aborted) throw new Error('朗读已取消');
}

export const HTTP_TTS_CACHE = `${CachesDirectoryPath}/httpTTS`;

/**
 * Fetch GET/POST audio with source-isolated Cookies and a 300 s timeout (Android default).
 * Abort is checked after every native write so stale paragraphs never enter the player queue.
 */
export async function loadHttpTtsAudio(
  engine: HttpTts,
  text: string,
  speed: number,
  signal: AbortSignal,
) {
  const request = buildHttpTtsRequest(engine, text, speed),
    key = createHash('sha256')
      .update(JSON.stringify({ engine, request }))
      .digest('hex'),
    base = `${HTTP_TTS_CACHE}/${key}`,
    metadataPath = `${base}.json`;
  checkAborted(signal);
  if (await exists(metadataPath)) {
    const metadata = await readFile(metadataPath, 'utf8')
      .then(raw => JSON.parse(raw) as { extension?: string })
      .catch(error => {
        addAppLog(
          'HTTP TTS cache metadata invalid; fetching audio again',
          error,
        );
        return undefined;
      });
    if (
      metadata?.extension &&
      ['wav', 'mp3', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'aiff'].includes(
        metadata.extension,
      )
    ) {
      const cached = `${base}.${metadata.extension}`;
      if (await exists(cached)) {
        checkAborted(signal);
        return `file://${cached}`;
      }
    }
  }
  const controller = new AbortController(),
    abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 300_000),
    temporary = `${base}.${Date.now()}.tmp`;
  try {
    checkAborted(signal);
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'POST' ? request.body : undefined,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    validateHttpTtsResponse(
      response.headers.get('content-type'),
      engine.contentType,
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new Error('TTS 服务器返回空音频');
    checkAborted(signal);
    if (request.cookieJar) {
      const headers: Record<string, string> = {};
      response.headers.forEach((value, name) => {
        headers[name] = value;
      });
      saveResponseCookies(request.sourceId, headers['set-cookie'] ?? '');
    }
    await mkdir(HTTP_TTS_CACHE);
    await writeFile(temporary, fromByteArray(bytes), 'base64');
    checkAborted(signal);
    const extension = httpTtsAudioExtension(
        response.headers.get('content-type'),
        bytes,
      ),
      path = `${base}.${extension}`;
    await moveFile(temporary, path);
    await writeFile(metadataPath, JSON.stringify({ extension }), 'utf8');
    checkAborted(signal);
    return `file://${path}`;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    if (await exists(temporary)) await unlink(temporary);
  }
}

/** Clear only HTTP TTS audio, retaining books, engines and preferences. */
export async function clearHttpTtsCache() {
  if (await exists(HTTP_TTS_CACHE)) await unlink(HTTP_TTS_CACHE);
}

/** TrackPlayer adapter for the foreground reader; removes every event listener on completion/cancel. */
export function createHttpTtsDriver(
  engine: HttpTts,
  speed: number,
  title: string,
): ReadAloudDriver {
  return {
    stop: async () => {
      await ensureAudioPlayer();
      await TrackPlayer.reset();
    },
    pause: async () => {
      await TrackPlayer.pause();
    },
    resume: async () => {
      await TrackPlayer.play();
    },
    speak: async (text, index, signal, started) => {
      const url = await loadHttpTtsAudio(engine, text, speed, signal);
      checkAborted(signal);
      await ensureAudioPlayer();
      checkAborted(signal);
      await TrackPlayer.setQueue([
        { id: `tts:${engine.id}:${index}`, url, title, artist: engine.name },
      ]);
      checkAborted(signal);
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          ended.remove();
          failed.remove();
          signal.removeEventListener('abort', cancel);
        };
        const cancel = () => {
          cleanup();
          reject(new Error('朗读已取消'));
        };
        const ended = TrackPlayer.addEventListener(
          Event.PlaybackQueueEnded,
          () => {
            cleanup();
            resolve();
          },
        );
        const failed = TrackPlayer.addEventListener(
          Event.PlaybackError,
          event => {
            cleanup();
            reject(new Error(event.message || event.code || '音频播放失败'));
          },
        );
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) {
          cancel();
          return;
        }
        void TrackPlayer.setRate(1)
          .then(() => TrackPlayer.play())
          .then(started)
          .catch(error => {
            cleanup();
            reject(error);
          });
      });
    },
  };
}
