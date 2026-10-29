/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SDKPortal } from '@htyf-mp/rn-sdk';
import App from './src';
import { name as appName } from './app.json';
import TrackPlayer from 'react-native-track-player';

// Pinned navigation dependencies still access this deprecated RN API. Keep the
// known development banner from covering reader controls; other warnings/errors remain visible.
if (__DEV__) {
  LogBox.ignoreLogs([
    'InteractionManager has been deprecated and will be removed in a future release.',
  ]);
}

function RootApp() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <App />
        <SDKPortal
          isNative={false}
          setGloabl={true}
          currentGlobal={globalThis}
          appid="native-appstore"
          launchOptions={{}}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

AppRegistry.registerComponent(appName, () => RootApp);
TrackPlayer.registerPlaybackService(
  () => require('./src/services/playbackService').playbackService,
);
