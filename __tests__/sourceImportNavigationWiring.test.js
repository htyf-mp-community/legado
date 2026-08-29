const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'src');
test('source manager exposes file, URL and source-context QR imports', () => {
  const manager = fs.readFileSync(path.join(root, 'screens', 'SourceManager.tsx'), 'utf8');
  const navigation = fs.readFileSync(path.join(root, 'index.tsx'), 'utf8');
  const qr = fs.readFileSync(path.join(root, 'screens', 'QrImport.tsx'), 'utf8');
  expect(manager).toContain('pickBookSourcesInput');
  expect(manager).toContain('importBookSourcesInput(onlineUrl)');
  expect(navigation).toContain("expectedKind: 'bookSource'");
  expect(qr).toContain("expectedKind === 'bookSource'");
  expect(qr).toContain('saveSources(mergeBookSources(current, incoming))');
});
