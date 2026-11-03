const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest(context, moduleName, platform) {
      if (moduleName === 'react-native-nitro-fetch') {
        return {type: 'sourceFile', filePath: require.resolve('./src/compat/nitroFetchUnavailable.ts')};
      }
      if (moduleName === 'expo-keep-awake') {
        return {type: 'sourceFile', filePath: require.resolve('./src/compat/keepAwakeUnavailable.ts')};
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
