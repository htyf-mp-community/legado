import http from 'node:http';

// Disposable loopback source for the independent iOS simulator; never bundled.
const origin = 'http://127.0.0.1:18211';
const requests = [];
const source = {
  bookSourceUrl: origin, bookSourceName: 'iOS 搜索验收（临时）', bookSourceType: 0,
  customOrder: 9999, enabled: true, enabledExplore: false,
  searchUrl: `${origin}/search?q={{key}}`,
  ruleSearch: { bookList: '$[*]', name: '$.name', author: '$.author', bookUrl: '$.url' },
  ruleBookInfo: { name: '$.name', author: '$.author', tocUrl: '$.toc', intro: '$.intro' },
  ruleToc: { chapterList: '$[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' },
};
const book = { name: 'iOS 搜索验收', author: '本机验收', url: `${origin}/book`, toc: `${origin}/toc`, intro: '临时缓存搜索、大小写、正则、净化和精确定位验收。' };
const filler = Array.from({ length: 65 }, (_, index) => `第${index + 1}段。山川与河流，清风和明月。这是一段用于核对阅读位置的普通正文。`).join('\n');
const chapters = [
  { title: '第一章 頭髮', content: `第一章 頭髮\nABC abc Abc\n頭髮與發展。\n${'甲'.repeat(125)}\n${filler}\n定位词第一次。\n${filler}\n定位词第二次。\n本章结束。` },
  { title: '第二章 继续定位', content: '第二章 继续定位\n相邻缓存章节。\n定位词第三次。\n此处间隔一段。\n定位词第四次。' },
  ...[3, 4, 5].map(index => ({ title: `第${index}章 空白对照`, content: `第${index}章 空白对照\n远端正文。` })),
  { title: '第六章 未缓存关键词', content: '第六章 未缓存关键词\n此章不应被书内搜索发起请求。定位词。' },
].map((value, index) => ({ ...value, url: `${origin}/chapter/${index + 1}` }));
const rules = [{ id: 99204001, name: '搜索净化验收（临时）', pattern: '头发', replacement: '净化词',
  isEnabled: true, scopeContent: true, scopeTitle: true, scope: origin, isRegex: false, order: 0 }];
http.createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, origin).pathname);
  requests.push({ path, method: request.method, time: new Date().toISOString() });
  const send = value => { response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  if (path === '/fixture.json') return send({ source, book, chapters, rules });
  if (path === '/__state') return send({ requests });
  if (path === '/search') return send([book]);
  if (path === '/book') return send(book);
  if (path === '/toc') return send(chapters.map(({ title, url }) => ({ title, url })));
  const chapter = chapters.find(value => value.url === origin + path);
  if (chapter) return send({ content: chapter.content });
  response.writeHead(404); response.end();
}).listen(18211, '127.0.0.1', () => console.log(`Content search fixture ready: ${origin}`));
