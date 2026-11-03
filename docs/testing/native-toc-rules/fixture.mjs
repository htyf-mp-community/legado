import http from 'node:http';
import { writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:18221';
const requests = [];
const source = {
  bookSourceUrl: base, bookSourceName: 'iOS 多页目录验收', bookSourceType: 0,
  customOrder: 0, enabled: true, enabledExplore: false,
  searchUrl: `${base}/search?key={{key}}`,
  ruleSearch: { bookList: 'class.book', name: 'tag.a@text', bookUrl: 'tag.a@href' },
  ruleBookInfo: { name: 'tag.h1@text', author: 'class.author@text', tocUrl: 'class.toc@href' },
  ruleToc: { chapterList: '-class.chapters@tag.li', chapterName: 'class.name@text', chapterUrl: 'class.name@href', isVolume: 'class.flag@text', nextTocUrl: 'class.pages@tag.a@href' },
  ruleContent: { content: 'class.content@html' },
};
const pages = {
  '/toc/1': '<ul class="chapters"><li><a class="name" href="/chapter/3">第三章</a></li><li><a class="name" href="/chapter/2">第二章原版</a></li></ul><div class="pages"><a href="/toc/2">二</a><a href="/toc/3">三</a></div>',
  '/toc/2': '<ul class="chapters"><li><a class="name" href="/chapter/2">第二章重复</a></li><li><a class="name" href="/chapter/1">第一章</a></li></ul>',
  '/toc/3': '<ul class="chapters"><li><span class="name">第一卷</span><span class="flag">1</span></li></ul>',
};
http.createServer(async (req, res) => {
  const path = new URL(req.url, base).pathname;
  requests.push(path);
  await writeFile('/private/tmp/legado-native-toc-requests.json', JSON.stringify(requests));
  if (path === '/source.json') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify([source])); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (path === '/search') { res.end('<div class="book"><a href="/book/1">多页目录验收书</a></div>'); return; }
  if (path === '/book/1') { res.end('<h1>多页目录验收书</h1><p class="author">验收作者</p><a class="toc" href="/toc/1">目录</a>'); return; }
  if (pages[path]) { res.end(pages[path]); return; }
  if (path.startsWith('/chapter/')) { res.end('<div class="content"><p>目录测试正文。</p></div>'); return; }
  res.writeHead(404); res.end();
}).listen(18221, '127.0.0.1', () => console.log('toc fixture 127.0.0.1:18221'));
