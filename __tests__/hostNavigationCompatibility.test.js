const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const cardPath = path.join(root, 'node_modules/@react-navigation/stack/src/views/Stack/Card.tsx');
const sample = `import { InteractionManager as interactions } from 'react-native';
export function transition() { const handle = interactions.createInteractionHandle(); interactions.clearInteractionHandle(handle); return handle; }`;
function compile(filename) {
  return babel.transformSync(sample, { cwd: root, filename, configFile: path.join(root, 'babel.config.js'), babelrc: false, envName: 'production' }).code;
}
function execute(code) {
  const module = { exports: {} };
  const reactNative = {};
  Object.defineProperty(reactNative, 'InteractionManager', { get() { throw new Error('InteractionManager removed'); } });
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name === 'react-native' ? reactNative : require(name) });
  return module.exports.transition();
}
test('remote stack card transitions do not access the removed host InteractionManager getter', () => {
  const old = process.env.APP_EXPOSES_OPTIONS;
  process.env.APP_EXPOSES_OPTIONS = encodeURI(JSON.stringify({ name: 'plugin_legado' }));
  try { expect(execute(compile(cardPath))).toBe(-1); }
  finally { if (old === undefined) delete process.env.APP_EXPOSES_OPTIONS; else process.env.APP_EXPOSES_OPTIONS = old; }
});
test('standalone compilation does not alter the React Native interaction import', () => {
  const old = process.env.APP_EXPOSES_OPTIONS;
  delete process.env.APP_EXPOSES_OPTIONS;
  try { expect(() => execute(compile(cardPath))).toThrow('InteractionManager removed'); }
  finally { if (old !== undefined) process.env.APP_EXPOSES_OPTIONS = old; }
});
test('remote compilation leaves unrelated modules unchanged', () => {
  const old = process.env.APP_EXPOSES_OPTIONS;
  process.env.APP_EXPOSES_OPTIONS = encodeURI(JSON.stringify({ name: 'plugin_legado' }));
  try { expect(() => execute(compile(path.join(root, 'src/unrelated.ts')))).toThrow('InteractionManager removed'); }
  finally { if (old === undefined) delete process.env.APP_EXPOSES_OPTIONS; else process.env.APP_EXPOSES_OPTIONS = old; }
});
