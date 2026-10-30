import http from 'node:http';

// Disposable loopback fixture. These rules and texts never enter the production bundle.
const origin = 'http://127.0.0.1:18208';
const requests = [];
const source = {
  bookSourceUrl: origin, bookSourceName: 'iOS 繁简验收（临时）', bookSourceType: 0,
  customOrder: 9999, enabled: true, enabledExplore: false,
  searchUrl: `${origin}/search?q={{key}}`,
  ruleSearch: { bookList: '$[*]', name: '$.name', author: '$.author', bookUrl: '$.url' },
  ruleBookInfo: { name: '$.name', author: '$.author', tocUrl: '$.toc', intro: '$.intro' },
  ruleToc: { chapterList: '$[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' },
};
const book = { name: 'iOS 繁简验收', author: '本机验收', url: `${origin}/book`, toc: `${origin}/toc`, intro: '临时中文转换验收。' };
const chapters = [
  { title: '第一章 頭髮與發展', url: `${origin}/chapter/1`, content: '第一章 頭髮與發展\n頭髮與發展。\n鳳梨機車介面規則純文字檔案。\n他說。她說。\n😀甲\u00a0乙。' },
  { title: '第二章 头发与发展', url: `${origin}/chapter/2`, content: '第二章 头发与发展\n这是简体正文，皇后的头发与干燥的面条。\n凤梨机车介面规则纯文字档案。\n“发型与发表。”' },
];
const rules = [
  { id: 99203701, name: '繁简验收标题（临时）', pattern: '^第一章 头发与发展$', replacement: '第一章 净化后标题', scope: origin, scopeTitle: true, scopeContent: false, isRegex: true, isEnabled: true, order: 0 },
  { id: 99203702, name: '繁简验收正文（临时）', pattern: '头发与发展', replacement: '已转换正文', scope: origin, scopeTitle: false, scopeContent: true, isRegex: false, isEnabled: true, order: 1 },
];
http.createServer((request, response) => {
  const path = new URL(request.url, origin).pathname;
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
}).listen(18208, '127.0.0.1', () => console.log(`Chinese conversion fixture ready: ${origin}`));
