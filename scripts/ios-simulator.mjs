import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// 原生工程只在本任务的临时副本中准备/构建。所有命令使用参数数组，不经 shell 插值。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staging =
  process.env.LEGADO_IOS_DEBUG_DIR ?? '/private/tmp/legado-ios-debug';
const deviceName = 'Legado HTYF 调试',
  port = '8097';
const run = (command, args, cwd = root) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let output = '';
    child.stdout.on('data', data => {
      output += data;
      process.stdout.write(data);
    });
    child.on('error', reject);
    child.on('exit', code =>
      code === 0
        ? resolve(output.trim())
        : reject(new Error(`${command} exited ${code}`)),
    );
  });
const exists = async file => {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
};
await fs.mkdir(staging, { recursive: true });
if (!(await exists(path.join(staging, 'ios')))) {
  await fs.cp(path.join(root, 'ios'), path.join(staging, 'ios'), {
    recursive: true,
    filter: source => !/(?:^|\/)(?:Pods|build)(?:\/|$)/.test(source),
  });
}
for (const name of ['package.json', 'app.json', 'react-native.config.js'])
  await fs.copyFile(path.join(root, name), path.join(staging, name));
for (const name of [
  'node_modules',
  'src',
  'index.js',
  'babel.config.js',
  'metro.config.js',
]) {
  if (!(await exists(path.join(staging, name))))
    await fs.symlink(path.join(root, name), path.join(staging, name));
}
const devices = JSON.parse(
  await run('xcrun', ['simctl', 'list', 'devices', 'available', '--json']),
);
let device = Object.values(devices.devices)
  .flat()
  .find(item => item.name === deviceName);
if (!device) {
  const runtimes = JSON.parse(
    await run('xcrun', ['simctl', 'list', 'runtimes', '--json']),
  );
  const runtime = runtimes.runtimes
    .filter(item => item.isAvailable && item.name.startsWith('iOS'))
    .at(-1);
  if (!runtime) throw new Error('No available iOS Simulator runtime');
  const udid = await run('xcrun', [
    'simctl',
    'create',
    deviceName,
    'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro',
    runtime.identifier,
  ]);
  device = { udid, state: 'Shutdown' };
}
if (device.state !== 'Booted')
  await run('xcrun', ['simctl', 'boot', device.udid]);
await run('open', [
  '-a',
  'Simulator',
  '--args',
  '-CurrentDeviceUDID',
  device.udid,
]);
if (!(await exists(path.join(staging, 'ios/Pods/Manifest.lock')))) {
  await run(
    'pod',
    [
      'update',
      'React-Core-prebuilt',
      `--project-directory=${path.join(staging, 'ios')}`,
      '--no-repo-update',
    ],
    staging,
  );
}
if (!process.argv.includes('--skip-build'))
  await run(
    'xcodebuild',
    [
      '-workspace',
      path.join(staging, 'ios/apps.xcworkspace'),
      '-scheme',
      'apps',
      '-configuration',
      'Debug',
      '-sdk',
      'iphonesimulator',
      '-destination',
      `id=${device.udid}`,
      '-derivedDataPath',
      path.join(staging, 'DerivedData'),
      '-jobs',
      '4',
      'CODE_SIGNING_ALLOWED=NO',
      'IPHONEOS_DEPLOYMENT_TARGET=16.4',
      'RCT_NO_LAUNCH_PACKAGER=1',
      'build',
    ],
    staging,
  );
const app = path.join(
  staging,
  'DerivedData/Build/Products/Debug-iphonesimulator/apps.app',
);
const bundleId = await run('/usr/libexec/PlistBuddy', [
  '-c',
  'Print :CFBundleIdentifier',
  path.join(app, 'Info.plist'),
]);
await run('xcrun', ['simctl', 'install', device.udid, app]);
await run('xcrun', [
  'simctl',
  'launch',
  '--terminate-running-process',
  device.udid,
  bundleId,
  '-RCT_jsLocation',
  `127.0.0.1:${port}`,
]);
console.log(
  `Legado iOS Simulator: ${device.udid}; Repack: http://127.0.0.1:${port}`,
);
