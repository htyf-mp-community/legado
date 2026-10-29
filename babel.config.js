module.exports = function (api) {
  // A remote runs on the host's Worklets 0.13 ABI; the standalone iOS binary stays on its pinned 0.11 ABI.
  const remote = api.cache.using(() =>
    Boolean(process.env.APP_EXPOSES_OPTIONS),
  );
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      '@babel/plugin-transform-export-namespace-from',
      remote
        ? require.resolve('./tools/host-worklets/plugin/index.js')
        : 'react-native-worklets/plugin',
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': './src',
          },
        },
      ],
    ],
  };
};
