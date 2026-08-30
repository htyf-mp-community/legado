/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SDKPortal } from '@htyf-mp/rn-sdk';
import App from './src';
import { name as appName } from './app.json';
import TrackPlayer from 'react-native-track-player';

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
