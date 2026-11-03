const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const babel = require('@babel/core');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const hookPath =
  require.resolve('@gorhom/bottom-sheet/src/hooks/useAnimatedLayout.ts');
function execute(code, filename, overrides) {
  const module = { exports: {} };
  const realRequire = createRequire(filename);
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      require: name =>
        Object.hasOwn(overrides, name) ? overrides[name] : realRequire(name),
      console,
      global: { Error },
      __DEV__: false,
    },
    { filename },
  );
  return module.exports;
}
function layoutWithHost(nativeStandalone = false, envName = 'production') {
  const react = {
    useEffect: () => {},
    useMemo: f => f(),
    useState: f => [f()],
  };
  const hostFile = nativeStandalone
    ? require.resolve('react-native-reanimated/src/hook/useAnimatedReactionCommon.ts')
    : path.join(
        __dirname,
        'fixtures/host-worklets/useAnimatedReactionCommon-4.7.1.ts.txt',
      );
  const hostCode = ts.transpileModule(fs.readFileSync(hostFile, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const host = execute(hostCode, hostFile, {
    react,
    '../core': {},
    '../common': { SHOULD_BE_USE_WEB: false },
    './useSharedValue': { useSharedValue: () => ({ value: null }) },
  });
  const reactions = [];
  const compiled = babel.transformFileSync(hookPath, {
    cwd: root,
    configFile: path.join(root, 'babel.config.js'),
    babelrc: false,
    envName,
  }).code;
  const layout = execute(compiled, hookPath, {
    react,
    'react-native': {
      Dimensions: { get: () => ({ width: 320, height: 800 }) },
    },
    'react-native-reanimated': {
      makeMutable: value => ({ value, get: () => value }),
      useAnimatedReaction: (prepare, reaction) => {
        reactions.push([prepare, reaction]);
        host.useAnimatedReactionBase(
          prepare,
          reaction,
          undefined,
          prepare.__closure ?? [],
        );
      },
    },
    '../constants': {
      INITIAL_LAYOUT_VALUE: -999,
      INITIAL_CONTAINER_LAYOUT: { offset: {} },
    },
  });
  layout.useAnimatedLayout(undefined, 20, 30, false, false);
  return { reactions, compiled };
}
test('remote development worklets use the version checked by the current host runtime', () => {
  const old = process.env.APP_EXPOSES_OPTIONS;
  process.env.APP_EXPOSES_OPTIONS = encodeURI(JSON.stringify({ name: 'plugin_legado' }));
  try {
    const { reactions } = layoutWithHost(false, 'development');
    for (const pair of reactions)
      for (const callback of pair) {
        expect(Array.isArray(callback.__closure)).toBe(true);
        expect(callback.__pluginVersion).toBe('0.13.1');
      }
  } finally {
    if (old === undefined) delete process.env.APP_EXPOSES_OPTIONS;
    else process.env.APP_EXPOSES_OPTIONS = old;
  }
});
test('production Gorhom worklets can be consumed by the host Reanimated 4.7 native reaction hook', () => {
  const old = process.env.APP_EXPOSES_OPTIONS;
  process.env.APP_EXPOSES_OPTIONS = encodeURI(
    JSON.stringify({ name: 'plugin_legado' }),
  );
  try {
    const { reactions } = layoutWithHost();
    expect(reactions).toHaveLength(2);
    for (const pair of reactions)
      for (const callback of pair)
        expect(Array.isArray(callback.__closure)).toBe(true);
    expect(reactions[0][0]()).toBe(-999);
  } finally {
    if (old === undefined) delete process.env.APP_EXPOSES_OPTIONS;
    else process.env.APP_EXPOSES_OPTIONS = old;
  }
});

test('standalone debug build works with the updated native Worklets array ABI', () => {
  const old = process.env.APP_EXPOSES_OPTIONS;
  delete process.env.APP_EXPOSES_OPTIONS;
  try {
    const { reactions } = layoutWithHost(true, 'development');
    expect(reactions).toHaveLength(2);
    for (const pair of reactions)
      for (const callback of pair) {
        expect(callback.__closure).toBeDefined();
        expect(Array.isArray(callback.__closure)).toBe(true);
        expect(callback.__pluginVersion).toBe('0.13.1');
      }
    expect(reactions[0][0]()).toBe(-999);
  } finally {
    if (old !== undefined) process.env.APP_EXPOSES_OPTIONS = old;
  }
});
