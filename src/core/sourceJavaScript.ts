import type { AnyNode, Element } from 'domhandler';
import { RE2JS } from 're2js';
import { SourceHttpError, SourceRuleError } from './errors';
import { sourceHtmlText } from './htmlText';
import { parseBoundedJson, stringifyBoundedJson } from './boundedJson';
import { encodeJavaFormValue, javaBytes, utf8Bytes } from './sourceUrlEncoding';
import { canDecodeSourceCharset, decodeJavaUtf8, decodeSourceCharset } from './sourceCharsetDecode';
import { canEncodeSourceCharset } from './sourceCharsetAvailability';
import { isSourceNode as isNode } from './sourceDomIdentity';
import { selectSourceElements } from './sourceSelector';
import { serializeSourceHtml } from './htmlSerialization';
import { convertChinese } from './chineseConversion';
import { decodeSourceHex, encodeSourceHex } from './sourceJavaScriptHex';
import { sourceChapterNumber } from './sourceChapterNumber';
import { createSourceSymmetric } from './sourceSymmetricCrypto';
import { formatSourceLocalTime, formatSourceUtcTime } from './sourceJavaScriptTime';
import { resolveNativeResourceUrl } from './nativeSourceUrl';
import { lowerSourceTemplates, TEMPLATE_STRING } from './sourceTemplateLiteral';
import { lowerSourceLexicalDeclarations } from './sourceLexicalDeclarations';
import {decodeSourceBase64, encodeSourceBase64} from './sourceJavaScriptBase64';
import {sourceJavaScriptMd5} from './sourceJavaScriptMd5';
import {sourceDigestAlgorithm, sourceJavaScriptDigest} from './sourceJavaScriptDigest';

// The interpreter has a separate ES5 object model. Only narrow adapters below
// are exposed to scripts; native application objects are never passed in.
const Interpreter = require('js-interpreter');
const MAX_SCRIPT = 16_384;
const MAX_ITEMS = 8_000;
const MAX_STRING = 1_000_000;
const MAX_STEPS = 1_000_000;
const MAX_MS = 1_500;

type RuleGlobals = Record<string, unknown>;
export type RuleLookup = {
  text: (rule: string, isUrl: boolean, content?: unknown, unescape?: boolean) => string;
  list: (rule: string, isUrl: boolean, content?: unknown) => string[] | null;
  elements: (rule: string) => unknown[];
  element: (rule: string) => unknown;
  setContent: (value: () => unknown, baseUrl?: string) => void;
};
export type SourceVariableBridge = {get:(key:string)=>string; put:(key:string,value:string)=>string; getVariable:()=>string; setVariable:(value:string|null)=>void};

export type SourceJavaScriptBridge = {
  baseUrl: string;
  sourceUrl?: string;
  key: string | null;
  page: number | null;
  ajax: (url: string) => Promise<string>;
  removeCookie: (url: string) => void;
  getCookie?: (url: string) => string;
  post?: (url: string, body: string, headers: Record<string, string>, timeout?: number) => Promise<SourceJavaScriptResponse>;
  onResponse?: (response: SourceJavaScriptResponse) => void;
  response?: SourceJavaScriptResponse;
  connect?: (url: string) => Promise<SourceJavaScriptResponse>;
  browser?: (url: string, title: string, refetch: boolean, html?: string) => Promise<SourceJavaScriptResponse>;
  toast?: (message: string, long?: boolean) => void;
  variables?: Map<string, string>;
  fallbackVariables?: Map<string, string>;
  bookName?: string;
  chapterTitle?: string;
  sourceVariables?: SourceVariableBridge;
  lookup?: RuleLookup;
  ruleGlobals?: Record<string,unknown>;
  ruleMode?: boolean;
};
export type SourceJavaScriptResponse = { data: unknown; url: string; body: string; code: number; headers?: Record<string, string> };
export type SourceJavaScriptRunner = (script:string, bridge:SourceJavaScriptBridge, input?:unknown, signal?:AbortSignal)=>Promise<unknown>;

type VariableContext = { fallback?: Map<string, string>; bookName?: string; title?: string | null; sourceUrl?: string; sourceVariables?: SourceVariableBridge };
function prepare(script: string, input: unknown, bridge?: SourceJavaScriptBridge, globals?: RuleGlobals, lookup?: RuleLookup, variables?: Map<string, string>, variableContext?: VariableContext) {
  if (script.length > MAX_SCRIPT) throw new SourceRuleError('JavaScript 脚本过长');
  const nodes = new Map<object, AnyNode>();
  const responses = new Map<object, SourceJavaScriptResponse>();
  let pending: Promise<void> | undefined;
  let requests = 0;
  let encodingWork = 0;
  let conversionWork = 0;
  let ruleLookups = 0;
  let listResultWork = 0;
  let domWork = 0;
  let logCount = 0;
  let largeSourceSetter: unknown;
  const lookupBudget = { count: 0, chars: 0 };
  const parseEs5 = (value:string) => Interpreter.nativeGlobal.acorn.parse(value, Interpreter.PARSE_OPTIONS);
  const templatesLowered = lowerSourceTemplates(script, parseEs5);
  const loweredScript = lowerSourceLexicalDeclarations(templatesLowered, parseEs5, Object.keys(globals ?? {}));
  const interpreter = new Interpreter(loweredScript, (runtime: any, global: any) => {
    if (templatesLowered !== script) runtime.setProperty(global, TEMPLATE_STRING, runtime.createNativeFunction((value: unknown) => {
      // JS-Interpreter's String constructor does not invoke user-defined
      // toString/valueOf on pseudo objects. Refuse rather than return a
      // different value until that coercion can be implemented correctly.
      if (value !== null && typeof value === 'object')
        throw new SourceRuleError('JavaScript 模板字符串暂不支持对象转换');
      const result = String(value);
      if (result.length > MAX_STRING) throw new SourceRuleError('JavaScript 模板字符串超过限制');
      return result;
    }, false), Interpreter.NONCONFIGURABLE_READONLY_NONENUMERABLE_DESCRIPTOR);
    const convert = (value: unknown, depth = 0): any => {
      if (depth > 20) throw new SourceRuleError('JavaScript 输入嵌套过深');
      if (isNode(value)) {
        const object = runtime.nativeToPseudo({});
        nodes.set(object, value);
        runtime.setProperty(object, 'attr', runtime.createNativeFunction((name: unknown) =>
          nodeAttribute(value, inputText(name)), false));
        runtime.setProperty(object, 'text', runtime.createNativeFunction(() => domText([value]), false));
        runtime.setProperty(object, 'html', runtime.createNativeFunction(() => domHtml([value]), false));
        runtime.setProperty(object, 'select', runtime.createNativeFunction((selector: unknown) => selectNodes([value], selector), false));
        return object;
      }
      if (typeof value === 'string' && value.length > MAX_STRING)
        throw new SourceRuleError('JavaScript 输入过长');
      if (Array.isArray(value)) {
        if (value.length > MAX_ITEMS) throw new SourceRuleError('JavaScript 输入项目过多');
        const array = runtime.createArray();
        value.forEach((item, index) => runtime.setProperty(array, index, convert(item, depth + 1)));
        return array;
      }
      if (value && typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.length > MAX_ITEMS) throw new SourceRuleError('JavaScript 输入项目过多');
        const object = runtime.nativeToPseudo({});
        for (const [key, item] of entries) runtime.setProperty(object, key, convert(item, depth + 1));
        return object;
      }
      return value;
    };
    const makeResponse = (value: SourceJavaScriptResponse) => {
      if (value.body.length > MAX_STRING) throw new SourceRuleError('JavaScript 响应超过限制');
      const object = runtime.nativeToPseudo({});
      responses.set(object, value);
      bridge?.onResponse?.(value);
      runtime.setProperty(object, 'body', runtime.createNativeFunction(() => value.body, false));
      runtime.setProperty(object, 'url', runtime.createNativeFunction(() => value.url, false));
      runtime.setProperty(object, 'code', runtime.createNativeFunction(() => value.code, false));
      runtime.setProperty(object, 'statusCode', runtime.createNativeFunction(() => value.code, false));
      runtime.setProperty(object, 'header', runtime.createNativeFunction((name: unknown) => {
        const key = inputText(name).toLowerCase();
        return Object.entries(value.headers ?? {}).find(([header]) => header.toLowerCase() === key)?.[1] ?? null;
      }, false));
      return object;
    };
    const convertedInput = bridge?.response ? makeResponse(bridge.response) : convert(input);
    runtime.setProperty(global, 'result', convertedInput);
    if (globals) for (const [name, value] of Object.entries(globals)) {
      if (name === 'src' && typeof value === 'string' && value.length > MAX_STRING && value !== input) {
        let assigned = false, assignedValue: unknown;
        largeSourceSetter = runtime.createNativeFunction((next: unknown) => { assigned = true; assignedValue = next; }, false);
        runtime.setProperty(global, name, Interpreter.VALUE_IN_DESCRIPTOR, {
          configurable: true, enumerable: true,
          get: runtime.createNativeFunction(() => assigned ? assignedValue : convert(value), false),
          set: largeSourceSetter,
        });
      } else runtime.setProperty(global, name, value === input ? convertedInput : convert(value));
    }
    const java = runtime.nativeToPseudo({});
    const inputText = (value: unknown) => {
      if (value !== null && typeof value === 'object') throw new SourceRuleError('JavaScript 编码参数必须是基本类型');
      const text = String(value);
      encodingWork += text.length + 1;
      if (text.length > 64_000 || encodingWork > 1_000_000) throw new SourceRuleError('JavaScript 编码超过限制');
      return text;
    };
    const sourceText = (value: string) => {
      encodingWork += value.length + 1;
      if (value.length > MAX_STRING || encodingWork > MAX_STRING) throw new SourceRuleError('JavaScript 书源变量超过限制');
      return value;
    };
    const variableMap = bridge?.variables ?? variables ?? new Map<string, string>();
    runtime.setProperty(java, 'get', runtime.createNativeFunction((key: unknown) => {
      const name = inputText(key);
      const bookName = variableContext?.bookName ?? bridge?.bookName;
      const title = variableContext?.title ?? bridge?.chapterTitle;
      if (name === 'bookName' && bookName !== undefined) return bookName;
      if (name === 'title' && title != null) return title;
      return variableMap.get(name) || (variableContext?.fallback ?? bridge?.fallbackVariables)?.get(name) ||
        (variableContext?.sourceVariables ? sourceText(variableContext.sourceVariables.get(name)) : '');
    }, false));
    runtime.setProperty(java, 'put', runtime.createNativeFunction((key: unknown, value: unknown) => {
      const name = inputText(key), text = inputText(value);
      if (!variableMap.has(name) && variableMap.size >= 1024) throw new SourceRuleError('JavaScript 变量数量超过限制');
      let total = name.length + text.length;
      for (const [oldName, oldValue] of variableMap) if (oldName !== name) total += oldName.length + oldValue.length;
      if (total > MAX_STRING) throw new SourceRuleError('JavaScript 变量大小超过限制');
      variableMap.set(name, text);
      return text;
    }, false));
    const md5 = (value: unknown) => sourceJavaScriptMd5(inputText(value));
    runtime.setProperty(java, 'md5Encode', runtime.createNativeFunction(md5, false));
    runtime.setProperty(java, 'md5Encode16', runtime.createNativeFunction((value: unknown) => md5(value).slice(8, 24), false));
    const digest = (value: unknown, name: unknown, encoding: 'hex' | 'base64', key?: unknown) => {
      const algorithm = sourceDigestAlgorithm(inputText(name), key !== undefined);
      if (!algorithm) return runtime.throwException(runtime.TYPE_ERROR, 'JavaScript 摘要算法不支持');
      const input = inputText(value), keyText = key === undefined ? undefined : inputText(key);
      try {
        return sourceJavaScriptDigest(input, algorithm, encoding, keyText);
      } catch (error) {
        if (error instanceof SourceRuleError) throw error;
        return runtime.throwException(runtime.TYPE_ERROR, error instanceof Error ? error.message : 'JavaScript 摘要失败');
      }
    };
    runtime.setProperty(java, 'digestHex', runtime.createNativeFunction((value: unknown, algorithm: unknown) => digest(value, algorithm, 'hex'), false));
    runtime.setProperty(java, 'digestBase64Str', runtime.createNativeFunction((value: unknown, algorithm: unknown) => digest(value, algorithm, 'base64'), false));
    runtime.setProperty(java, 'HMacHex', runtime.createNativeFunction((value: unknown, algorithm: unknown, key: unknown) => digest(value, algorithm, 'hex', key), false));
    runtime.setProperty(java, 'HMacBase64', runtime.createNativeFunction((value: unknown, algorithm: unknown, key: unknown) => digest(value, algorithm, 'base64', key), false));
    let uuidCount = 0;
    runtime.setProperty(java, 'randomUUID', runtime.createNativeFunction(() => {
      if (++uuidCount > 1024) throw new SourceRuleError('JavaScript UUID 生成次数超过限制');
      return require('react-native-quick-crypto').randomUUID();
    }, false));
    const conversionInput = (value: unknown) => {
      if (value !== null && typeof value === 'object') throw new SourceRuleError('JavaScript 转换参数必须是基本类型');
      const input = String(value);
      conversionWork += input.length + 1;
      if (input.length > MAX_STRING || conversionWork > 5_000_000) throw new SourceRuleError('JavaScript 转换超过限制');
      return input;
    };
    const chineseConversion = (value: unknown, mode: 1 | 2) => {
      const input = conversionInput(value);
      const result = convertChinese(input, mode);
      if (result.length > MAX_STRING) throw new SourceRuleError('JavaScript 中文转换结果超过限制');
      return result;
    };
    runtime.setProperty(java, 'toNumChapter', runtime.createNativeFunction((value: unknown) =>
      value === null ? null : sourceChapterNumber(conversionInput(value)), false));
    const byteArray = (value: any): Uint8Array => {
      if (!value || value.class !== 'Array') throw new SourceRuleError('JavaScript 字节数组无效');
      const length = Number(runtime.getProperty(value, 'length'));
      if (!Number.isSafeInteger(length) || length < 0 || length > MAX_ITEMS) throw new SourceRuleError('JavaScript 字节数组超过限制');
      conversionWork += length;
      if (conversionWork > 5_000_000) throw new SourceRuleError('JavaScript 转换超过限制');
      return Uint8Array.from({length}, (_, index) => Number(runtime.getProperty(value, index)) & 255);
    };
    const pseudoBytes = (bytes: Uint8Array) => {
      if (bytes.length > MAX_ITEMS) throw new SourceRuleError('JavaScript 字节数组超过限制');
      const array = runtime.createArray();
      bytes.forEach((value, index) => runtime.setProperty(array, index, value > 127 ? value - 256 : value));
      return array;
    };
    const bytesFromString = (value: unknown, charset?: unknown) => {
      const text = conversionInput(value), name = charset === undefined ? 'UTF-8' : inputText(charset);
      if (!canEncodeSourceCharset(name)) throw new SourceRuleError('JavaScript 字符集不支持');
      try { return Uint8Array.from(javaBytes(text, name)); }
      catch { throw new SourceRuleError('JavaScript 字符集不支持'); }
    };
    const javaString = (bytes: Uint8Array, charset: string) => {
      const normalized = charset.toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g, '');
      return normalized === 'utf8' || normalized === 'unicode11utf8'
        ? decodeJavaUtf8(bytes) : decodeSourceCharset(bytes, charset);
    };
    runtime.setProperty(java, 'strToBytes', runtime.createNativeFunction((value: unknown, charset?: unknown) =>
      pseudoBytes(bytesFromString(value, charset)), false));
    runtime.setProperty(java, 'bytesToStr', runtime.createNativeFunction((value: unknown, charset?: unknown) => {
      const bytes = byteArray(value), name = charset === undefined ? 'UTF-8' : inputText(charset);
      if (!canDecodeSourceCharset(name)) throw new SourceRuleError('JavaScript 字符集不支持');
      return javaString(bytes, name);
    }, false));
    runtime.setProperty(java, 'base64DecodeToByteArray', runtime.createNativeFunction((value: unknown, flags?: unknown) => {
      if (value == null || !String(value).trim()) return null;
      let text = inputText(value).replace(/[\t\n\f\r ]/g, '');
      if ((Number(flags) | 0) & 8) text = text.replace(/-/g, '+').replace(/_/g, '/');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return runtime.throwException(runtime.TYPE_ERROR, 'Base64 数据无效');
      text = text.replace(/=+$/, '');
      if (text.length % 4 === 1) return runtime.throwException(runtime.TYPE_ERROR, 'Base64 数据无效');
      const padded = text.padEnd(Math.ceil(text.length / 4) * 4, '=');
      return pseudoBytes(require('react-native-quick-base64').toByteArray(padded));
    }, false));
    const prepareSymmetric = (transformation: unknown, key: unknown, iv?: unknown) => {
      const asBytes = (value: unknown) => typeof value === 'string' ? Uint8Array.from(utf8Bytes(conversionInput(value))) : byteArray(value);
      const cipher = createSourceSymmetric(inputText(transformation), asBytes(key), iv == null ? undefined : asBytes(iv));
      const object = runtime.nativeToPseudo({});
      const cipherInput = (value: unknown, decrypt: boolean) => {
        if (typeof value !== 'string') return byteArray(value);
        const input = conversionInput(value);
        if (!decrypt) return Uint8Array.from(utf8Bytes(input));
        if (/^[0-9a-f]*$/i.test(input)) {
          const hex = input.length % 2 ? `0${input}` : input;
          return Uint8Array.from(hex.match(/../g) ?? [], pair => parseInt(pair, 16));
        }
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const digits: number[] = [];
        for (const char of input) {
          const code = char.charCodeAt(0);
          if (code >= 123 && code < 128) throw new SourceRuleError('JavaScript Base64 数据无效');
          const number = char === '-' ? 62 : char === '_' ? 63 : alphabet.indexOf(char);
          if (number >= 0) digits.push(number);
        }
        const bytes: number[] = [];
        for (let i = 0; i < digits.length; i += 4) {
          if (i + 1 < digits.length) bytes.push((digits[i] << 2) | (digits[i + 1] >>> 4));
          if (i + 2 < digits.length) bytes.push(((digits[i + 1] & 15) << 4) | (digits[i + 2] >>> 2));
          if (i + 3 < digits.length) bytes.push(((digits[i + 2] & 3) << 6) | digits[i + 3]);
        }
        return Uint8Array.from(bytes);
      };
      const run = (value: unknown, decrypt: boolean) => {
        try { return cipher(cipherInput(value, decrypt), decrypt); }
        catch (error) {
          if (error instanceof SourceRuleError) throw error;
          return runtime.throwException(runtime.TYPE_ERROR, error instanceof Error ? error.message : 'JavaScript 加密失败');
        }
      };
      runtime.setProperty(object, 'encrypt', runtime.createNativeFunction((value: unknown) => pseudoBytes(run(value, false)), false));
      runtime.setProperty(object, 'decrypt', runtime.createNativeFunction((value: unknown) => pseudoBytes(run(value, true)), false));
      runtime.setProperty(object, 'encryptBase64', runtime.createNativeFunction((value: unknown) => require('react-native-quick-base64').fromByteArray(run(value, false)), false));
      runtime.setProperty(object, 'encryptHex', runtime.createNativeFunction((value: unknown) => Array.from(run(value, false) as Uint8Array, byte => byte.toString(16).padStart(2, '0')).join(''), false));
      const decryptString = (value: unknown) => javaString(run(value, true), 'UTF-8');
      runtime.setProperty(object, 'decryptStr', runtime.createNativeFunction(decryptString, false));
      return {object, decryptString};
    };
    runtime.setProperty(java, 'createSymmetricCrypto', runtime.createNativeFunction((transformation: unknown, key: unknown, iv?: unknown) =>
      prepareSymmetric(transformation, key, iv).object, false));
    runtime.setProperty(java, 'aesBase64DecodeToString', runtime.createNativeFunction((value: unknown, key: unknown, transformation: unknown, iv: unknown) =>
      prepareSymmetric(transformation, key, iv).decryptString(value), false));
    runtime.setProperty(java, 't2s', runtime.createNativeFunction((value: unknown) => chineseConversion(value, 1), false));
    runtime.setProperty(java, 's2t', runtime.createNativeFunction((value: unknown) => chineseConversion(value, 2), false));
    const timeNumber = (value: unknown) => {
      if (value !== null && typeof value === 'object') throw new SourceRuleError('JavaScript 时间参数必须是基本类型');
      const number = Number(value);
      return Number.isNaN(number) ? 0 : Math.trunc(number);
    };
    runtime.setProperty(java, 'timeFormat', runtime.createNativeFunction((time: unknown) => formatSourceLocalTime(timeNumber(time)), false));
    runtime.setProperty(java, 'timeFormatUTC', runtime.createNativeFunction((time: unknown, format: unknown, offset: unknown) => {
      const pattern = inputText(format);
      if (pattern.length > 1024) throw new SourceRuleError('JavaScript 时间格式超过限制');
      return formatSourceUtcTime(timeNumber(time), pattern, timeNumber(offset) | 0);
    }, false));
    runtime.setProperty(java, 'hexDecodeToString', runtime.createNativeFunction((value: unknown) => {
      const input = conversionInput(value);
      try { return decodeSourceHex(input); }
      catch (error) { return runtime.throwException(runtime.TYPE_ERROR, error instanceof Error ? error.message : '十六进制数据无效'); }
    }, false));
    runtime.setProperty(java, 'hexEncodeToString', runtime.createNativeFunction((value: unknown) => {
      const input = conversionInput(value);
      try { return encodeSourceHex(input); }
      catch (error) { throw new SourceRuleError(error instanceof Error ? error.message : '十六进制编码超过限制'); }
    }, false));
    const prepareLookup = (rule: unknown, content?: unknown, isUrl?: unknown) => {
      if (++ruleLookups > 16) throw new SourceRuleError('JavaScript 规则查询次数超过限制');
      if (typeof content === 'boolean') throw new SourceRuleError('JavaScript 查询解码选项暂不支持');
      if (isUrl !== undefined && typeof isUrl !== 'boolean') throw new SourceRuleError('JavaScript URL 查询参数无效');
      if (rule === undefined || rule === null) return null;
      const customContent = content == null ? undefined : output(content, 0, lookupBudget);
      return {rule: inputText(rule), content: customContent, isUrl: isUrl === true};
    };
    if (lookup) runtime.setProperty(java, 'getString', runtime.createNativeFunction((rule: unknown, content?: unknown, isUrl?: unknown) => {
      // AnalyzeRule also exposes getString(rule, unescape: Boolean).
      const unescape = typeof content === 'boolean' && isUrl === undefined ? content : true;
      const query = prepareLookup(rule, typeof content === 'boolean' && isUrl === undefined ? undefined : content, isUrl);
      if (!query) return '';
      const result = lookup.text(query.rule, query.isUrl, query.content, unescape);
      if (result.length > MAX_STRING) throw new SourceRuleError('JavaScript 规则查询结果超过限制');
      return result;
    }, false));
    const chargeDom = (roots: AnyNode[]) => {
      const stack = [...roots];
      while (stack.length) {
        if (++domWork > 3_000_000) throw new SourceRuleError('JavaScript 元素操作超过限制');
        const node = stack.pop()!;
        if ('children' in node) stack.push(...node.children);
      }
    };
    const nodeAttribute = (node: AnyNode, name: string) => {
      if (!['tag', 'script', 'style'].includes(node.type)) return '';
      const entry = Object.entries((node as Element).attribs).find(([key]) => key.toLowerCase() === name.toLowerCase());
      return entry?.[1] ?? '';
    };
    const domText = (values: AnyNode[]) => {
      chargeDom(values);
      const result = values.map(node => sourceHtmlText(node)).filter(Boolean).join(' ');
      if (result.length > MAX_STRING) throw new SourceRuleError('JavaScript 元素文本超过限制');
      return result;
    };
    const domHtml = (values: AnyNode[]) => {
      chargeDom(values);
      const result = values.map(node => serializeSourceHtml('children' in node ? node.children : [], false)).join('\n');
      if (result.length > MAX_STRING) throw new SourceRuleError('JavaScript 元素 HTML 超过限制');
      return result;
    };
    const selectNodes = (values: AnyNode[], selector: unknown) => {
      const query = inputText(selector);
      if (query.length > 512) throw new SourceRuleError('JavaScript 元素选择器超过限制');
      chargeDom(values);
      const selected = values.length ? selectSourceElements(query, values) : [];
      if (selected.length > MAX_ITEMS) throw new SourceRuleError('JavaScript 元素数量超过限制');
      return makeList(selected, true);
    };
    const makeList = (values: unknown[], elements = false) => {
      const array = runtime.createArray();
      values.forEach((item, index) => runtime.setProperty(array, index, convert(item)));
      const length = () => Number(runtime.getProperty(array, 'length'));
      runtime.setProperty(array, 'size', runtime.createNativeFunction(() => length(), false), Interpreter.NONENUMERABLE_DESCRIPTOR);
      runtime.setProperty(array, 'isEmpty', runtime.createNativeFunction(() => length() === 0, false), Interpreter.NONENUMERABLE_DESCRIPTOR);
      runtime.setProperty(array, 'get', runtime.createNativeFunction((value: unknown) => {
        const index = Number(value);
        if (!Number.isInteger(index) || index < 0 || index >= length())
          return runtime.throwException(runtime.RANGE_ERROR, '列表索引越界');
        return runtime.getProperty(array, index);
      }, false), Interpreter.NONENUMERABLE_DESCRIPTOR);
      runtime.setProperty(array, 'toArray', runtime.createNativeFunction(() => {
        const copy = runtime.createArray();
        for (let i = 0; i < length(); i++) runtime.setProperty(copy, i, runtime.getProperty(array, i));
        return copy;
      }, false), Interpreter.NONENUMERABLE_DESCRIPTOR);
      if (elements) {
        const current = () => {
          const result: AnyNode[] = [];
          for (let i = 0; i < length(); i++) {
            const item = runtime.getProperty(array, i);
            const node = item && typeof item === 'object' ? nodes.get(item) : undefined;
            if (node) result.push(node);
          }
          return result;
        };
        runtime.setProperty(array, 'select', runtime.createNativeFunction((selector: unknown) => selectNodes(current(), selector), false), Interpreter.NONENUMERABLE_DESCRIPTOR);
        runtime.setProperty(array, 'attr', runtime.createNativeFunction((name: unknown) => {
          const key = inputText(name);
          for (const node of current()) {
            if (['tag', 'script', 'style'].includes(node.type)) {
              const attrs = (node as Element).attribs;
              const match = Object.keys(attrs).find(attr => attr.toLowerCase() === key.toLowerCase());
              if (match !== undefined) return attrs[match];
            }
          }
          return '';
        }, false), Interpreter.NONENUMERABLE_DESCRIPTOR);
        runtime.setProperty(array, 'text', runtime.createNativeFunction(() => domText(current()), false), Interpreter.NONENUMERABLE_DESCRIPTOR);
        runtime.setProperty(array, 'html', runtime.createNativeFunction(() => domHtml(current()), false), Interpreter.NONENUMERABLE_DESCRIPTOR);
      }
      return array;
    };
    if (lookup) runtime.setProperty(java, 'getStringList', runtime.createNativeFunction((rule: unknown, content?: unknown, isUrl?: unknown) => {
      const query = prepareLookup(rule, content, isUrl);
      if (!query) return null;
      const values = lookup.list(query.rule, query.isUrl, query.content);
      if (values === null) return null;
      listResultWork += values.reduce((sum, item) => sum + item.length + 1, 0);
      if (values.length > MAX_ITEMS || listResultWork > MAX_STRING) throw new SourceRuleError('JavaScript 列表查询结果超过限制');
      return makeList(values);
    }, false));
    const chargeLookupResult = (value: unknown) => {
      const stack = new WeakSet<object>();
      const charge = (value: unknown, depth = 0) => {
        if (++lookupBudget.count > MAX_ITEMS || depth > 20) throw new SourceRuleError('JavaScript 规则查询结果超过限制');
        if (typeof value === 'string') {
          lookupBudget.chars += value.length;
          if (lookupBudget.chars > MAX_STRING) throw new SourceRuleError('JavaScript 规则查询结果超过限制');
        } else if (value && typeof value === 'object' && !isNode(value)) {
          if (stack.has(value)) throw new SourceRuleError('JavaScript 规则查询结果超过限制');
          stack.add(value);
          for (const item of Object.values(value)) charge(item, depth + 1);
          stack.delete(value);
        }
      };
      charge(value);
    };
    if (lookup) runtime.setProperty(java, 'getElements', runtime.createNativeFunction((rule: unknown) => {
      const query = prepareLookup(rule);
      if (!query) return makeList([], true);
      const values = lookup.elements(query.rule);
      values.forEach(value => chargeLookupResult(value));
      return makeList(values, values.every(isNode));
    }, false));
    if (lookup) runtime.setProperty(java, 'getElement', runtime.createNativeFunction((rule: unknown) => {
      const query = prepareLookup(rule);
      if (!query) return null;
      const value = lookup.element(query.rule);
      chargeLookupResult(value);
      return Array.isArray(value) ? makeList(value, value.every(isNode)) : convert(value);
    }, false));
    runtime.setProperty(java, 'log', runtime.createNativeFunction((value: unknown) => {
      if (logCount++ < 32) console.log('[书源]', value !== null && typeof value === 'object' ? '[object Object]' : String(value));
      return value;
    }, false));
    if (lookup) runtime.setProperty(java, 'setContent', runtime.createNativeFunction((content: unknown, baseUrl?: unknown) => {
      if (content == null) throw new SourceRuleError('JavaScript 解析内容不能为空');
      output(content, 0, lookupBudget);
      lookup.setContent(() => output(content, 0, lookupBudget), baseUrl == null ? undefined : inputText(baseUrl));
      return java;
    }, false));
    runtime.setProperty(java, 'base64Encode', runtime.createNativeFunction((value: unknown, options?: unknown) => {
      return encodeSourceBase64(inputText(value),options);
    }, false));
    runtime.setProperty(java, 'base64Decode', runtime.createNativeFunction((value: unknown, options?: unknown) => {
      const input = inputText(value);
      const charset = typeof options === 'string' ? inputText(options) : 'UTF-8';
      try {
        return decodeSourceBase64(input,charset);
      } catch (error) {
        return runtime.throwException(runtime.TYPE_ERROR, error instanceof Error ? error.message : 'Base64 数据无效');
      }
    }, false));
    runtime.setProperty(java, 'encodeURI', runtime.createNativeFunction((value: unknown, encoding?: unknown) => {
      const text = inputText(value);
      const charset = encoding === undefined ? 'UTF-8' : inputText(encoding);
      if (!canEncodeSourceCharset(charset)) return '';
      const encoded = encodeJavaFormValue(text, charset);
      if (encoded.length > MAX_STRING) throw new SourceRuleError('JavaScript 编码超过限制');
      return encoded;
    }, false));
    runtime.setProperty(global, 'java', java);
    const sourceUrl = bridge?.sourceUrl ?? (bridge ? bridge.baseUrl : variableContext?.sourceUrl);
    const sourceVariables = bridge?.sourceVariables ?? variableContext?.sourceVariables;
    if (sourceUrl) {
      const source = runtime.nativeToPseudo({bookSourceUrl: sourceUrl, key:sourceUrl});
      runtime.setProperty(source, 'getKey', runtime.createNativeFunction(() => sourceUrl, false));
      if (sourceVariables) {
        runtime.setProperty(source, 'get', runtime.createNativeFunction((key: unknown) => sourceText(sourceVariables.get(inputText(key))), false));
        runtime.setProperty(source, 'put', runtime.createNativeFunction((key: unknown, value: unknown) => sourceVariables.put(inputText(key), inputText(value)), false));
        runtime.setProperty(source, 'getVariable', runtime.createNativeFunction(() => sourceText(sourceVariables.getVariable()), false));
        const setVariable = runtime.createNativeFunction((value: unknown) => { sourceVariables.setVariable(value == null ? null : inputText(value)); }, false);
        runtime.setProperty(source, 'setVariable', setVariable);
        runtime.setProperty(source, 'putVariable', setVariable);
      }
      runtime.setProperty(global, 'source', source);
    }
    if (bridge) {
      runtime.setProperty(global, 'baseUrl', bridge.baseUrl);
      runtime.setProperty(global, 'key', bridge.key);
      runtime.setProperty(global, 'page', bridge.page);
      runtime.setProperty(global, 'searchKey', bridge.key);
      runtime.setProperty(global, 'searchPage', bridge.page);
      const isFatalAsync = (error: unknown) =>
        (error instanceof SourceRuleError && !(error instanceof SourceHttpError)) ||
        (error instanceof Error && error.name === 'AbortError');
      const rejectAsync = (error: unknown) => {
        if (isFatalAsync(error)) throw error;
        const message = error instanceof Error ? error.message : String(error);
        try {
          runtime.throwException(runtime.ERROR, message);
        } catch (raised) {
          // A caught exception unwinds to the script's try block; an uncaught
          // one is rethrown as the original host error for existing callers.
          if (raised !== Interpreter.STEP_ERROR) throw error;
        }
        runtime.paused_ = false;
      };
      const errorText = (error: unknown) => error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      const invokeAsync = <T,>(operation: () => Promise<T>, done: (value: T) => void, recover?: (error: unknown) => T) => {
        pending = Promise.resolve().then(operation).then(done, error => {
          if (!recover || isFatalAsync(error)) return rejectAsync(error);
          done(recover(error));
        });
      };
      runtime.setProperty(java, 'ajax', runtime.createAsyncFunction((url: unknown, callback: (value: string) => void) => {
        if (++requests > 8) throw new SourceRuleError('JavaScript 请求次数超过限制');
        invokeAsync(() => bridge.ajax(String(url)), response => {
          if (response.length > MAX_STRING) throw new SourceRuleError('JavaScript 响应超过限制');
          callback(response);
        }, errorText);
      }));
      if (bridge.connect) runtime.setProperty(java, 'connect', runtime.createAsyncFunction((url: unknown, callback: (value: unknown) => void) => {
        if (++requests > 8) throw new SourceRuleError('JavaScript 请求次数超过限制');
        const address = String(url);
        invokeAsync(() => bridge.connect!(address), response => callback(makeResponse(response)), error => {
          const body = errorText(error);
          return {data:body, body, url:resolveNativeResourceUrl(address, bridge.baseUrl), code:200};
        });
      }));
      if (bridge.post) runtime.setProperty(java, 'post', runtime.createAsyncFunction((url: unknown, body: unknown, headers: unknown, timeout: unknown, callback: (value: unknown) => void) => {
        if (++requests > 8) throw new SourceRuleError('JavaScript 请求次数超过限制');
        const address = inputText(url), content = conversionInput(body);
        let raw: unknown = headers == null ? {} : output(headers, 0, lookupBudget);
        if (typeof raw === 'string') {
          try { raw = JSON.parse(raw); } catch { throw new SourceRuleError('JavaScript 请求头 JSON 无效'); }
        }
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new SourceRuleError('JavaScript 请求头无效');
        const entries = Object.entries(raw);
        if (entries.length > 128) throw new SourceRuleError('JavaScript 请求头超过限制');
        const converted: Record<string, string> = {};
        for (const [name, value] of entries) {
          if (value == null || typeof value === 'object') throw new SourceRuleError('JavaScript 请求头无效');
          converted[inputText(name)] = inputText(value);
        }
        const duration = timeout == null ? undefined : Number(timeout);
        if (duration !== undefined && (!Number.isInteger(duration) || duration < 1 || duration > 30_000))
          throw new SourceRuleError('JavaScript 请求超时无效');
        invokeAsync(() => bridge.post!(address, content, converted, duration), response => callback(makeResponse(response)));
      }));
      if (bridge.toast) {
        runtime.setProperty(java, 'toast', runtime.createNativeFunction((message: unknown) => { bridge.toast!(inputText(message), false); }, false));
        runtime.setProperty(java, 'longToast', runtime.createNativeFunction((message: unknown) => { bridge.toast!(inputText(message), true); }, false));
      }
      if (bridge.browser) runtime.setProperty(java, 'startBrowserAwait', runtime.createAsyncFunction((url: unknown, title: unknown, refetch: unknown, html: unknown, callback: (value: unknown) => void) => {
        const address = inputText(url), label = title == null ? '' : inputText(title);
        const page = html == null ? undefined : inputText(html);
        invokeAsync(() => bridge.browser!(address, label, refetch !== false, page), response => callback(makeResponse(response)));
      }));
      const cookie = runtime.nativeToPseudo({});
      runtime.setProperty(cookie, 'removeCookie', runtime.createNativeFunction((url: unknown) => bridge.removeCookie(String(url)), false));
      if (bridge.getCookie) runtime.setProperty(cookie, 'getCookie', runtime.createNativeFunction((url: unknown) => bridge.getCookie!(inputText(url)), false));
      runtime.setProperty(global, 'cookie', cookie);
    }
  });
  // JS-Interpreter passes its scope sentinel as `this` for an identifier
  // setter. Correct that only for our large-src accessor, retaining normal
  // assignment semantics without changing other script-created accessors.
  const createSetter = interpreter.createSetter_;
  interpreter.createSetter_ = function (func: unknown, left: unknown, value: unknown) {
    const target = func === largeSourceSetter && Array.isArray(left) && left[0] === Interpreter.SCOPE_REFERENCE
      ? this.globalObject : left;
    return createSetter.call(this, func, target, value);
  };
  interpreter.REGEXP_MODE = 0;
  interpreter.POLYFILL_TIMEOUT = 0;
  // Common ES2015 string methods appear in otherwise ES5-compatible sources.
  // Charge repeated searches so large strings cannot monopolize the host.
  let stringSearchWork = 0;
  const stringPrototype = interpreter.STRING.properties.prototype;
  for (const name of ['includes', 'startsWith', 'endsWith'] as const) {
    interpreter.setProperty(stringPrototype, name, interpreter.createNativeFunction(function (this: unknown, search: unknown, position?: unknown) {
      if (interpreter.isa(search, interpreter.REGEXP))
        return interpreter.throwException(interpreter.TYPE_ERROR, '搜索内容不能是正则表达式');
      for (const value of [this, search, position])
        if (value && typeof value === 'object' && !interpreter.isa(value, interpreter.STRING) && !interpreter.isa(value, interpreter.NUMBER) && !interpreter.isa(value, interpreter.BOOLEAN))
          throw new SourceRuleError('JavaScript 字符串搜索对象转换暂不支持');
      const text = String(this), needle = String(search);
      stringSearchWork += text.length + needle.length + 1;
      if (stringSearchWork > 30_000_000) throw new SourceRuleError('JavaScript 字符串搜索超过限制');
      const at = position === undefined ? undefined : Number(position);
      return name === 'includes' ? text.includes(needle, at)
        : name === 'startsWith' ? text.startsWith(needle, at)
          : text.endsWith(needle, at);
    }, false), Interpreter.NONENUMERABLE_DESCRIPTOR);
  }
  // RE2 bounds the matching algorithm. Charge repeated calls as well as input
  // size so a script cannot monopolize the JS thread by rescanning huge pages.
  let regexWork = 0;
  const compiledPatterns = new WeakMap<object, RE2JS>();
  const boundedRegex = (pattern: any, text: string, start = 0) => {
    const expression: RegExp | null = interpreter.isa(pattern, interpreter.REGEXP) ? pattern.data : null;
    const source = expression ? expression.source : pattern === undefined ? '' : String(pattern);
    if (text.length > 250_000 || source.length > 512) throw new SourceRuleError('JavaScript 正则输入超过限制');
    regexWork += Math.max(1, text.length - start);
    if (regexWork > 30_000_000) throw new SourceRuleError('JavaScript 正则执行超过限制');
    let compiled = expression ? compiledPatterns.get(expression) : undefined;
    if (!compiled) {
      const flags = (expression?.ignoreCase ? RE2JS.CASE_INSENSITIVE : 0) | (expression?.multiline ? RE2JS.MULTILINE : 0);
      compiled = RE2JS.compile(source, flags);
      if (compiled.programSize() > 4096 || compiled.groupCount() > 128)
        throw new SourceRuleError('JavaScript 正则复杂度超过限制');
      if (expression) compiledPatterns.set(expression, compiled);
    }
    return { expression, compiled };
  };
  const regexPrototype = interpreter.REGEXP.properties.prototype;
  interpreter.setProperty(regexPrototype, 'exec', interpreter.createNativeFunction(function (this: any, value: unknown) {
    const text = String(value), global = !!this.data?.global;
    const rawIndex = global ? Number(interpreter.getProperty(this, 'lastIndex')) : 0;
    const start = Number.isNaN(rawIndex) || rawIndex < 0 ? 0 : Math.floor(rawIndex);
    const { compiled } = boundedRegex(this, text, start);
    const matcher = compiled.matcher(text);
    if (start > text.length || !matcher.find(start)) {
      if (global) interpreter.setProperty(this, 'lastIndex', 0);
      return null;
    }
    if (global) interpreter.setProperty(this, 'lastIndex', matcher.end());
    const match: any = Array.from({ length: matcher.groupCount() + 1 }, (_, index) => matcher.group(index) ?? undefined);
    match.index = matcher.start();
    match.input = text;
    return interpreter.matchToPseudo_(match);
  }, false));
  interpreter.setProperty(interpreter.STRING.properties.prototype, 'match', interpreter.createNativeFunction(function (this: unknown, pattern: any) {
    const text = String(this), { expression, compiled } = boundedRegex(pattern, text);
    if (!expression?.global) return interpreter.matchToPseudo_(compiled.exec(text));
    const matcher = compiled.matcher(text), matches: string[] = [];
    let resumeAt: number | undefined;
    while (resumeAt === undefined ? matcher.find() : resumeAt <= text.length && matcher.find(resumeAt)) {
      resumeAt = matcher.start() === matcher.end() ? matcher.end() + 1 : undefined;
      if (matches.length >= MAX_ITEMS) throw new SourceRuleError('JavaScript 正则结果超过限制');
      matches.push(matcher.group() ?? '');
    }
    interpreter.setProperty(pattern, 'lastIndex', 0);
    return matches.length ? interpreter.nativeToPseudo(matches) : null;
  }, false));
  interpreter.setProperty(interpreter.STRING.properties.prototype, 'search', interpreter.createNativeFunction(function (this: unknown, pattern: unknown) {
    const text = String(this), { compiled } = boundedRegex(pattern, text);
    const match = compiled.exec(text) as RegExpExecArray | null;
    return match ? match.index : -1;
  }, false));
  interpreter.setProperty(interpreter.STRING.properties.prototype, 'split', interpreter.createNativeFunction(function (this: unknown, separator: any, limitValue?: unknown) {
    const text = String(this), limit = limitValue === undefined ? 0xffffffff : Number(limitValue) >>> 0;
    if (!limit) return interpreter.nativeToPseudo([]);
    if (text.length > MAX_STRING) throw new SourceRuleError('JavaScript 字符串超过限制');
    if (!interpreter.isa(separator, interpreter.REGEXP)) {
      const values = text.split(separator, Math.min(limit, MAX_ITEMS + 1));
      if (values.length > MAX_ITEMS) throw new SourceRuleError('JavaScript 分割结果超过限制');
      return interpreter.nativeToPseudo(values);
    }
    const {compiled} = boundedRegex(separator, text), matcher = compiled.matcher(text);
    const values: Array<string | undefined> = [];
    let chars = 0;
    const add = (value: string | undefined) => {
      if (values.length >= MAX_ITEMS) throw new SourceRuleError('JavaScript 分割结果超过限制');
      chars += value?.length ?? 0;
      if (chars > MAX_STRING) throw new SourceRuleError('JavaScript 分割结果超过限制');
      values.push(value);
      return values.length === limit;
    };
    if (!text.length) {
      if (!matcher.find(0)) add('');
      return interpreter.nativeToPseudo(values);
    }
    let previous = 0, cursor = 0;
    while (cursor < text.length && matcher.find(cursor)) {
      const start = matcher.start(), end = matcher.end();
      if (start === text.length && end === start) break;
      if (end === previous) {cursor = end + 1; continue;}
      if (add(text.slice(previous, start))) return interpreter.nativeToPseudo(values);
      for (let index = 1; index <= matcher.groupCount(); index++)
        if (add(matcher.group(index) ?? undefined)) return interpreter.nativeToPseudo(values);
      previous = end;
      cursor = end;
    }
    add(text.slice(previous));
    return interpreter.nativeToPseudo(values);
  }, false));
  const originalSetProperty = interpreter.setProperty;
  interpreter.setProperty = function (object: any, key: unknown, value: unknown, descriptor?: unknown) {
    const actual = descriptor && typeof descriptor === 'object' && 'value' in descriptor ? descriptor.value : value;
    if (typeof actual === 'string' && actual.length > MAX_STRING)
      throw new SourceRuleError('JavaScript 字符串超过限制');
    if (object?.class === 'Array' && ((key === 'length' && (typeof actual === 'number' || typeof actual === 'string') && Number(actual) > MAX_ITEMS) || (/^(?:0|[1-9]\d*)$/.test(String(key)) && Number(key) >= MAX_ITEMS)))
      throw new SourceRuleError('JavaScript 数组超过限制');
    return originalSetProperty.call(this, object, key, value, descriptor);
  };
  // Dynamic parsing and native replacement can allocate without another
  // interpreter step. Keep these operations out of the untrusted rule scope.
  interpreter.setProperty(interpreter.globalObject, 'eval', undefined);
  interpreter.setProperty(interpreter.globalObject, 'Function', undefined);
  interpreter.setProperty(interpreter.FUNCTION.properties.prototype, 'constructor', undefined);
  interpreter.setProperty(interpreter.globalObject, 'RegExp', undefined);
  interpreter.setProperty(interpreter.REGEXP.properties.prototype, 'constructor', undefined);
  interpreter.setProperty(interpreter.STRING.properties.prototype, 'replace', interpreter.createNativeFunction(function (this: unknown, search: any, replacement: unknown) {
    if (replacement !== null && typeof replacement === 'object')
      throw new SourceRuleError('JavaScript 对象或函数替换暂不支持');
    const replacementText = String(replacement), text = String(this);
    if (!interpreter.isa(search, interpreter.REGEXP)) {
      const literal = String(search);
      const expansion = /\$(?:&|`|')/.test(replacementText) ? replacementText.length * (text.length + 1) : replacementText.length;
      if (text.length + expansion > MAX_STRING) throw new SourceRuleError('JavaScript 字符串超过限制');
      return text.replace(literal, replacementText);
    }
    if (replacementText.length > MAX_SCRIPT) throw new SourceRuleError('JavaScript 替换文本超过限制');
    const { expression, compiled } = boundedRegex(search, text);
    const matcher = compiled.matcher(text), pieces: string[] = [];
    let length = 0, previous = 0, count = 0, work = 0, resumeAt: number | undefined;
    const append = (part: string) => {
      length += part.length;
      if (length > MAX_STRING) throw new SourceRuleError('JavaScript 替换结果超过限制');
      pieces.push(part);
    };
    while (resumeAt === undefined ? matcher.find() : resumeAt <= text.length && matcher.find(resumeAt)) {
      resumeAt = matcher.start() === matcher.end() ? matcher.end() + 1 : undefined;
      if (++count > MAX_ITEMS || (work += replacementText.length) > 4_000_000)
        throw new SourceRuleError('JavaScript 替换次数超过限制');
      const start = matcher.start(), end = matcher.end();
      append(text.slice(previous, start));
      let literal = '';
      for (let i = 0; i < replacementText.length; i += 1) {
        if (replacementText[i] !== '$' || i + 1 >= replacementText.length) { literal += replacementText[i]; continue; }
        const next = replacementText[i + 1];
        let expanded: string | undefined;
        if (next === '$') expanded = '$';
        else if (next === '&') expanded = matcher.group() ?? '';
        else if (next === '`') expanded = text.slice(0, start);
        else if (next === "'") expanded = text.slice(end);
        else if (/[0-9]/.test(next)) {
          const pair = replacementText.slice(i + 1, i + 3), pairIndex = Number(pair), single = Number(next);
          const digits = pair.length === 2 && /^\d{2}$/.test(pair) && pairIndex > 0 && pairIndex <= matcher.groupCount() ? 2 : single > 0 && single <= matcher.groupCount() ? 1 : 0;
          if (digits) { expanded = matcher.group(Number(replacementText.slice(i + 1, i + 1 + digits))) ?? ''; i += digits - 1; }
        }
        if (expanded === undefined) { literal += '$'; continue; }
        append(literal); literal = ''; append(expanded); i += 1;
      }
      append(literal);
      previous = end;
      if (!expression?.global) break;
    }
    append(text.slice(previous));
    if (expression?.global) interpreter.setProperty(search, 'lastIndex', 0);
    return pieces.join('');
  }, false));
  const dateToJSON = interpreter.getProperty(interpreter.DATE.properties.prototype, 'toJSON');
  const json = interpreter.getProperty(interpreter.globalObject, 'JSON');
  interpreter.setProperty(json, 'parse', interpreter.createNativeFunction((value: unknown, reviver: unknown) => parseBoundedJson(interpreter, value, reviver), false));
  interpreter.setProperty(json, 'stringify', interpreter.createNativeFunction((value: unknown, replacer: unknown, space: unknown) => stringifyBoundedJson(interpreter, value, replacer, space, dateToJSON), false));
  let steps = 0, deadline = Date.now() + MAX_MS;
  const step = () => {
    const running = interpreter.step();
    if (++steps > MAX_STEPS || (steps % 1024 === 0 && Date.now() > deadline))
      throw new SourceRuleError('JavaScript 执行超过限制');
    if (typeof interpreter.value === 'string' && interpreter.value.length > MAX_STRING)
      throw new SourceRuleError('JavaScript 字符串超过限制');
    return running;
  };
  const output = (value: any, depth = 0, budget = { count: 0, chars: 0 }): any => {
    if (++budget.count > MAX_ITEMS || depth > 20) throw new SourceRuleError('JavaScript 输出超过限制');
    if (typeof value === 'string') {
      budget.chars += value.length;
      if (value.length > MAX_STRING || budget.chars > MAX_STRING) throw new SourceRuleError('JavaScript 输出超过限制');
    }
    if (value === null || value === undefined || typeof value !== 'object') return value;
    const node = nodes.get(value);
    if (node) return node;
    const response = responses.get(value);
    if (response) return response;
    if (value.class === 'Array') {
      const length = Number(interpreter.getProperty(value, 'length'));
      if (length > MAX_ITEMS) throw new SourceRuleError('JavaScript 输出超过限制');
      return Array.from({ length }, (_, index) => output(interpreter.getProperty(value, index), depth + 1, budget));
    }
    const object: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(value.properties ?? {}))
      object[key] = output(interpreter.getProperty(value, key), depth + 1, budget);
    return object;
  };
  return {
    step,
    result: () => output(interpreter.value),
    isPaused: () => interpreter.getStatus() === Interpreter.Status.ASYNC,
    wait: async () => {
      if (!pending) throw new SourceRuleError('JavaScript 异步调用不可用');
      await pending;
      pending = undefined;
      deadline = Date.now() + MAX_MS;
    },
  };
}

function scriptError(error: unknown): never {
  if (error instanceof SourceRuleError || (error instanceof Error && error.name === 'AbortError')) throw error;
  throw new SourceRuleError(`JavaScript 规则执行失败: ${error instanceof Error ? error.message : String(error)}`);
}

export function runSourceJavaScript(script: string, input: unknown, globals?: RuleGlobals, lookup?: RuleLookup, variables?: Map<string, string>, variableContext?: VariableContext): unknown {
  try {
    const runner = prepare(script, input, undefined, globals, lookup, variables, variableContext);
    while (runner.step()) {
      if (runner.isPaused()) throw new SourceRuleError('JavaScript 异步调用不可用');
    }
    return runner.result();
  } catch (error) { return scriptError(error); }
}

export async function runSourceJavaScriptAsync(script: string, bridge: SourceJavaScriptBridge, input: unknown = ''): Promise<unknown> {
  try {
    const runner = prepare(script, input, bridge);
    let steps = 0;
    while (runner.step()) {
      if (runner.isPaused()) await runner.wait();
      else if (++steps % 4096 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    return runner.result();
  } catch (error) { return scriptError(error); }
}
