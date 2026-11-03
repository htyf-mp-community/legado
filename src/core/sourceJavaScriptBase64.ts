import {canDecodeSourceCharset, decodeSourceCharset} from './sourceCharsetDecode';
import {utf8Bytes} from './sourceUrlEncoding';

/** Base64 operations shared by the existing and experimental script runtimes. */
export function encodeSourceBase64(input:string, options?:unknown):string {
  let result:string=require('react-native-quick-base64').fromByteArray(new Uint8Array(utf8Bytes(input)));
  const flags=options===undefined?2:Number(options)|0;
  if(flags&8)result=result.replace(/\+/g,'-').replace(/\//g,'_');
  if(flags&1)result=result.replace(/=+$/,'');
  if(!(flags&2)&&result)result=(result.match(/.{1,76}/g)??[]).join(flags&4?'\r\n':'\n')+(flags&4?'\r\n':'\n');
  return result;
}

export function decodeSourceBase64(input:string, charset='UTF-8'):string {
  const normalized=input.replace(/[\t\n\f\r ]/g,'').replace(/-/g,'+').replace(/_/g,'/');
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized))throw new TypeError('Base64 数据无效');
  const unpadded=normalized.replace(/=+$/,'');
  if(unpadded.length%4===1)throw new TypeError('Base64 数据无效');
  if(!canDecodeSourceCharset(charset))throw new TypeError('不支持的字符集');
  const padded=unpadded.padEnd(Math.ceil(unpadded.length/4)*4,'=');
  const bytes:Uint8Array=require('react-native-quick-base64').toByteArray(padded);
  return decodeSourceCharset(bytes,charset);
}
