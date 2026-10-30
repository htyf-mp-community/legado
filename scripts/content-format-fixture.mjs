import http from 'node:http';

// Loopback-only acceptance source. This file is not a production input.
const port = 18205;
const origin = `http://127.0.0.1:${port}`;
const requests = [];
const content = '<div>段落甲，独立成行。</div><div>段落乙，继续独立成行。</div>'
  + '<p>字面标签 &lt;b&gt;丙&lt;/b&gt;。</p>'
  + Array.from({ length: 50 }, (_, i) => `<div>第${i + 1}段。这是用于验证单换行段落缩进、分页与滚动续读的本机测试文字。每一段都应独立显示，阅读进度应恢复到相同文字。</div>`).join('');
const source = {
  bookSourceUrl: origin,
  bookSourceName: 'iOS 正文格式验收（临时）',
  bookSourceType: 0,
  customOrder: 9999,
  enabled: true,
  enabledExplore: false,
  searchUrl: `${origin}/search?q={{key}}`,
  ruleSearch: { bookList: '$[*]', name: '$.name', author: '$.author', bookUrl: '$.url' },
  ruleBookInfo: { name: '$.name', author: '$.author', tocUrl: '$.toc' },
  ruleToc: { chapterList: '$[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' },
};
const book = { name: 'iOS 正文格式验收', author: '本机验收', url: `${origin}/book`, toc: `${origin}/toc` };
http.createServer((request, response) => {
  const path = new URL(request.url, origin).pathname;
  requests.push({ path, method: request.method, time: new Date().toISOString() });
  const send = value => {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  if (path === '/fixture.json') return send({ source, book, content });
  if (path === '/__state') return send({ requests });
  if (path === '/search') return send([book]);
  if (path === '/book') return send(book);
  if (path === '/toc') return send([
    { title: '第一章 段落与字面标签', url: `${origin}/chapter/1` },
    { title: '第二章 后续正文', url: `${origin}/chapter/2` },
  ]);
  if (path === '/chapter/1') return send({ content });
  if (path === '/chapter/2') return send({ content: '<div>第二章第一段。</div><div>第二章第二段。</div>' });
  response.writeHead(404); response.end();
}).listen(port, '127.0.0.1', () => console.log(`Content format fixture ready: ${origin}`));
