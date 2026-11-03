module.exports = function (api) {
  // Remote builds retain the verified host compiler; standalone builds use the template's matching 0.13 ABI.
  const remote = api.cache.using(() =>
    Boolean(process.env.APP_EXPOSES_OPTIONS),
  );
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      '@babel/plugin-transform-export-namespace-from',
      ...(remote ? [require.resolve('./tools/babel-plugin-navigation-compat.js')] : []),
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
