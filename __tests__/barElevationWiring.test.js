const fs = require('fs');
const path = require('path');
test('applies the persisted elevation to both shared headers and the root bottom bar', () => {
  const header = fs.readFileSync(path.join(__dirname, '../src/components/PageHeader.tsx'), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '../src/index.tsx'), 'utf8');
  const appearance = fs.readFileSync(path.join(__dirname, '../src/screens/AppearanceSettings.tsx'), 'utf8');
  expect(header).toContain('preferences.barElevation');
  expect(index).toContain('appPreferences.barElevation');
  expect(appearance).toContain("t('barElevation')");
  expect(appearance).toContain('TODO(htyf-native)');
});
