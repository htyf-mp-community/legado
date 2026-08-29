const fs = require('fs');
const path = require('path');

test('wires bottom-bar skin management through React Navigation and applies it to root tabs', () => {
  const index = fs.readFileSync(path.join(__dirname, '../src/index.tsx'), 'utf8');
  const appearance = fs.readFileSync(path.join(__dirname, '../src/screens/AppearanceSettings.tsx'), 'utf8');
  expect(index).toContain('BottomBarSkins: undefined');
  expect(index).toContain('<Stack.Screen name="BottomBarSkins">');
  expect(index).toContain("navigation.navigate('BottomBarSkins')");
  expect(index).toContain('loadActiveBottomBarSkin()');
  expect(index).toContain('tabSkinIconInactive');
  expect(appearance).toContain("t('bottomBarSkins')");
});
