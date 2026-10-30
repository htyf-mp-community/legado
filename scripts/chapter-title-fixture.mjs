import http from 'node:http';

// Dedicated loopback acceptance data; never imported by the production entry.
const origin = 'http://127.0.0.1:18206';
const requests = [];
const name = 'iOS 标题验收';
const title = '第一章 标题匹配';
const firstContent = `【${name}】${title}\n首段正文，必须保留。\n`
  + Array.from({ length: 24 }, (_, i) => `第${i + 1}段。这是用于验证原版重复标题自动移除、逐章保留与冷启动恢复的本机正文。`).join('\n');
const source = {
  bookSourceUrl: origin, bookSourceName: 'iOS 标题规则验收（临时）',
  bookSourceType: 0, customOrder: 9999, enabled: true, enabledExplore: false,
  searchUrl: `${origin}/search?q={{key}}`,
  ruleSearch: { bookList: '$[*]', name: '$.name', author: '$.author', bookUrl: '$.url' },
  ruleBookInfo: { name: '$.name', author: '$.author', tocUrl: '$.toc', intro: '$.intro' },
  ruleToc: { chapterList: '$[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' },
};
const book = { name, author: '本机验收', url: `${origin}/book`, toc: `${origin}/toc`, intro: '临时标题规则验收。' };
http.createServer((request, response) => {
  const path = new URL(request.url, origin).pathname;
  requests.push({ path, method: request.method, time: new Date().toISOString() });
  const send = value => {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  if (path === '/fixture.json') return send({ source, book, firstContent });
  if (path === '/__state') return send({ requests });
  if (path === '/search') return send([book]);
  if (path === '/book') return send(book);
  if (path === '/toc') return send([
    { title, url: `${origin}/chapter/1` },
    { title: '第十二章', url: `${origin}/chapter/2` },
  ]);
  if (path === '/chapter/1') return send({ content: firstContent });
  if (path === '/chapter/2') return send({ content: '十二\n这是实际正文，不能被误认为第十二章标题删除。\n下一段正文。' });
  response.writeHead(404); response.end();
}).listen(18206, '127.0.0.1', () => console.log(`Chapter title fixture ready: ${origin}`));
