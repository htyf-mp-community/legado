export type DiagnosticInput = {
  appName: string;
  appVersion: string;
  appId: string;
  storageId: string;
  platform: string;
  platformVersion: string | number;
  reactNativeVersion?: { major: number; minor: number; patch: number };
};

export function buildAppDiagnostics(value: DiagnosticInput) {
  const rn = value.reactNativeVersion
    ? `${value.reactNativeVersion.major}.${value.reactNativeVersion.minor}.${value.reactNativeVersion.patch}`
    : 'unknown';
  return [
    `${value.appName} ${value.appVersion}`,
    `HTYF App ID: ${value.appId}`,
    `Storage: ${value.storageId}`,
    `Platform: ${value.platform} ${String(value.platformVersion)}`,
    `React Native: ${rn}`,
  ].join('\n');
}
