const { readFileSync } = require('fs');
const { resolve } = require('path');

test('RSS reader persists read state and merges refreshed content into the latest favorite state', () => {
  const source = readFileSync(resolve(__dirname, '../src/screens/RssReader.tsx'), 'utf8');
  expect(source).toMatch(/read:\s*true,\s*readTime:\s*Date\.now\(\)/);
  expect(source).toMatch(/updateRssArticle\(loadRssArticles\(\),\s*articleId,\s*\{\s*content,?\s*\}\)/);
  expect(source).toMatch(/setRssFavorite\(loadRssArticles\(\),\s*articleId,\s*false\)/);
  expect(source).toMatch(/onError=\{\(\) => \{\s*setLoading\(false\);\s*setError\(t\('rssWebPageFailed'\)\);\s*\}\}/);
});
