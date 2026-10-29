const fs = require('fs');
const path = require('path');

test('registers a typed React Navigation file-manager route and Mine entry', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/index.tsx'),
    'utf8',
  );
  expect(source).toContain('FileManager: undefined;');
  expect(source).toContain('<Stack.Screen name="FileManager">');
  expect(source).toMatch(/<MineScreen\s+navigate=/);
  const mine = fs.readFileSync(
    path.join(__dirname, '../src/screens/MineScreen.tsx'),
    'utf8',
  );
  expect(mine).toMatch(/entry\(\s*'ic_folder_outline',\s*t\('fileManager'\),\s*t\('mineFilesSummary'\),\s*'FileManager'/);

});

test('uses an in-tree confirmation sheet and no native-window overlay', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/screens/AppFileManager.tsx'),
    'utf8',
  );
  expect(source).toContain('<InTreeSheet');
  expect(source).not.toMatch(/\bModal\b|FullWindowOverlay/);
});
