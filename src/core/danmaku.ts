export type DanmakuItem = {
  time: number;
  text: string;
  color: string;
  mode: 'scroll' | 'top' | 'bottom';
};

const entity = (value: string) => value
  .replace(/&#(x?[0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code.replace(/^x/i, ''), /^x/i.test(code) ? 16 : 10)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const color = (value: unknown) => `#${Math.max(0, Math.min(0xffffff, Number(value) || 0xffffff)).toString(16).padStart(6, '0')}`;
const mode = (value: unknown): DanmakuItem['mode'] => Number(value) === 5 ? 'top' : Number(value) === 4 ? 'bottom' : 'scroll';

export function parseDanmaku(raw: string): DanmakuItem[] {
  const result: DanmakuItem[] = [];
  for (const match of raw.matchAll(/<d\b[^>]*\bp=["']([^"']+)["'][^>]*>([\s\S]*?)<\/d>/gi)) {
    const fields = match[1].split(','), time = Number(fields[0]), text = entity(match[2].replace(/<[^>]+>/g, '')).trim();
    if (Number.isFinite(time) && time >= 0 && text) result.push({ time, text, mode: mode(fields[1]), color: color(fields[3]) });
  }
  if (!result.length) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const rows = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).data) ? (parsed as Record<string, unknown>).data as unknown[] : [];
      for (const row of rows) {
        const item: Record<string, unknown> = Array.isArray(row) ? { time: row[0], text: row[1], mode: row[2], color: row[3] } : row && typeof row === 'object' ? row as Record<string, unknown> : {};
        const time = Number(item.time ?? item.progress) / (item.progress !== undefined ? 1000 : 1), text = String(item.text ?? item.content ?? '').trim();
        if (Number.isFinite(time) && time >= 0 && text) result.push({ time, text, mode: mode(item.mode), color: color(item.color) });
      }
    } catch {}
  }
  if (!result.length) for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.+)$/);
    if (match) result.push({ time: Number(match[1]) * 60 + Number(match[2]), text: match[3].trim(), color: '#ffffff', mode: 'scroll' });
  }
  return result.sort((a, b) => a.time - b.time);
}

export function activeDanmaku(items: DanmakuItem[], position: number, duration = 6) {
  return items.filter(item => item.time <= position && position - item.time < duration).slice(-5);
}
