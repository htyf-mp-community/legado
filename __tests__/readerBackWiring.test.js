const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('reader registers a focused hardware-back handler with menu state', () => {
  const reader = read('index.tsx');
  expect(reader).toMatch(/BackHandler\.addEventListener\(\s*'hardwareBackPress'/);
  expect(reader).toContain('shouldBlockReaderHardwareBack(');
  expect(reader).toContain('prefs.disableReturnKey');
  expect(reader).toContain('controls,');
  expect(reader).toContain('subscription.remove()');
});

test('reader settings expose the persisted Android return-key preference', () => {
  const settings = read('screens/ReaderSettings.tsx');
  expect(settings).toContain("label={t('disableReaderReturnKey')}");
  expect(settings).toContain('change({ disableReturnKey })');
});
