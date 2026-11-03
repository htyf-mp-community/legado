// Development-only CP950 differences from the checked-in ICU Big5 map.
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const table = require('../src/data/sourceCharsetDecodeData.json').multi.Big5;
const inverse = new Map();
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
const overrides = [];
for (let code = 0; code <= 0x10ffff; code++) {
  if (code >= 0xd800 && code <= 0xdfff) continue;
  const bytes = iconv.encode(String.fromCodePoint(code) + 'a', 'CP950').subarray(0, -1);
  if (bytes.length < 1 || bytes.length > 2) throw Error(`Unexpected CP950 length for ${code}`);
  const packed = [...bytes].reduce((value, byte) => value * 256 + byte, 0);
  if (code <= 0xffff) {
    if ((inverse.get(code) ?? 0x3f) !== packed) overrides.push([code, packed]);
  } else if (packed !== 0x3f) throw Error(`Supplementary CP950 mapping for ${code}`);
}
fs.writeFileSync(path.join(__dirname, '../src/data/cp950EncodeData.json'), `${JSON.stringify(overrides)}\n`);
console.log(`Wrote ${overrides.length} CP950 mapping differences`);
