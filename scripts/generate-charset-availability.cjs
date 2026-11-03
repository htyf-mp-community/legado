// Generate the recognized encoding names from iconv-lite 0.7.3 for runtime
// validation without loading that library merely to check a name.
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
iconv.encodingExists('utf8');
const names = Object.keys(iconv.encodings).filter(name => iconv.encodingExists(name)).sort();
fs.writeFileSync(path.join(__dirname, '../src/data/sourceCharsetAvailability.json'), `${JSON.stringify(names)}\n`);
console.log(`Wrote ${names.length} recognized charset names`);
