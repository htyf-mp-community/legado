import http from 'node:http';
import fs from 'node:fs';

// Disposable iOS loopback fixture, excluded from all production input lists.
const origin = 'http://127.0.0.1:18212';
const gold = JSON.parse(fs.readFileSync(new URL('../__tests__/fixtures/sourceUrl.native.json', import.meta.url), 'utf8'));
const expectedForm = gold.cases.find(row => row.kind === 'params' && !row.isQuery && row.charset === 'GBK' && row.value === 'q=iOS 表单验收&literal=%20&raw=+').expected;
const requests = [];
let retrySent = 0;
const common = { bookSourceType: 0, customOrder: 9999, enabled: true, enabledExplore: false,
  ruleSearch: { bookList: '$[*]', name: '$.name', author: '$.author', bookUrl: '$.url', coverUrl: '$.cover' },
  ruleBookInfo: { name: '$.name', author: '$.author', tocUrl: '$.toc', intro: '$.intro', coverUrl: '$.cover' },
  ruleToc: { chapterList: '$[*]', chapterName: '$.title', chapterUrl: '$.url' }, ruleContent: { content: '$.content' } };
const sources = [
  { ...common, bookSourceUrl: origin, bookSourceName: 'iOS 地址验收（临时）', searchUrl: `${origin}/find/list?q={{key}}` },
  { ...common, bookSourceUrl: `${origin}/form`, bookSourceName: 'iOS 表单验收（临时）', searchUrl: `${origin}/form/search,${JSON.stringify({ method: 'POST', charset: 'GBK', body: 'q={{key}}&literal=%20&raw=+' })}` },
];
const books = Object.fromEntries(['get', 'form'].map(key => [key, {
  name: key === 'get' ? 'iOS 地址验收' : 'iOS 表单验收', author: '本机验收', url: `../book/${key}`, toc: `../toc/${key}`,
  cover: '../assets/封面 空格.png', intro: '临时验证含空格查询、相对地址、图片及 GBK 表单/UTF-8 响应。',
}]));
const toc = key => [
  { title: '第一章 地址链路', url: `../text/第一 章?book=${key}&literal=searchKey` },
  { title: '第二章 编码边界', url: `../text/second?book=${key}&space=a b&currency=€` },
];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
http.createServer(async (request, response) => {
  let body = ''; for await (const chunk of request) body += chunk.toString('utf8');
  const url = new URL(request.url, origin), path = decodeURIComponent(url.pathname);
  const entry = { rawUrl: request.url, path, method: request.method, body, contentType: request.headers['content-type'], time: new Date().toISOString() };
  requests.push(entry);
  const send = (value, status = 200) => { entry.status = status; response.writeHead(status, { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  if (path === '/fixture.json') return send({ sources, books, expectedForm });
  if (path === '/__state') return send({ requests });
  if (path === '/find/list') {
    entry.valid = url.searchParams.get('q') === books.get.name;
    if (entry.valid && retrySent++ < 2) return send({ retryFixture: true }, 404);
    return send(entry.valid ? [books.get] : [], entry.valid ? 200 : 422);
  }
  if (path === '/form/search') {
    entry.valid = request.method === 'POST' && body === expectedForm && request.headers['content-type']?.replace(/\s/g, '').toLowerCase() === 'application/x-www-form-urlencoded;charset=utf-8';
    return send(entry.valid ? [books.form] : [], entry.valid ? 200 : 422);
  }
  const book = path.match(/^\/book\/(get|form)$/);
  if (book) return send(books[book[1]]);
  const catalog = path.match(/^\/toc\/(get|form)$/);
  if (catalog) return send(toc(catalog[1]));
  if (path === '/text/第一 章') {
    entry.valid = url.searchParams.get('literal') === 'searchKey';
    if (!entry.valid) return send({ error: 'Literal chapter query was rewritten' }, 422);
    return send({ content: `<p>第一章 地址链路</p><p>${books[url.searchParams.get('book')]?.name}。带空格查询和相对地址均已抵达正确正文。</p><img src="../assets/图片 空格.png"><p>第一章结束。</p>` });
  }
  if (path === '/text/second') {
    entry.valid = url.searchParams.get('space') === 'a b' && url.searchParams.get('currency') === '€';
    if (!entry.valid) return send({ error: 'Chapter query encoding mismatch' }, 422);
    return send({ content: '<p>第二章 编码边界</p><p>空格参数：a b。货币参数：€。第二章加载成功。</p>' });
  }
  if (path.startsWith('/assets/')) { response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }); response.end(png); return; }
  send({ error: 'Unexpected fixture path' }, 404);
}).listen(18212, '127.0.0.1', () => console.log(`Source URL fixture ready: ${origin}`));
