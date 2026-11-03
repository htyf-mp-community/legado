import http from 'node:http';
import { writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:18220';
const requests = [];
const source = {
  bookSourceUrl: base,
  bookSourceName: 'iOS 详情跳转验收',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: false,
  searchUrl: `${base}/search?key={{key}}`,
  bookUrlPattern: 'http://127\\.0\\.0\\.1:18220/book/\\d+',
  ruleSearch: { bookList: 'class.search-result', name: 'tag.a@text', bookUrl: 'tag.a@href' },
  ruleBookInfo: { name: 'tag.h1@text', author: 'class.author@text', intro: 'class.intro@text' },
  ruleToc: { chapterList: 'class.chapters@tag.li', chapterName: 'tag.a@text', chapterUrl: 'tag.a@href' },
  ruleContent: { content: 'class.content@html' },
};
const html = '<h1>跳转验收书</h1><p class="author">作者：验收作者</p><p class="intro">测试详情页跳转与目录。</p><ul class="chapters"><li><a href="/chapter/1">第一章</a></li><li><a href="/chapter/2">第二章</a></li></ul>';
http.createServer(async (req, res) => {
  const url = new URL(req.url, base);
  requests.push(url.pathname);
  await writeFile('/private/tmp/legado-direct-book-requests.json', JSON.stringify(requests));
  if (url.pathname === '/search') { res.writeHead(302, { Location: '/book/1' }); res.end(); return; }
  if (url.pathname === '/source.json') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify([source])); return; }
  if (url.pathname === '/book/1') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return; }
  if (url.pathname.startsWith('/chapter/')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<div class="content"><p>这是真实重定向测试的正文。</p></div>'); return; }
  res.writeHead(404); res.end();
}).listen(18220, '127.0.0.1', () => console.log('redirect fixture 127.0.0.1:18220'));
