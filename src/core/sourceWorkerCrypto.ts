import {SourceRuleError} from './errors';
import {canDecodeSourceCharset,decodeJavaUtf8,decodeSourceCharset} from './sourceCharsetDecode';
import {canEncodeSourceCharset} from './sourceCharsetAvailability';
import {javaBytes,utf8Bytes} from './sourceUrlEncoding';
import {createSourceSymmetric} from './sourceSymmetricCrypto';
import {convertChinese} from './chineseConversion';
import {sourceChapterNumber} from './sourceChapterNumber';
import {decodeSourceHex,encodeSourceHex} from './sourceJavaScriptHex';

/** Per-task crypto and conversion methods sharing the interpreter's work budget. */
export function createSourceWorkerCrypto() {
  const ciphers=new Map<string,ReturnType<typeof createSourceSymmetric>>();
  let work=0,encodingWork=0,next=0;
  const text=(value:unknown,conversion=false)=>{
    if(value!==null&&typeof value==='object')throw new SourceRuleError('JavaScript 转换参数必须是基本类型');
    const result=String(value);
    if(conversion){work+=result.length+1;if(result.length>1_000_000||work>5_000_000)throw new SourceRuleError('JavaScript 转换超过限制');}
    else {encodingWork+=result.length+1;if(result.length>64_000||encodingWork>1_000_000)throw new SourceRuleError('JavaScript 编码超过限制');}
    return result;
  };
  const bytes=(value:unknown):Uint8Array=>{
    if(!Array.isArray(value))throw new SourceRuleError('JavaScript 字节数组无效');
    if(value.length>8000)throw new SourceRuleError('JavaScript 字节数组超过限制');
    work+=value.length;if(work>5_000_000)throw new SourceRuleError('JavaScript 转换超过限制');
    return Uint8Array.from(value,item=>Number(item)&255);
  };
  const signed=(value:Uint8Array)=>{
    if(value.length>8000)throw new SourceRuleError('JavaScript 字节数组超过限制');
    return Array.from(value,item=>item>127?item-256:item);
  };
  const utf8=(value:unknown)=>Uint8Array.from(utf8Bytes(text(value,true)));
  const material=(value:unknown)=>typeof value==='string'?utf8(value):bytes(value);
  const decode=(value:Uint8Array,charset:string)=>{
    const name=charset.toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g,'');
    return name==='utf8'||name==='unicode11utf8'?decodeJavaUtf8(value):decodeSourceCharset(value,charset);
  };
  const cipherInput=(value:unknown,decrypt:boolean)=>{
    if(typeof value!=='string')return bytes(value);
    const input=text(value,true);
    if(!decrypt)return Uint8Array.from(utf8Bytes(input));
    if(/^[0-9a-f]*$/i.test(input)){
      const hex=input.length%2?`0${input}`:input;
      return Uint8Array.from(hex.match(/../g)??[],pair=>parseInt(pair,16));
    }
    const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',digits:number[]=[];
    for(const char of input){const code=char.charCodeAt(0);if(code>=123&&code<128)throw new SourceRuleError('JavaScript Base64 数据无效');const number=char==='-'?62:char==='_'?63:alphabet.indexOf(char);if(number>=0)digits.push(number);}
    const output:number[]=[];
    for(let i=0;i<digits.length;i+=4){if(i+1<digits.length)output.push((digits[i]<<2)|(digits[i+1]>>>4));if(i+2<digits.length)output.push(((digits[i+1]&15)<<4)|(digits[i+2]>>>2));if(i+3<digits.length)output.push(((digits[i+2]&3)<<6)|digits[i+3]);}
    return Uint8Array.from(output);
  };
  const create=(transformation:unknown,key:unknown,iv:unknown)=>createSourceSymmetric(text(transformation),material(key),iv==null?undefined:material(iv));
  const run=(cipher:ReturnType<typeof createSourceSymmetric>,method:unknown,value:unknown)=>{
    if(!['encrypt','decrypt','encryptBase64','encryptHex','decryptStr'].includes(String(method)))throw new SourceRuleError('JavaScript 加密方法不支持');
    const decrypt=method==='decrypt'||method==='decryptStr',result=cipher(cipherInput(value,decrypt),decrypt);
    if(method==='encrypt'||method==='decrypt')return signed(result);
    if(method==='decryptStr')return decode(result,'UTF-8');
    if(method==='encryptHex')return Array.from(result,item=>item.toString(16).padStart(2,'0')).join('');
    return require('react-native-quick-base64').fromByteArray(result);
  };
  return (action:string,args:unknown[])=>{
    switch(action){
      case 'java.crypto.create': {
        if(ciphers.size>=256)throw new SourceRuleError('JavaScript 加密对象数量超过限制');
        const cipher=create(args[0],args[1],args[2]),handle=String(++next);ciphers.set(handle,cipher);return handle;
      }
      case 'java.crypto.run': {
        const cipher=typeof args[0]==='string'?ciphers.get(args[0]):undefined;
        if(!cipher)throw new SourceRuleError('JavaScript 加密对象引用无效');
        return run(cipher,args[1],args[2]);
      }
      case 'java.aesBase64DecodeToString':return run(create(args[2],args[1],args[3]),'decryptStr',args[0]);
      case 'java.strToBytes': {
        const input=text(args[0],true),charset=args.length<2?'UTF-8':text(args[1]);
        if(!canEncodeSourceCharset(charset))throw new SourceRuleError('JavaScript 字符集不支持');
        return signed(Uint8Array.from(javaBytes(input,charset)));
      }
      case 'java.bytesToStr': {
        const input=bytes(args[0]),charset=args.length<2?'UTF-8':text(args[1]);
        if(!canDecodeSourceCharset(charset))throw new SourceRuleError('JavaScript 字符集不支持');
        return decode(input,charset);
      }
      case 'java.base64DecodeToByteArray': {
        if(args[0]==null||!String(args[0]).trim())return null;
        let input=text(args[0]).replace(/[\t\n\f\r ]/g,'');
        if((Number(args[1])|0)&8)input=input.replace(/-/g,'+').replace(/_/g,'/');
        if(!/^[A-Za-z0-9+/]*={0,2}$/.test(input))throw new TypeError('Base64 数据无效');
        input=input.replace(/=+$/,'');if(input.length%4===1)throw new TypeError('Base64 数据无效');
        return signed(require('react-native-quick-base64').toByteArray(input.padEnd(Math.ceil(input.length/4)*4,'=')));
      }
      case 'java.t2s':
      case 'java.s2t': {
        const result=convertChinese(text(args[0],true),action==='java.t2s'?1:2);
        if(result.length>1_000_000)throw new SourceRuleError('JavaScript 中文转换结果超过限制');
        return result;
      }
      case 'java.toNumChapter':return args[0]===null?null:sourceChapterNumber(text(args[0],true));
      case 'java.hexDecodeToString':return decodeSourceHex(text(args[0],true));
      case 'java.hexEncodeToString': {
        const input=text(args[0],true);
        try{return encodeSourceHex(input);}catch(error){throw new SourceRuleError(error instanceof Error?error.message:'JavaScript 十六进制编码超过限制');}
      }
      default:throw new SourceRuleError('JavaScript 桥接接口不支持');
    }
  };
}
