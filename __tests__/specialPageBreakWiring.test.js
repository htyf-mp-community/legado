const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('reader applies special page breaks to page and scroll modes', () => {
  const reader = read('index.tsx');
  expect(reader).toContain('stripSpecialPageBreaks(displayContent)');
  expect(reader).toContain('prefs.adaptSpecialStyle,');
  expect(reader).toContain('scrollDisplayContent');
});

test('reader settings expose the persisted special-format preference', () => {
  const settings = read('screens/ReaderSettings.tsx');
  expect(settings).toContain("label={t('adaptSpecialStyle')}");
  expect(settings).toContain('change({ adaptSpecialStyle })');
});
