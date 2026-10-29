# Remote worklet compiler

`plugin/index.js` is an unmodified copy of the official `react-native-worklets@0.13.0` Babel plugin, with its MIT license. It was read from the locally installed HTYF host package at `/Users/dgz/code/hty/apps/htyf-app/node_modules/react-native-worklets`.

This build-only copy is not installed as a native dependency. The local simulator keeps the pinned Reanimated 4.5.3 / Worklets 0.11.3 ABI. Remote builds selected by APP_EXPOSES_OPTIONS target the observed host Reanimated 4.7.1 / Worklets 0.13.0 array-closure ABI. Repack's extra transform is disabled for remotes so it cannot first compile callbacks with the old object-closure ABI.

Do not convert closure objects into arrays at runtime: the emitted worklet body and serializer must use the same protocol. When the host changes again, verify its runtime and use the matching official compiler with both ABI regression tests. Older hosts using the object ABI are not a target for these remote bundles.
