import http from 'node:http';

// Disposable iOS-only loopback fixture. Excluded from production inputs.
const origin = 'http://127.0.0.1:18210';
const requests = [];
const source = {
  bookSourceUrl: origin, bookSourceName: 'iOS 原文处理验收（临时）', bookSourceType: 0,
  customOrder: 9999, enabled: true, enabledExplore: false,
  searchUrl: `${origin}/search?q={{key}}`,
  ruleSearch: { bookList: '$[*]', name: '$.name', author: '$.author', bookUrl: '$.url' },
  ruleBookInfo: { name: '$.name', author: '$.author', tocUrl: '$.toc', intro: '$.intro' },
  ruleToc: { chapterList: '$[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' },
};
const book = { name: 'iOS 原文处理验收', author: '本机验收', url: `${origin}/book`, toc: `${origin}/toc`, intro: '临时特殊 HTML / 转换 / 缓存开关验收。' };
const chapters = [
  { title: '第一章 特殊格式', url: `${origin}/chapter/1`, content: '<p>第一章 特殊格式</p><p>頭髮與發展。外部廣告。</p><usehtml><div style="text-align:center"><b>頭髮與發展</b><br><span>保護廣告</span></div></usehtml><p>甲乙</p><img src="頭髮.png"><p>尾部。</p>' },
  { title: '第二章 单页进度', url: `${origin}/chapter/2`, content: '<p>第二章 单页进度</p><p>这是单页正文。</p>' },
];
const common = { isEnabled: true, scopeContent: true, scopeTitle: false, scope: origin, isRegex: false };
const rules = [
  { ...common, id: 99203901, name: '普通正文替换（临时）', pattern: '头发与发展', replacement: '已净化正文', order: 0 },
  { ...common, id: 99203902, name: '广告保护验收（临时）', pattern: '广告', replacement: '', order: 1 },
  { ...common, id: 99203903, name: '图片原文替换（临时）', pattern: '头发.png', replacement: '图片.png', order: 2 },
  { ...common, id: 99203904, name: '字面标签保留（临时）', pattern: '(?m)^甲乙$', replacement: '<$0>', isRegex: true, order: 3 },
];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
http.createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, origin).pathname);
  requests.push({ path, method: request.method, time: new Date().toISOString() });
  const send = value => { response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  if (path === '/fixture.json') return send({ source, book, chapters, rules });
  if (path === '/__state') return send({ requests });
  if (path === '/search') return send([book]);
  if (path === '/book') return send(book);
  if (path === '/toc') return send(chapters.map(({ title, url }) => ({ title, url })));
  if (path.endsWith('.png')) { response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }); response.end(png); return; }
  const chapter = chapters.find(value => value.url === origin + path);
  if (chapter) return send({ content: chapter.content });
  response.writeHead(404); response.end();
}).listen(18210, '127.0.0.1', () => console.log(`Native reader fixture ready: ${origin}`));
