// Development-only extraction of single-byte mapping facts and aliases from
// iconv-lite 0.7.3. The generated data is used without iconv at runtime.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const iconv = require('iconv-lite');
iconv.encodingExists('utf8');
const names = {}, tables = [], indexes = new Map();
for (const name of Object.keys(iconv.encodings).sort()) {
  if (!iconv.encodingExists(name)) continue;
  const codec = iconv.getCodec(name);
  if (codec.constructor.name !== 'SBCSCodec') continue;
  const signature = crypto.createHash('sha256').update(codec.decodeBuf).update(codec.encodeBuf).digest('hex');
  let index = indexes.get(signature);
  if (index === undefined) {
    index = tables.length;
    indexes.set(signature, index);
    tables.push(codec.decodeBuf.toString('utf16le'));
  }
  names[name] = index;
}
fs.writeFileSync(path.join(__dirname, '../src/data/singleByteCharsetData.json'), `${JSON.stringify({names, tables})}\n`);
console.log(`Wrote ${tables.length} single-byte tables for ${Object.keys(names).length} names`);
