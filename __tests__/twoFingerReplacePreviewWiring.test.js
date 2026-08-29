const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('reader consumes a stable two-finger hold and restores replacement state', () => {
  const reader = read('index.tsx');
  expect(reader).toContain('prefs.twoFingerReplacePreview && touches.length === 2');
  expect(reader).toContain('() => setReplacePreviewActive(true)');
  expect(reader).toContain('600,');
  expect(reader).toContain('shouldCancelTwoFingerPreview(');
  expect(reader).toContain('setReplacePreviewActive(false)');
  expect(reader).toContain('previewReplacementRules(');
});

test('reader settings expose the persisted preview preference', () => {
  const settings = read('screens/ReaderSettings.tsx');
  expect(settings).toContain("label={t('twoFingerReplacePreview')}");
  expect(settings).toContain('change({ twoFingerReplacePreview })');
});
