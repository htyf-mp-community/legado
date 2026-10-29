import { appStorage } from './storage';
import { defaultHttpTts } from './defaultHttpTts';

/** Android HttpTTS JSON contract. Unknown fields survive import/edit/export. */
export type HttpTts = {
  id: number;
  name: string;
  url: string;
  contentType?: string | null;
  /** Paragraph pause in milliseconds, clamped to Android's 0…10,000 range. */
  pauseDuration: number;
  concurrentRate?: string | null;
  loginUrl?: string | null;
  loginUi?: string | null;
  header?: string | null;
  jsLib?: string | null;
  enabledCookieJar: boolean;
  loginCheckJs?: string | null;
  lastUpdateTime: number;
  [key: string]: unknown;
};
export const HTTP_TTS_KEY = 'http.tts.engines.v1';
const PREFERENCES_KEY = 'http.tts.preferences.v1';

/** Same engine ID and speech-rate units as ReadAloud/AppConfig on Android. */
export type ReadAloudPreferences = {
  engineId?: number;
  speechRate: number;
  timerMinutes: number;
};
const defaults: ReadAloudPreferences = { speechRate: 5, timerMinutes: 0 };

/** Validate imported records before any storage write; never execute imported scripts. */
export function normalizeHttpTts(
  value: unknown,
  fallbackId = Date.now(),
): HttpTts {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('HTTP TTS 条目必须是对象');
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.name !== 'string' ||
    !raw.name.trim() ||
    typeof raw.url !== 'string' ||
    !raw.url.trim()
  )
    throw new Error('HTTP TTS 名称和 URL 不能为空');
  const pause = Number(raw.pauseDuration ?? 0),
    id = Number(raw.id ?? fallbackId);
  if (!Number.isSafeInteger(id)) throw new Error('HTTP TTS ID 无效');
  return {
    ...raw,
    id,
    name: raw.name,
    url: raw.url,
    pauseDuration: Number.isFinite(pause)
      ? Math.min(10_000, Math.max(0, Math.trunc(pause)))
      : 0,
    loginUi: Array.isArray(raw.loginUi)
      ? JSON.stringify(raw.loginUi)
      : (raw.loginUi as string | null | undefined),
    enabledCookieJar: raw.enabledCookieJar === true,
    lastUpdateTime: Number.isFinite(raw.lastUpdateTime)
      ? Number(raw.lastUpdateTime)
      : Date.now(),
  };
}

/** Accept both Android's single-record and array export formats, atomically. */
export function parseHttpTts(input: string): HttpTts[] {
  const raw: unknown = JSON.parse(input),
    list = Array.isArray(raw) ? raw : [raw],
    now = Date.now();
  if (!list.length) throw new Error('HTTP TTS 列表为空');
  return list.map((item, index) => normalizeHttpTts(item, now + index));
}

/** Replace matching primary keys while retaining the existing display order. */
export function mergeHttpTts(current: HttpTts[], incoming: HttpTts[]) {
  return [
    ...new Map([...current, ...incoming].map(item => [item.id, item])).values(),
  ];
}

/** Read engines only from the shared, application-isolated MMKV namespace. */
export function loadHttpTts(): HttpTts[] {
  const raw = appStorage.getString(HTTP_TTS_KEY);
  if (raw === undefined)
    return saveHttpTts(parseHttpTts(JSON.stringify(defaultHttpTts)));
  try {
    return parseHttpTts(raw);
  } catch {
    return [];
  }
}

/** Android DefaultData.importDefaultHttpTTS removes negative default IDs and preserves user engines. */
export function restoreDefaultHttpTts(current: HttpTts[]) {
  return mergeHttpTts(
    current.filter(engine => engine.id >= 0),
    parseHttpTts(JSON.stringify(defaultHttpTts)),
  );
}

/** Validate the whole collection before committing; an empty list clears engines. */
export function saveHttpTts(engines: HttpTts[]) {
  const normalized = engines.map(item => normalizeHttpTts(item));
  appStorage.set(HTTP_TTS_KEY, JSON.stringify(normalized));
  return normalized;
}

/** Load persisted HTTP engine selection and Android speech-rate/timer defaults. */
export function loadReadAloudPreferences(): ReadAloudPreferences {
  try {
    return normalizePreferences(
      JSON.parse(appStorage.getString(PREFERENCES_KEY) ?? '{}'),
    );
  } catch {
    return { ...defaults };
  }
}
function normalizePreferences(
  raw: Partial<ReadAloudPreferences>,
): ReadAloudPreferences {
  return {
    engineId: Number.isSafeInteger(raw.engineId) ? raw.engineId : undefined,
    speechRate: Number.isFinite(raw.speechRate)
      ? Math.min(45, Math.max(0, Math.trunc(raw.speechRate!)))
      : 5,
    timerMinutes: Number.isFinite(raw.timerMinutes)
      ? Math.max(0, Math.trunc(raw.timerMinutes!))
      : 0,
  };
}

/** Persist a patch without resetting unrelated read-aloud choices. */
export function saveReadAloudPreferences(patch: Partial<ReadAloudPreferences>) {
  const normalized = normalizePreferences({
    ...loadReadAloudPreferences(),
    ...patch,
  });
  appStorage.set(PREFERENCES_KEY, JSON.stringify(normalized));
  return normalized;
}
