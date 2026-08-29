const { readFileSync } = require('fs');
const { resolve } = require('path');

test('routes RSS login through React Navigation using the request CookieJar identity', () => {
  const index = readFileSync(resolve(__dirname, '../src/index.tsx'), 'utf8');
  const login = readFileSync(resolve(__dirname, '../src/screens/SourceLogin.tsx'), 'utf8');
  expect(index).toMatch(/navigate\('SourceLogin',\s*\{\s*rssSourceUrl\s*\}\)/);
  expect(index).toContain('rssSourceUrl={route.params.rssSourceUrl}');
  expect(login).toContain('id: source.sourceUrl');
  expect(login).toContain('loadRssSources()');
});
