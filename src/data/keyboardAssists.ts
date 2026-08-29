import { appStorage } from './storage';

export type KeyboardAssist = { type: number; key: string; value: string; serialNo: number };
export type TextSelection = { start: number; end: number };
const KEY = 'keyboard-assists.v1', LINES_KEY = 'keyboard-assists.lines.v1';
const DEFAULT_PAIRS: Array<[string, string?]> = [
  ['@css:'], ['<js>', '<js></js>'], ['{{}}'], ['##'], ['&&'], ['%%'], ['||'], ['//'], ['\\'], ['$.'], ['@'], [':'], ['class'], ['text'], ['href'], ['textNodes'], ['ownText'], ['all'], ['html'], ['['], [']'], ['<'], ['>'], ['#'], ['!'], ['.'], ['+'], ['-'], ['*'], ['/'], ['='], ['useWebView', ',{"webView": true}'],
];
export const defaultKeyboardAssists: KeyboardAssist[] = DEFAULT_PAIRS.map(([key, value], serialNo) => ({ type: 0, key, value: value ?? key, serialNo }));

export function normalizeKeyboardAssists(value: unknown) {
  if (!Array.isArray(value)) return defaultKeyboardAssists;
  const seen = new Set<string>();
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>, type = Math.max(0, Math.floor(Number(raw.type) || 0)), key = String(raw.key ?? '').trim(), insert = String(raw.value ?? '');
    const id = `${type}\0${key}`;
    if (!key || seen.has(id)) return [];
    seen.add(id);
    return [{ type, key, value: insert, serialNo: Math.max(0, Math.floor(Number(raw.serialNo) || index)) }];
  }).sort((a, b) => a.serialNo - b.serialNo).map((item, serialNo) => ({ ...item, serialNo }));
}
export function parseKeyboardAssists(input: string) { let value: unknown; try { value = JSON.parse(input); } catch { throw new Error('辅助按键不是有效的 JSON'); } if (!Array.isArray(value)) throw new Error('辅助按键必须是列表'); return normalizeKeyboardAssists(value); }
export function loadKeyboardAssists() { const raw = appStorage.getString(KEY); if (!raw) return defaultKeyboardAssists; try { return normalizeKeyboardAssists(JSON.parse(raw)); } catch { return defaultKeyboardAssists; } }
export function saveKeyboardAssists(value: KeyboardAssist[]) { const normalized = normalizeKeyboardAssists(value); appStorage.set(KEY, JSON.stringify(normalized)); return normalized; }
export function loadKeyboardAssistLines() { return Math.max(1, Math.min(5, Math.floor(appStorage.getNumber(LINES_KEY) ?? 1))); }
export function saveKeyboardAssistLines(value: number) { const lines = Math.max(1, Math.min(5, Math.floor(value) || 1)); appStorage.set(LINES_KEY, lines); return lines; }
export function insertKeyboardAssist(text: string, selection: TextSelection, value: string) {
  const start = Math.max(0, Math.min(text.length, Math.min(selection.start, selection.end))), end = Math.max(start, Math.min(text.length, Math.max(selection.start, selection.end))), next = `${text.slice(0, start)}${value}${text.slice(end)}`, cursor = start + value.length;
  return { text: next, selection: { start: cursor, end: cursor } };
}
