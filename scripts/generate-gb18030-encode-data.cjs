// Development-only comparison against iconv-lite 0.7.3. The generated ranges
// and mapping differences are plain conversion data used by the mini-program.
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const table = require('../src/data/sourceCharsetDecodeData.json').multi.GB18030;
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
const overrides = [], ranges = [];
let previousCode = -2, previousPointer = -2;
for (let code = 0; code <= 0x10ffff; code++) {
  if (code >= 0xd800 && code <= 0xdfff) continue;
  // The ASCII suffix also makes any pending encoder output visible before
  // extracting this scalar's bytes; GB18030 allocates four bytes per unit.
  const bytes = iconv.encode(String.fromCodePoint(code) + 'a', 'GB18030').subarray(0, -1);
  if (bytes.length !== 1 && bytes.length !== 2 && bytes.length !== 4) throw Error(`Unexpected GB18030 length: ${code}`);
  const short = bytes.length < 4 ? [...bytes].reduce((value, byte) => value * 256 + byte, 0) : -1;
  if (code <= 0xffff && (inverse.get(code) ?? -1) !== short) overrides.push([code, short]);
  if (bytes.length === 4) {
    const pointer = (((bytes[0] - 0x81) * 10 + bytes[1] - 0x30) * 126 + bytes[2] - 0x81) * 10 + bytes[3] - 0x30;
    if (code === previousCode + 1 && pointer === previousPointer + 1) ranges[ranges.length - 1][1] = code;
    else ranges.push([code, code, pointer]);
    previousCode = code; previousPointer = pointer;
  } else { previousCode = -2; previousPointer = -2; }
}
fs.writeFileSync(path.join(__dirname, '../src/data/sourceGb18030EncodeData.json'), `${JSON.stringify({overrides, ranges})}\n`);
console.log(`Wrote ${overrides.length} GB18030 mapping differences and ${ranges.length} four-byte ranges`);
