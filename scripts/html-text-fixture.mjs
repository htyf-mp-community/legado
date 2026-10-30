import http from 'node:http';

// Loopback-only acceptance fixture; never imported by the production entry.
const port = 18204;
const origin = `http://127.0.0.1:${port}`;
const requests = [];
const html =
  '<div id="x"> 第一段 <b>跳过注释</b> 第二段\n  续行 <script>不要混入</script> 第三段 </div>';
const expectedText = '第一段\n第二段 续行\n第三段';
const source = {
  bookSourceUrl: origin,
  bookSourceName: 'iOS 文本提取验收（临时）',
  bookSourceType: 0,
  customOrder: 9999,
  enabled: true,
  enabledExplore: false,
  searchUrl: `${origin}/search?q={{key}}`,
  ruleSearch: {
    bookList: '$[*]',
    name: '$.name',
    author: '$.author',
    bookUrl: '$.url',
  },
  ruleBookInfo: { name: '$.name', author: '$.author', tocUrl: '$.toc' },
  ruleToc: { chapterList: '$[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '#x@textNodes' },
};
const book = {
  name: 'iOS 段落提取验收',
  author: '本机验收',
  url: `${origin}/book`,
  toc: `${origin}/toc`,
};
http
  .createServer((request, response) => {
    const path = new URL(request.url, origin).pathname;
    requests.push({
      path,
      method: request.method,
      time: new Date().toISOString(),
    });
    const send = value => {
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(JSON.stringify(value));
    };
    if (path === '/fixture.json')
      return send({ source, expectedText, expectedChars: expectedText.length });
    if (path === '/__state') return send({ requests });
    if (path === '/search') return send([book]);
    if (path === '/book') return send(book);
    if (path === '/toc')
      return send([{ title: '第一章 三段文本', url: `${origin}/chapter` }]);
    if (path === '/chapter') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      return response.end(html);
    }
    response.writeHead(404);
    response.end();
  })
  .listen(port, '127.0.0.1', () =>
    console.log(`HTML text fixture ready: ${origin}`),
  );
