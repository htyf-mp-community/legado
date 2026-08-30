const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, `../src/screens/${file}`), 'utf8');

test.each(['Explore.tsx', 'Rss.tsx'])('%s constrains horizontal filter rails', file => {
  const source = read(file);
  expect(source).toMatch(/horizontalRail:\s*\{\s*flexGrow:\s*0\s*\}/);
  expect(source).toContain('style={s.horizontalRail}');
});

test.each(['Explore.tsx', 'Rss.tsx'])('%s keeps feed controls out of list compression', file => {
  const source = read(file);
  expect(source).toMatch(/filterHeader:\s*\{[\s\S]*?flexShrink:\s*0/);
  expect(source).toMatch(/contentScroll:\s*\{[\s\S]*?flex:\s*1/);
  expect(source).toContain('style={s.contentScroll}');
});

test('RSS empty and error states expose recovery actions', () => {
  const source = read('Rss.tsx');
  expect(source).toMatch(/accessibilityLiveRegion="polite"[\s\S]*?borderColor:/);
  expect(source).toMatch(/articleView === 'all'[\s\S]*?accessibilityLabel=\{t\('refresh'\)\}/);
});

test('home tabs provide vector icons and selected semantics', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/index.tsx'), 'utf8');
  expect(source).toContain('function HomeTabIcon');
  expect(source).toContain('accessibilityState={{ selected }}');
  expect(source).toMatch(/<HomeTabIcon tab=\{key\}/);
});
