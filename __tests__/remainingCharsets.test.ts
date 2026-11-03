jest.mock('react-native-quick-base64',()=>({
  toByteArray:(value:string)=>new Uint8Array(Buffer.from(value,'base64')),
  fromByteArray:(value:Uint8Array)=>Buffer.from(value).toString('base64'),
}));
import iconv from 'iconv-lite';
import {decodeTxtBase64} from '../src/core/txtEncoding';
import {decodeSourceCharset} from '../src/core/sourceCharsetDecode';
import {encodeJavaFormValue, encodeSourceParams} from '../src/core/sourceUrlEncoding';
import knownNames from '../src/data/sourceCharsetAvailability.json';

const bytes = [[],[0],[0xff],[0xe4],[0xc2,0x41],[0xef,0xbb,0xbf,0xef,0xbb,0xbf],[0xff,0xfe,0x41,0x00],[0,0x41,0,0x42],[0x2b,0x2d],[0x26,0x2d],Array.from(Buffer.from('+Ti1lRR4- &Ti1lRR4-','ascii'))];
const values = ['中文','你好+世界','A&中B','😃','\ud800','A中😃+_-/=', 'AA!bb'];
const txtNames = ['base64','binary','cesu8','hex','unicode11utf7','utf16','utf7','utf7imap'];
const responseNames = ['base64','binary','cesu8','hex','unicode11utf7','utf7','utf7imap'];
const urlNames = ['base64','binary','cesu8','hex','unicode11utf7','unicode11utf8','utf7','utf7imap'];

// Reproduce the previous Java-form adapter using the old codec only as an oracle.
function previousFormEncoding(value: string, name: string) {
  let output = '', group = '';
  const flush = () => {
    if (!group) return;
    let normalized = '';
    for (let index=0;index<group.length;index++) {
      const code=group.charCodeAt(index), next=group.charCodeAt(index+1);
      if (code>=0xd800 && code<=0xdbff && next>=0xdc00 && next<=0xdfff) {
        const pair=group.slice(index,index+2);index++;
        const encoded=iconv.encode(pair,name);
        normalized+=encoded.length===2 && encoded.every(byte=>byte===0x3f) ? '?' : pair;
      } else normalized+=(code>=0xd800 && code<=0xdfff) ? '?' : group[index];
    }
    output += [...iconv.encode(normalized,name)].map(byte=>`%${byte.toString(16).toUpperCase().padStart(2,'0')}`).join('');
    group='';
  };
  for (const char of value) {
    if (/^[A-Za-z0-9*._-]$/.test(char) || char === ' ') {flush();output+=char === ' ' ? '+' : char;}
    else group+=char;
  }
  flush();return output;
}

test('all remaining charset paths match their existing results without invoking iconv', () => {
  const expectedTxt = txtNames.map(name=>bytes.map(value=>iconv.decode(Uint8Array.from(value),name).replace(/^\uFEFF/,'')));
  const expectedResponse = responseNames.map(name=>bytes.map(value=>iconv.decode(Uint8Array.from(value),name,{stripBOM:false})));
  const expectedUrl = urlNames.map(name=>values.map(value=>previousFormEncoding(value,name)));
  const encode = jest.spyOn(iconv,'encode').mockImplementation(()=>{throw new Error('unexpected iconv encode');});
  const decode = jest.spyOn(iconv,'decode').mockImplementation(()=>{throw new Error('unexpected iconv decode');});
  try {
    expect(txtNames.map(name=>bytes.map(value=>decodeTxtBase64(Buffer.from(value).toString('base64'),name)))).toEqual(expectedTxt);
    expect(responseNames.map(name=>bytes.map(value=>decodeSourceCharset(Uint8Array.from(value),name)))).toEqual(expectedResponse);
    expect(urlNames.map(name=>values.map(value=>encodeJavaFormValue(value,name)))).toEqual(expectedUrl);
  } finally {encode.mockRestore();decode.mockRestore();}
});

test('all previously supported charset names work without a runtime codec dependency', () => {
  const encode=jest.spyOn(iconv,'encode').mockImplementation(()=>{throw new Error('unexpected iconv encode');});
  const decode=jest.spyOn(iconv,'decode').mockImplementation(()=>{throw new Error('unexpected iconv decode');});
  try {
    for (const name of knownNames) {
      expect(()=>decodeTxtBase64('QQ==',name)).not.toThrow();
      expect(()=>decodeSourceCharset(Uint8Array.of(65),name)).not.toThrow();
      expect(()=>encodeJavaFormValue('é',name)).not.toThrow();
    }
  } finally {encode.mockRestore();decode.mockRestore();}
});

test('previously supported charset aliases with year suffixes remain usable', () => {
  for (const original of knownNames) {
    const name=`${original.toUpperCase()}:1998`;
    try {decodeTxtBase64('QQ==',name);decodeSourceCharset(Uint8Array.of(65),name);encodeJavaFormValue('é',name);}
    catch (error) {throw new Error(`${name}: ${String(error)}`);}
  }
});

test.each(['utf8:1998','unicode11utf8:1998','utf16:1998','utf16be:1998','utf16le:1998','ucs2:1998'])(
  'preserves prior URL encoding for the %s alias', name => {
    for (const value of ['中文','😃','\ud800','A中😃+_-/='])
      expect(encodeJavaFormValue(value,name)).toBe(previousFormEncoding(value,name));
  },
);

test('preserves repeated BOMs for the legacy UTF-16 year-suffixed query alias', () => {
  const escaped=(value:string)=>[...iconv.encode(value,'utf16:1998')].map(byte=>`%${byte.toString(16).toUpperCase().padStart(2,'0')}`).join('');
  expect(encodeSourceParams('q=中&x=文','utf16:1998',true)).toBe(`q=${escaped('中')}&x=${escaped('文')}`);
});

test.each(['utf8:1998','unicode11utf8:1998','utf16:1998','utf16be:1998','utf16le:1998','ucs2:1998'])(
  'preserves response and TXT decoding for the %s alias', name => {
    let seed=0x21546789;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
    const samples = [...bytes, ...Array.from({length:500},()=>Array.from({length:next()%32},()=>next()>>>24))];
    for(const sample of samples) {
      const input=Uint8Array.from(sample);
      expect(decodeSourceCharset(input,name)).toBe(iconv.decode(input,name,{stripBOM:false}));
      expect(decodeTxtBase64(Buffer.from(input).toString('base64'),name)).toBe(iconv.decode(input,name).replace(/^\uFEFF/,''));
    }
  },
);

test('remaining decoders match the old codec on deterministic malformed and mixed input', () => {
  const names = ['binary','base64','hex','cesu8','utf7','utf7imap'];
  let seed = 0x12345678;
  const next = () => {seed = (Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for (const name of names) for (let sample=0;sample<3000;sample++) {
    const length = next()%32, value = Uint8Array.from({length},()=>next()>>>24);
    const expected = iconv.decode(value,name,{stripBOM:false}), actual = decodeSourceCharset(value,name);
    if (actual !== expected) throw new Error(`${name} ${Buffer.from(value).toString('hex')} expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
    const expectedTxt = iconv.decode(value,name).replace(/^\uFEFF/,''), actualTxt = decodeTxtBase64(Buffer.from(value).toString('base64'),name);
    if (actualTxt !== expectedTxt) throw new Error(`TXT ${name} ${Buffer.from(value).toString('hex')} expected=${JSON.stringify(expectedTxt)} actual=${JSON.stringify(actualTxt)}`);
  }
});

test('remaining encoders match the old codec on deterministic mixed UTF-16', () => {
  const {encodeRemainingCharset} = require('../src/core/remainingCharsets');
  const alphabet = 'A0Ff9+/=_-&,?!中😀\u0000\u00ff\u0130\uff46\ud800\udfff';
  let seed = 0x87654321;
  const next = () => {seed = (Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for (const name of ['binary','base64','hex','cesu8','utf7','utf7imap']) for (let sample=0;sample<3000;sample++) {
    let value = '';const length=next()%24;
    for(let i=0;i<length;i++)value+=alphabet[next()%alphabet.length];
    expect(encodeRemainingCharset(value,name)).toEqual([...iconv.encode(value,name)]);
  }
});

test('remaining URL encoders preserve Java-form adaptation for mixed input', () => {
  const alphabet = 'A0Ff9+/=_-&,?!中😀\u0000\u00ff\u0130\uff46\ud800\udfff';
  let seed = 0x76543210;
  const next = () => {seed = (Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for (const name of urlNames) for (let sample=0;sample<1500;sample++) {
    let value='';const length=next()%24;
    for(let i=0;i<length;i++)value+=alphabet[next()%alphabet.length];
    expect(encodeJavaFormValue(value,name)).toBe(previousFormEncoding(value,name));
  }
});

test('auto UTF-16 TXT decoding matches the old BOM and byte-order detection', () => {
  let seed=0x1234abcd;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let sample=0;sample<3000;sample++){
    const value=Uint8Array.from({length:next()%70},()=>next()>>>24);
    expect(decodeTxtBase64(Buffer.from(value).toString('base64'),'utf16')).toBe(iconv.decode(value,'utf16').replace(/^\uFEFF/,''));
  }
});
