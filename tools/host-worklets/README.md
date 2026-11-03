# Remote worklet compiler

`plugin/index.js` is an unmodified copy of the official `react-native-worklets` Babel plugin, with its MIT license. It matches the locally installed HTYF host's 0.13.1 plugin byte for byte (and also matches the previously vendored 0.13.0 implementation). The package version here must match the current host because development worklets embed it.

This build-only copy is not installed as a native dependency. The standalone simulator keeps the pinned Reanimated 4.5.3 / Worklets 0.11.3 ABI. Remote builds selected by APP_EXPOSES_OPTIONS target the observed host Reanimated 4.7.1 / Worklets 0.13.1 array-closure ABI. Repack's extra transform is disabled for remotes so it cannot first compile callbacks with the old object-closure ABI. Production worklets do not embed a plugin version.

Do not convert closure objects into arrays at runtime: the emitted worklet body and serializer must use the same protocol. When the host changes again, verify its runtime and use the matching official compiler with both ABI regression tests. Older hosts using the object ABI are not a target for these remote bundles.
