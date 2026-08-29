import { buildAppDiagnostics } from '../src/core/appDiagnostics';

test('builds stable copyable diagnostics without secrets', () => {
  expect(buildAppDiagnostics({ appName: 'Legado', appVersion: '1.0', appId: 'app-id', storageId: 'store-id', platform: 'android', platformVersion: 35, reactNativeVersion: { major: 0, minor: 86, patch: 2 } })).toBe('Legado 1.0\nHTYF App ID: app-id\nStorage: store-id\nPlatform: android 35\nReact Native: 0.86.2');
});
