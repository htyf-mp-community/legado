// Generate differences between the checked-in ICU decoder mapping and the
// previously used iconv-lite 0.7.3 GBK encoder. This script is development
// only; the small resulting table is used by the mini-program at runtime.
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const table = require('../src/data/sourceCharsetDecodeData.json').multi.GBK;
const mapping = new Map();
for (let byte = 0; byte < 256; byte++) {
  if (table.double[byte] !== undefined) continue;
  const code = table.single.charCodeAt(byte);
  if (code !== 0xfffd && !mapping.has(code)) mapping.set(code, byte);
}
for (const [lead, row] of Object.entries(table.double)) {
  for (let trail = 0; trail < 256; trail++) {
    const code = row.charCodeAt(trail);
    if (code > 2 && code !== 0xfffd && !mapping.has(code))
      mapping.set(code, Number(lead) * 256 + trail);
  }
}
const overrides = {};
for (const charset of ['GBK', 'CP936']) {
  const changes = [];
  for (let code = 0; code <= 0xffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    // The existing Java URL adapter uses JDK's A2E3 encoding for the euro sign.
    // Encoding a single code unit can truncate a four-byte mapping because
    // iconv-lite allocates three bytes per UTF-16 unit. A trailing ASCII byte
    // exposes the complete mapping; runtime reproduces its buffer limit.
    const bytes = code === 0x20ac ? [0xa2, 0xe3] : iconv.encode(String.fromCharCode(code) + 'a', charset).subarray(0, -1);
    const expected = [...bytes].reduce((value, byte) => value * 256 + byte, 0);
    if ((mapping.get(code) ?? 0x3f) !== expected) changes.push([code, expected]);
  }
  overrides[charset] = changes;
}
fs.writeFileSync(path.join(__dirname, '../src/data/sourceGbkEncodeOverrides.json'), `${JSON.stringify(overrides)}\n`);
console.log(`Wrote ${overrides.GBK.length} GBK and ${overrides.CP936.length} CP936 encoding overrides`);
