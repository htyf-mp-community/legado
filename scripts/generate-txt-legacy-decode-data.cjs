// Development-only extraction of byte-to-Unicode conversion facts from the
// previous iconv-lite 0.7.3 TXT decoder, including GB18030 pointer ranges.
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const result = {};
for (const charset of ['GBK', 'GB18030', 'BIG5', 'CP936', 'CP950', 'SHIFTJIS', 'EUCJP', 'CP949']) {
  const single = [], pairs = {}, triples = {};
  for (let first = 0; first < 256; first++) {
    const decoder = iconv.getDecoder(charset, {stripBOM: false});
    const output = decoder.write(Buffer.from([first]));
    if (output !== '') { single.push(output); continue; }
    single.push(null);
    const row = [];
    for (let second = 0; second < 256; second++) {
      const pairDecoder = iconv.getDecoder(charset, {stripBOM: false});
      const value = pairDecoder.write(Buffer.from([first, second]));
      row.push(value && !value.startsWith('\ufffd') ? value : null);
      if (charset === 'EUCJP' && value === '') {
        const thirdRow = [];
        for (let third = 0; third < 256; third++) {
          const decoder = iconv.getDecoder(charset, {stripBOM: false});
          const output = decoder.write(Buffer.from([first, second, third]));
          thirdRow.push(output && !output.startsWith('\ufffd') ? output : null);
        }
        triples[`${first},${second}`] = thirdRow;
      }
    }
    pairs[first] = row;
  }
  result[charset] = {single, pairs, triples};
}
const gb = iconv.getCodec('GB18030').gb18030;
result.gb18030Ranges = gb.gbChars.map((pointer, index) => [pointer, gb.uChars[index]]);
result.gb18030Exceptions = [];
const bytes = Buffer.alloc(4);
let rangeIndex = 0;
for (let pointer = 0; pointer < 126 * 10 * 126 * 10; pointer++) {
  while (rangeIndex + 1 < gb.gbChars.length && gb.gbChars[rangeIndex + 1] <= pointer) rangeIndex++;
  let remaining = pointer;
  bytes[0] = 0x81 + Math.floor(remaining / 12600); remaining %= 12600;
  bytes[1] = 0x30 + Math.floor(remaining / 1260); remaining %= 1260;
  bytes[2] = 0x81 + Math.floor(remaining / 10); bytes[3] = 0x30 + remaining % 10;
  let code = gb.uChars[rangeIndex] + pointer - gb.gbChars[rangeIndex];
  let basic;
  if (code < 0x10000) basic = String.fromCharCode(code);
  else { code -= 0x10000; basic = String.fromCharCode(0xd800 | (code >> 10), 0xdc00 | (code & 0x3ff)); }
  const actual = iconv.decode(bytes, 'GB18030');
  if (basic !== actual) result.gb18030Exceptions.push([pointer, actual]);
}
fs.writeFileSync(path.join(__dirname, '../src/data/txtLegacyDecodeData.json'), `${JSON.stringify(result)}\n`);
console.log(`Wrote TXT decoding data; ${result.gb18030Ranges.length} GB18030 ranges and ${result.gb18030Exceptions.length} exceptions`);
