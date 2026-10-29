const fs = require('node:fs');
const path = require('node:path');

test('shared sheets use the Gorhom host owned by this application root', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/components/InTreeSheet.tsx'),
    'utf8',
  );
  expect(source).toContain("from '@gorhom/bottom-sheet'");
  expect(source).toContain('<BottomSheet');
  expect(source).toContain('BottomSheetScrollView');
  expect(source).toContain('nestedScrollEnabled');
  expect(source).toContain('contentContainerStyle');
  expect(source).toContain('enablePanDownToClose');
  expect(source).toContain('onDismiss=');
  expect(source).toContain('<BottomSheetModal');
  expect(source).toContain('containerComponent={SheetLayer}');
  expect(source).toMatch(/<View\s+accessibilityViewIsModal/);
  expect(source).not.toMatch(/\bModal\b|FullWindowOverlay/);
  const app = fs.readFileSync(path.join(__dirname, '../src/index.tsx'), 'utf8');
  expect(app).toMatch(
    /<AppThemeProvider>\s*<View[^>]*>\s*<BottomSheetModalProvider>\s*<AppNavigation/,
  );
});

test('the application root provides the gesture-handler host required by Gorhom', () => {
  const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
  expect(source).toContain('<GestureHandlerRootView');
});
