const fs = require('node:fs');
const path = require('node:path');

test('shared bottom sheets use in-tree Gorhom BottomSheet without modal portals', () => {
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
  expect(source).toContain('onClose={onDismiss}');
  expect(source).not.toMatch(/BottomSheetModal|BottomSheetModalProvider|\bModal\b|Portal/);
});

test('the application root provides the gesture-handler host required by Gorhom', () => {
  const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
  expect(source).toContain('<GestureHandlerRootView');
});
