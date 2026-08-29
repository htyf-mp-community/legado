const { readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const tsxFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? tsxFiles(join(directory, entry.name)) : entry.name.endsWith('.tsx') ? [join(directory, entry.name)] : []);

test('every Pressable declares an explicit accessibility role', () => {
  const missing = [];
  for (const file of tsxFiles(join(process.cwd(), 'src'))) {
    const source = readFileSync(file, 'utf8'), tags = source.match(/<Pressable\b[\s\S]*?>/g) ?? [];
    tags.forEach((tag, index) => { if (!tag.includes('accessibilityRole=')) missing.push(`${file}:${index + 1}`); });
  }
  expect(missing).toEqual([]);
});

test('every Switch declares an explicit accessibility label', () => {
  const missing = [];
  for (const file of tsxFiles(join(process.cwd(), 'src'))) {
    const source = readFileSync(file, 'utf8'), tags = source.match(/<Switch\b[\s\S]*?>/g) ?? [];
    tags.forEach((tag, index) => { if (!tag.includes('accessibilityLabel=')) missing.push(`${file}:${index + 1}`); });
  }
  expect(missing).toEqual([]);
});

test('every TextInput declares an explicit accessibility label', () => {
  const missing = [];
  for (const file of tsxFiles(join(process.cwd(), 'src'))) {
    const source = readFileSync(file, 'utf8'), tags = source.match(/<TextInput\b[\s\S]*?(?:\/>|>)/g) ?? [];
    tags.forEach((tag, index) => { if (!tag.includes('accessibilityLabel=')) missing.push(`${file}:${index + 1}`); });
  }
  expect(missing).toEqual([]);
});
