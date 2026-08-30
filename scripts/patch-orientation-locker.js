const fs = require('fs');
const path = require('path');

const orientationSource = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-orientation-locker',
  'ios',
  'RCTOrientation',
  'Orientation.m',
);

if (!fs.existsSync(orientationSource)) {
  console.warn('[patch-orientation-locker] Package is not installed; skipping.');
  process.exit(0);
}

const source = fs.readFileSync(orientationSource, 'utf8');
const unsafeDealloc = `- (void)dealloc
{
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [self removeListeners:1];
}`;
const safeDealloc = `- (void)dealloc
{
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}`;

if (source.includes(unsafeDealloc)) {
  fs.writeFileSync(
    orientationSource,
    source.replace(unsafeDealloc, safeDealloc),
  );
  console.log('[patch-orientation-locker] Applied iOS listener teardown fix.');
} else if (source.includes(safeDealloc)) {
  console.log('[patch-orientation-locker] iOS listener teardown is already safe.');
} else {
  throw new Error(
    'Unsupported Orientation.m layout; review react-native-orientation-locker before patching.',
  );
}
