const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('the real Webpack config resolves RN 0.88 export-only entry points', () => {
  const root = path.resolve(__dirname, '..');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import config from './webpack.config.mjs';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const resolve = require('enhanced-resolve').create.sync(config({platform: 'ios'}).resolve);
    const modules = ['@react-native/asset-utils', 'react-native/react-private-interface', 'react-native/setup-env'];
    console.log(JSON.stringify(modules.map(name => resolve({}, process.cwd(), name))));
  `], { cwd: root, encoding: 'utf8', env: {...process.env, APP_EXPOSES_OPTIONS: ''} });
  expect(result.status).toBe(0);
  const resolved = JSON.parse(result.stdout.trim().split('\n').at(-1));
  expect(resolved).toEqual([
    path.join(root, 'node_modules/@react-native/asset-utils/src/index.js'),
    path.join(root, 'node_modules/react-native/src/react-private-interface.js'),
    path.join(root, 'node_modules/react-native/src/setup-env.js'),
  ]);
});
