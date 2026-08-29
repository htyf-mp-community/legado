const { readFileSync } = require('fs');
const { resolve } = require('path');

test('RSS list uses the paged core for refresh and explicit next-page loading', () => {
  const source = readFileSync(resolve(__dirname, '../src/screens/Rss.tsx'), 'utf8');
  expect(source).toMatch(/fetchRssFeedPage\(selected,\s*\{\s*sortName,\s*url,\s*page:\s*1,\s*key,?\s*\}\)/);
  expect(source).toMatch(/fetchRssFeedPage\(selected,\s*\{\s*sortName:\s*activeSort,\s*url:\s*nextUrl,\s*page:\s*nextPage,\s*key:\s*activeKey,?\s*\}\)/);
  expect(source).toContain('request.current !== token');
});
