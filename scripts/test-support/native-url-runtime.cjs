const { readFileSync } = require('fs');
const { dirname, join } = require('path');
const { transformSync } = require('@babel/core');

// Exercise the installed RN implementation, rather than Node's more complete URL.
module.exports = function nativeUrlRuntime() {
  const directory = join(dirname(require.resolve('react-native/package.json')), 'Libraries/Blob');
  const cache = new Map();
  const load = name => {
    if (cache.has(name)) return cache.get(name);
    const filename = join(directory, `${name}.js`);
    const { code } = transformSync(readFileSync(filename, 'utf8'), {
      filename, configFile: false, babelrc: false, presets: ['module:@react-native/babel-preset'],
    });
    const module = { exports: {} }; cache.set(name, module.exports);
    const dependencies = id => {
      if (id === './NativeBlobModule') return { getConstants: () => ({}) };
      if (id === './URLSearchParams') return load('URLSearchParams');
      return require(id);
    };
    // Trusted, installed RN source only; no application/source-rule input is evaluated.
    Function('require', 'module', 'exports', code)(dependencies, module, module.exports);
    return module.exports;
  };
  return { URL: load('URL').URL, URLSearchParams: load('URLSearchParams').URLSearchParams };
};
