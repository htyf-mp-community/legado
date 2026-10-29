const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
// Run the pinned runtime's implementation, not a handwritten URL lookalike.
const source = fs.readFileSync(path.join(__dirname, '../../node_modules/react-native/Libraries/Blob/URL.js'), 'utf8')
  .replace(/^import .*;$/gm, '')
  .replace(/^export \{URLSearchParams\}.*;$/gm, '')
  .replace('export class URL', 'class URL');
const transformed = babel.transformSync('const NativeBlobModule = null;\n' + source, {
  configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-flow-strip-types'],
}).code;
const RuntimeURL = new Function('URLSearchParams', transformed + '\nreturn URL;')(URLSearchParams);
exports.withRuntimeURL = callback => {
  const previous = globalThis.URL;
  globalThis.URL = RuntimeURL;
  try { return callback(); } finally { globalThis.URL = previous; }
};
