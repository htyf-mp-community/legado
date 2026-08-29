import { CachesDirectoryPath, mkdir, writeFile } from '@dr.pogodin/react-native-fs';
import { fromByteArray } from 'react-native-quick-base64';
import type { BookSource, HttpTtsRule } from '../types';
import { buildSourceRequest } from './sourceRequest';

export function expandHttpTtsUrl(rule: string, speakText: string, speakSpeed: number) {
  const encoded = encodeURIComponent(speakText), doubleEncoded = encodeURIComponent(encoded), commonSpeed = (speakSpeed + 5) / 10 + 4;
  return rule
    .replace(/\{\{\s*java\.encodeURI\(java\.encodeURI\(speakText\)\)\s*\}\}/g, doubleEncoded)
    .replace(/\{\{\s*java\.encodeURI\(speakText\)\s*\}\}/g, encoded)
    .replace(/\{\{\s*(?:String\()?\(?\(speakSpeed\s*\+\s*5\)\s*\/\s*10\s*\+\s*4\)?\)?\s*\}\}/g, String(commonSpeed))
    .replace(/\{\{\s*speakText\s*\}\}/g, speakText)
    .replace(/\{\{\s*speakSpeed\s*\}\}/g, String(speakSpeed));
}
export function splitTtsText(input: string, maxLength = 220) {
  const text = input.replace(/\r/g, '').trim();
  if (!text) return [];
  const limit = Math.max(20, maxLength);
  const result: string[] = [];
  for (const paragraph of text.split(/\n+/).map(item => item.trim()).filter(Boolean)) {
    let rest = paragraph;
    while (rest.length > limit) {
      const window = rest.slice(0, limit + 1);
      const boundary = Math.max(
        window.lastIndexOf('。'), window.lastIndexOf('！'), window.lastIndexOf('？'),
        window.lastIndexOf('；'), window.lastIndexOf('，'), window.lastIndexOf(' '),
      );
      const end = boundary >= Math.floor(limit * 0.45) ? boundary + 1 : limit;
      result.push(rest.slice(0, end).trim());
      rest = rest.slice(end).trim();
    }
    if (rest) result.push(rest);
  }
  return result;
}
export function buildHttpTtsRequest(rule: HttpTtsRule, speakText: string, speakSpeed: number) {
  const expanded = expandHttpTtsUrl(rule.url, speakText, speakSpeed);
  const source: BookSource = { bookSourceUrl: /^https?:/i.test(expanded) ? expanded : 'https://http-tts.invalid/', bookSourceName: rule.name, bookSourceType: 1, customOrder: 0, enabled: true, enabledExplore: false, header: rule.header, enabledCookieJar: rule.enabledCookieJar };
  return buildSourceRequest(source, expanded);
}
export async function synthesizeHttpTts(rule: HttpTtsRule, speakText: string, speakSpeed: number, cacheKey = Date.now().toString()) {
  const request = buildHttpTtsRequest(rule, speakText, speakSpeed), controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP TTS 请求失败: ${response.status}`);
    const contentType = response.headers.get('content-type') ?? rule.contentType ?? '';
    if (contentType.includes('json') || contentType.startsWith('text/')) throw new Error(`HTTP TTS 返回了非音频内容: ${await response.text()}`);
    const bytes = new Uint8Array(await response.arrayBuffer()), directory = `${CachesDirectoryPath}/legado-http-tts`, extension = contentType.includes('wav') ? 'wav' : contentType.includes('ogg') ? 'ogg' : 'mp3', path = `${directory}/${rule.id}-${cacheKey.replace(/[^a-z0-9_-]/gi, '')}.${extension}`;
    await mkdir(directory); await writeFile(path, fromByteArray(bytes), 'base64');
    return `file://${path}`;
  } finally { clearTimeout(timer); }
}
