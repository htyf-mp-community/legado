import {
  TemporaryDirectoryPath,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import { jsonText } from '../core/jsonPath';
import { appStorage } from './storage';

const KEY = 'direct.link.upload.rule.v1';
export type DirectLinkRule = {
  uploadUrl: string;
  downloadUrlRule: string;
  summary: string;
  compress: boolean;
  expiryDate: number;
};
export type DirectUploadRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  multipart: boolean;
  fileField: string;
  fields: Record<string, string>;
};
export type DirectLinkUploadErrorCode =
  | 'invalid-upload-url'
  | 'missing-download-rule'
  | 'missing-summary'
  | 'invalid-expiry'
  | 'invalid-json'
  | 'rule-not-object'
  | 'invalid-options-json'
  | 'unsupported-js'
  | 'unsupported-method'
  | 'upload-http'
  | 'missing-download-url'
  | 'multipart-required';
export class DirectLinkUploadError extends Error {
  constructor(readonly code: DirectLinkUploadErrorCode, readonly detail = '') {
    const defaults: Record<DirectLinkUploadErrorCode, string> = {
      'invalid-upload-url': '上传地址无效',
      'missing-download-rule': '下载地址规则不能为空',
      'missing-summary': '规则说明不能为空',
      'invalid-expiry': '有效期必须是 0–3650 天',
      'invalid-json': '直链上传规则不是有效的 JSON',
      'rule-not-object': '直链上传规则必须是对象',
      'invalid-options-json': '上传地址参数 JSON 无效',
      'unsupported-js': '下载地址规则包含不受支持的 JavaScript',
      'unsupported-method': `不支持的上传方法: ${detail}`,
      'upload-http': `上传失败: ${detail}`,
      'missing-download-url': `上传响应中没有下载地址: ${detail}`,
      'multipart-required': '压缩备份需要 multipart fileRequest 上传规则',
    };
    super(defaults[code]);
    this.name = 'DirectLinkUploadError';
  }
}
export const defaultDirectLinkRules: DirectLinkRule[] = [
  {
    uploadUrl:
      'https://sy.nyasama.net/shuyuan,{"method":"POST","body":{"file":"fileRequest"},"type":"multipart/form-data"}',
    downloadUrlRule:
      "$.data@js:if (result == '') '' else 'https://shuyuan.nyasama.net/shuyuan/' + result",
    summary: '喵公子网盘①（有效期30天）',
    compress: false,
    expiryDate: 30,
  },
  {
    uploadUrl:
      'http://v2.jt12.eu/up-v2.php,{"method":"POST","body":{"file":"fileRequest"},"type":"multipart/form-data"}',
    downloadUrlRule: '$.msg',
    summary: '橘涂书源网盘2.0（永久有效）',
    compress: false,
    expiryDate: 0,
  },
];

export function normalizeDirectLinkRule(
  value: Partial<DirectLinkRule>,
): DirectLinkRule {
  const uploadUrl = value.uploadUrl?.trim() ?? '';
  const downloadUrlRule = value.downloadUrlRule?.trim() ?? '';
  const summary = value.summary?.trim() ?? '';
  const expiryDate = Number(value.expiryDate);
  if (!/^https?:\/\//i.test(uploadUrl)) throw new DirectLinkUploadError('invalid-upload-url');
  if (!downloadUrlRule) throw new DirectLinkUploadError('missing-download-rule');
  if (!summary) throw new DirectLinkUploadError('missing-summary');
  if (!Number.isInteger(expiryDate) || expiryDate < 0 || expiryDate > 3650)
    throw new DirectLinkUploadError('invalid-expiry');
  return {
    uploadUrl,
    downloadUrlRule,
    summary,
    compress: !!value.compress,
    expiryDate,
  };
}

export function parseDirectLinkRule(input: string) {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new DirectLinkUploadError('invalid-json');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new DirectLinkUploadError('rule-not-object');
  return normalizeDirectLinkRule(value as Partial<DirectLinkRule>);
}
export function loadDirectLinkRule(): DirectLinkRule | null {
  const raw = appStorage.getString(KEY);
  if (!raw) return null;
  try {
    return parseDirectLinkRule(raw);
  } catch {
    return null;
  }
}
export function saveDirectLinkRule(value: DirectLinkRule) {
  const rule = normalizeDirectLinkRule(value);
  appStorage.set(KEY, JSON.stringify(rule));
  return rule;
}

export function buildDirectUploadRequest(
  ruleValue: DirectLinkRule,
): DirectUploadRequest {
  const rule = normalizeDirectLinkRule(ruleValue);
  const optionStart = rule.uploadUrl.indexOf(',{');
  const url = (
    optionStart < 0 ? rule.uploadUrl : rule.uploadUrl.slice(0, optionStart)
  ).trim();
  let options: Record<string, unknown> = {};
  if (optionStart >= 0) {
    try {
      options = JSON.parse(rule.uploadUrl.slice(optionStart + 1)) as Record<
        string,
        unknown
      >;
    } catch {
      throw new DirectLinkUploadError('invalid-options-json');
    }
  }
  const body =
    options.body && typeof options.body === 'object'
      ? (options.body as Record<string, unknown>)
      : { file: 'fileRequest' };
  const fileField =
    Object.entries(body).find(([, value]) => value === 'fileRequest')?.[0] ??
    'file';
  const fields = Object.fromEntries(
    Object.entries(body)
      .filter(([, value]) => value !== 'fileRequest')
      .map(([key, value]) => [key, String(value)]),
  );
  return {
    url,
    method: String(options.method ?? 'POST').toUpperCase(),
    headers:
      options.headers && typeof options.headers === 'object'
        ? (options.headers as Record<string, string>)
        : {},
    multipart:
      String(options.type ?? '').toLowerCase() === 'multipart/form-data' ||
      Object.values(body).includes('fileRequest'),
    fileField,
    fields,
  };
}

export function extractDirectDownloadUrl(
  response: unknown,
  ruleValue: DirectLinkRule,
) {
  const rule = normalizeDirectLinkRule(ruleValue);
  const [path, script = ''] = rule.downloadUrlRule.split('@js:', 2);
  const result = jsonText(response, path.trim());
  if (!script.trim()) return result;
  // TODO(htyf-native): Evaluate arbitrary download URL JavaScript only after an allowlisted QuickJS runtime is pinned and sandboxed.
  const prefix = script.match(
    /["'](https?:\/\/[^"']*)["']\s*\+\s*result/i,
  )?.[1];
  if (!prefix) throw new DirectLinkUploadError('unsupported-js');
  return result ? prefix + result : '';
}

export async function uploadDirectLink(
  ruleValue: DirectLinkRule,
  fileName: string,
  content: string,
  contentType = 'application/json',
) {
  const rule = normalizeDirectLinkRule(ruleValue);
  const request = buildDirectUploadRequest(rule);
  if (!['POST', 'PUT'].includes(request.method))
    throw new DirectLinkUploadError('unsupported-method', request.method);
  let tempPath = '';
  try {
    let body: string | FormData;
    let headers = request.headers;
    if (request.multipart) {
      tempPath = `${TemporaryDirectoryPath}/legado-upload-${Date.now()}.json`;
      await writeFile(tempPath, content, 'utf8');
      const form = new FormData();
      Object.entries(request.fields).forEach(([key, value]) =>
        form.append(key, value),
      );
      form.append(request.fileField, {
        uri: `file://${tempPath}`,
        type: contentType,
        name: fileName,
      } as unknown as Blob);
      body = form;
    } else {
      headers = { 'Content-Type': contentType, ...headers };
      body = content;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(request.url, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    const text = await response.text();
    if (!response.ok)
      throw new DirectLinkUploadError('upload-http', `HTTP ${response.status} ${text}`);
    let data: unknown = text;
    try {
      data = JSON.parse(text) as unknown;
    } catch {}
    const downloadUrl = extractDirectDownloadUrl(data, rule);
    if (!downloadUrl) throw new DirectLinkUploadError('missing-download-url', text);
    return downloadUrl;
  } finally {
    if (tempPath) await unlink(tempPath).catch(() => undefined);
  }
}

export async function uploadDirectLinkFile(
  ruleValue: DirectLinkRule,
  fileName: string,
  fileUri: string,
  contentType = 'application/zip',
) {
  const rule = normalizeDirectLinkRule(ruleValue);
  const request = buildDirectUploadRequest(rule);
  if (!request.multipart)
    throw new DirectLinkUploadError('multipart-required');
  const form = new FormData();
  Object.entries(request.fields).forEach(([key, value]) => form.append(key, value));
  form.append(request.fileField, { uri: fileUri.startsWith('file://') ? fileUri : `file://${fileUri}`, type: contentType, name: fileName } as unknown as Blob);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const response = await fetch(request.url, { method: request.method, headers: request.headers, body: form, signal: controller.signal }).finally(() => clearTimeout(timer));
  const text = await response.text();
  if (!response.ok) throw new DirectLinkUploadError('upload-http', `HTTP ${response.status} ${text}`);
  let data: unknown = text;
  try { data = JSON.parse(text) as unknown; } catch {}
  const downloadUrl = extractDirectDownloadUrl(data, rule);
  if (!downloadUrl) throw new DirectLinkUploadError('missing-download-url', text);
  return downloadUrl;
}
