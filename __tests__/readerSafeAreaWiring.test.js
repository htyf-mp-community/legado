const fs = require('node:fs');
const path = require('node:path');

test('reader top chrome floats inside the safe area and clips its title details', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/index.tsx'),
    'utf8',
  );
  expect(source).toMatch(/readerTitleBox:\s*\{[\s\S]*?overflow:\s*'hidden'/);
  expect(source).toMatch(/readerTop:\s*\{[\s\S]*?borderRadius:\s*18/);
  expect(source).toMatch(/top:\s*safeLayout\.top \+ 8/);
  expect(source).toMatch(/left:\s*safeLayout\.left \+ 12/);
  expect(source).toMatch(/readerProgressBar:\s*\{[\s\S]*?borderRadius:\s*16/);
  expect(source).toMatch(/readerBottom:\s*\{[\s\S]*?borderRadius:\s*20/);
  expect(source).toMatch(/readerMainAction:\s*\{[\s\S]*?minHeight:\s*64/);
  expect(source).toMatch(/bottom:\s*safeLayout\.bottom\s*\+\s*8/);
  expect(source).toMatch(/bottom:\s*controls\s*\?\s*safeLayout\.infoBottomWithControls\s*:\s*safeLayout\.infoBottom/);
});
