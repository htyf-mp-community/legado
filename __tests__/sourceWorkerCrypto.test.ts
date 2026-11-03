jest.mock('react-native-quick-crypto',()=>require('node:crypto'));
jest.mock('react-native-quick-base64',()=>({fromByteArray:(bytes:Uint8Array)=>Buffer.from(bytes).toString('base64'),toByteArray:(text:string)=>new Uint8Array(Buffer.from(text,'base64'))}));
import {runInNewContext} from 'node:vm';
import {createSourceWorkerBridge,prepareSourceWorkerScript} from '../src/core/sourceWorkerBridge';

const bridge=()=>createSourceWorkerBridge({baseUrl:'https://example.org',key:null,page:1,ajax:async()=>'',removeCookie:()=>{}});
const signal=new AbortController().signal;

test('exposes the symmetric crypto object and byte methods to scripts',()=>{
  const calls:unknown[]=[];
  const call=(action:string,args:unknown[])=>{calls.push([action,Array.from(args)]);if(action==='java.crypto.create')return '1';if(action==='java.crypto.run')return '正文';};
  const script='var c=java.createSymmetricCrypto("AES/CBC/PKCS5Padding","0123456789abcdef","abcdef9876543210");c.decryptStr(result)';
  expect(runInNewContext(prepareSourceWorkerScript(script),{__legado:{context:{result:'ciphertext'},call}})).toBe('正文');
  expect(calls).toEqual([['java.crypto.create',['AES/CBC/PKCS5Padding','0123456789abcdef','abcdef9876543210']],['java.crypto.run',['1','decryptStr','ciphertext']]]);
});

test('preserves null Base64 inputs and does not turn scalar cipher inputs into strings',()=>{
  const calls:unknown[]=[];const call=(action:string,args:unknown[])=>{calls.push([action,Array.from(args)]);if(action==='java.crypto.create')return '1';return null;};
  runInNewContext(prepareSourceWorkerScript('java.base64DecodeToByteArray(undefined);java.createSymmetricCrypto("AES/ECB/PKCS5Padding","0123456789abcdef").encrypt(42)'),{__legado:{context:{},call}});
  expect(calls[0]).toEqual(['java.base64DecodeToByteArray',[null]]);
  expect(calls[2]).toEqual(['java.crypto.run',['1','encrypt',{}]]);
});

test('matches AES and DES native vectors with task-local cipher handles',async()=>{
  const a=bridge(),b=bridge();
  const handle=await a.invoke('java.crypto.create',['AES/CBC/PKCS5Padding','0123456789abcdef','abcdef9876543210'],signal);
  const encrypted=await a.invoke('java.crypto.run',[handle,'encryptBase64','西游记 Hello!'],signal);
  expect(encrypted).toBe('rBxCEOLiCHJixsNEParqjoneatg7duqjgePjyWOSJQ0=');
  await expect(a.invoke('java.crypto.run',[handle,'decryptStr',encrypted],signal)).resolves.toBe('西游记 Hello!');
  await expect(b.invoke('java.crypto.run',[handle,'decryptStr',encrypted],signal)).rejects.toThrow(/引用/);
  const des=await a.invoke('java.crypto.create',['DES/CBC/PKCS5Padding','KW8Dvm2N','1ae2c94b'],signal);
  await expect(a.invoke('java.crypto.run',[des,'encryptBase64','西游记 Hello!'],signal)).resolves.toBe('3yhJENxs1je7Da3+j3+DA4ZHbX4rtOBI');
  await expect(a.invoke('java.aesBase64DecodeToString',['VVYptzB1ev/mjJFL7HWv3w==','Pxga!h*e4@T8xfOm','AES/CBC/PKCS5Padding','E&z!EHGLd$fli*8R'],signal)).resolves.toBe('西游记正文');
});

test('handles signed byte arrays, legacy encodings and invalid cryptographic input',async()=>{
  const a=bridge();
  expect(await a.invoke('java.base64DecodeToByteArray',['/4A='],signal)).toEqual([-1,-128]);
  expect(await a.invoke('java.base64DecodeToByteArray',[''],signal)).toBeNull();
  const bytes=await a.invoke('java.strToBytes',['éÿ','ISO-8859-1'],signal);
  expect(bytes).toEqual([-23,-1]);
  await expect(a.invoke('java.bytesToStr',[bytes,'ISO-8859-1'],signal)).resolves.toBe('éÿ');
  await expect(a.invoke('java.crypto.create',['AES/CBC/PKCS5Padding','short','1234567890123456'],signal)).rejects.toThrow(/密钥/);
  await expect(a.invoke('java.bytesToStr',[new Array(8001).fill(0)],signal)).rejects.toThrow(/限制/);
});
