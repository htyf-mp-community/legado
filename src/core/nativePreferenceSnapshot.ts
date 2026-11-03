import type {ScreenTimeoutSeconds} from './readerKeepAwake';

/** Parse the ordinary Android SharedPreferences XML snapshot without DTDs. */
export function parseNativeKeepLightSnapshot(xml: string): {value?: ScreenTimeoutSeconds; warning?: string} {
  if (xml.length > 2_000_000) throw new Error('配置文件过大');
  let pos = xml.charCodeAt(0) === 0xfeff ? 1 : 0;
  let rootSeen = false, rootClosed = false, otherCount = 0, nodeCount = 0;
  let keep: {type: string; text: string} | undefined;
  type Node = {name: string; key?: string; text: string};
  const stack: Node[] = [];
  const fail = (): never => {throw new Error('配置 XML 格式无效或不支持');};
  const decode = (value: string): string => value.replace(/&([^;\s<&]+);|&/g, (match, entity: string | undefined) => {
    if (!entity) return fail();
    const named: Record<string,string> = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
    if (Object.prototype.hasOwnProperty.call(named, entity)) return named[entity];
    const m = /^#(\d+)$/.exec(entity) ?? /^#x([\da-f]+)$/i.exec(entity);
    if (!m) return fail();
    const n = parseInt(m[1], entity[1].toLowerCase() === 'x' ? 16 : 10);
    if (!(n === 9 || n === 10 || n === 13 || (n >= 32 && n <= 0xd7ff) || (n >= 0xe000 && n <= 0xfffd) || (n >= 0x10000 && n <= 0x10ffff))) return fail();
    return String.fromCodePoint(n);
  });
  const append = (text: string) => {
    if (!stack.length) {if (!/^[ \t\r\n]*$/.test(text)) fail(); return;}
    const node = stack[stack.length - 1];
    if (node.name === 'string') node.text += text;
    else if (!/^[ \t\r\n]*$/.test(text)) fail();
  };
  const close = (name: string) => {
    const node = stack.pop();
    if (!node || node.name !== name) return fail();
    if (!stack.length) {if (name !== 'map') return fail(); rootClosed = true;}
    else if (stack.length === 1) {
      if (node.key === 'keep_light') keep = {type: node.name,text: node.text};
      else otherCount++;
    }
  };
  while (pos < xml.length) {
    if (xml[pos] !== '<') {
      const end = xml.indexOf('<', pos);
      const text = xml.slice(pos, end < 0 ? xml.length : end);
      if (text.includes(']]>')) return fail();
      append(decode(text)); pos = end < 0 ? xml.length : end; continue;
    }
    if (xml.startsWith('<!--', pos)) {
      const end = xml.indexOf('-->', pos + 4);
      if (end < 0 || xml.slice(pos + 4, end).includes('--')) return fail();
      pos = end + 3; continue;
    }
    if (xml.startsWith('<?', pos)) {
      const end = xml.indexOf('?>', pos + 2);
      if (end < 0) return fail();
      pos = end + 2; continue;
    }
    if (xml.startsWith('<![CDATA[', pos)) {
      const end = xml.indexOf(']]>', pos + 9);
      if (end < 0 || stack[stack.length - 1]?.name !== 'string') return fail();
      append(xml.slice(pos + 9, end)); pos = end + 3; continue;
    }
    if (xml.startsWith('<!', pos)) return fail(); // Never resolve a DTD or external entity.
    let end = pos + 1, quote = '';
    for (; end < xml.length; end++) {
      if (end - pos > 65_536) return fail();
      const c = xml[end];
      if (quote) {if (c === quote) quote = '';}
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
      else if (c === '<') return fail();
    }
    if (end >= xml.length || quote) return fail();
    let tag = xml.slice(pos + 1, end); pos = end + 1;
    if (tag.startsWith('/')) {
      const match = /^\/([\w:.-]+)\s*$/.exec(tag);
      if (!match) return fail();
      close(match[1]); continue;
    }
    const selfClosing = /\/\s*$/.test(tag);
    if (selfClosing) tag = tag.replace(/\/\s*$/, '');
    const match = /^([A-Za-z_][\w:.-]*)/.exec(tag);
    if (!match) return fail();
    const name = match[1], attrs: Record<string,string> = Object.create(null);
    let cursor = match[0].length, attrCount = 0;
    while (cursor < tag.length) {
      const tail = tag.slice(cursor), whitespace = /^\s+/.exec(tail);
      if (!whitespace) return fail();
      cursor += whitespace[0].length;
      if (cursor === tag.length) break;
      if (++attrCount > 64) return fail();
      const attr = /^([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(tag.slice(cursor));
      if (!attr || Object.prototype.hasOwnProperty.call(attrs, attr[1])) return fail();
      const value = attr[2] ?? attr[3];
      if (value.includes('<')) return fail();
      attrs[attr[1]] = decode(value); cursor += attr[0].length;
    }
    const parent = stack[stack.length - 1];
    if (!parent) {
      if (rootSeen || rootClosed || name !== 'map') return fail();
      rootSeen = true;
    } else if (parent.name === 'map') {
      if (!['string','int','long','float','boolean','set'].includes(name) || attrs.name === undefined) return fail();
    } else if (parent.name !== 'set' || name !== 'string') return fail();
    if (name === 'int' || name === 'long') {
      if (!/^[+-]?\d+$/.test(attrs.value ?? '') || !Number.isFinite(Number(attrs.value))) return fail();
    } else if (name === 'float') {
      if (!attrs.value || (!Number.isFinite(Number(attrs.value)) && !/^[+-]?(?:Infinity|NaN)$/.test(attrs.value))) return fail();
    } else if (name === 'boolean' && attrs.value !== 'true' && attrs.value !== 'false') return fail();
    if (stack.length >= 3) return fail();
    if (++nodeCount > 25_000) return fail();
    stack.push({name,key:attrs.name,text:''});
    if (selfClosing) close(name);
  }
  if (!rootSeen || !rootClosed || stack.length) return fail();
  let value: ScreenTimeoutSeconds | undefined;
  let warning = otherCount ? 'config.xml 中的其他设置尚未恢复' : undefined;
  if (keep) {
    if (keep.type === 'string' && /^[+-]?\d+$/.test(keep.text)) {
      const n = Number(keep.text);
      if (n === -1 || n === 0 || n === 60 || n === 300 || n === 600) value = n;
    }
    if (value === undefined) warning = 'config.xml 中的屏幕超时值暂不支持；其他设置尚未恢复';
  }
  return {value,warning};
}
