// Development-only differences from ICU maps to the previous iconv-lite 0.7.3
// Japanese and Korean encoders. Generated data is used at runtime.
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const data = require('../src/data/sourceCharsetDecodeData.json');
const result = {};
for (const [charset, mapping] of [['SHIFTJIS', 'Shift_JIS'], ['EUCJP', 'EUC-JP'], ['CP949', 'ibm-949']]) {
  const table = data.multi[mapping], inverse = new Map();
  for (let byte = 0; byte < 256; byte++) {
    if (table.double[byte] !== undefined) continue;
    const code = table.single.charCodeAt(byte);
    if (code !== 0xfffd && !inverse.has(code)) inverse.set(code, byte);
  }
  for (const [lead, row] of Object.entries(table.double)) {
    for (let trail = 0; trail < 256; trail++) {
      const code = row.charCodeAt(trail);
      if (code > 2 && code !== 0xfffd && !inverse.has(code)) inverse.set(code, Number(lead) * 256 + trail);
    }
  }
  if (charset === 'EUCJP') {
    for (const [middle, row] of Object.entries(table.triple)) {
      for (let trail = 0; trail < 256; trail++) {
        const code = row.charCodeAt(trail);
        if (code > 2 && code !== 0xfffd && !inverse.has(code)) inverse.set(code, 0x8f0000 + Number(middle) * 256 + trail);
      }
    }
  }
  const overrides = [];
  for (let code = 0; code <= 0x10ffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const bytes = iconv.encode(String.fromCodePoint(code) + 'a', charset).subarray(0, -1);
    if (bytes.length < 1 || bytes.length > 3) throw Error(`Unexpected ${charset} length for ${code}`);
    const packed = [...bytes].reduce((value, byte) => value * 256 + byte, 0);
    if (code <= 0xffff) {
      if ((inverse.get(code) ?? 0x3f) !== packed) overrides.push([code, packed]);
    } else if (packed !== 0x3f) throw Error(`Supplementary ${charset} mapping for ${code}`);
  }
  result[charset] = overrides;
}
fs.writeFileSync(path.join(__dirname, '../src/data/eastAsianEncodeData.json'), `${JSON.stringify(result)}\n`);
console.log(Object.entries(result).map(([name, entries]) => `${name}:${entries.length}`).join(' '));
