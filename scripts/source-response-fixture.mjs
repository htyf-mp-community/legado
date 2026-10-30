import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import iconv from 'iconv-lite';

// Disposable loopback fixture; reads the same independently verified byte corpus.
const origin = 'http://127.0.0.1:18213';
const corpus = JSON.parse(fs.readFileSync(new URL('../__tests__/fixtures/sourceResponse.native.json', import.meta.url), 'utf8'));
const rows = Object.fromEntries(['search', 'info', 'toc', 'content'].map(stage => [stage, corpus.cases.find(row => row.label === `http/${stage}`)]));
if (Object.values(rows).some(row => !row || row.icuError)) throw new Error('Generate the native HTTP byte corpus first');
const source = {
  bookSourceUrl: origin, bookSourceName: 'iOS 编码验收（临时）', bookSourceType: 0, customOrder: 9999, enabled: true, enabledExplore: false,
  searchUrl: `${origin}/search?q={{key}},{"charset":"GBK"}`,
  ruleSearch: { bookList: '$[*]', name: '$.name', author: '$.author', bookUrl: '$.url', intro: '$.intro' },
  ruleBookInfo: { name: 'h1@text', author: '.author@text', tocUrl: 'a.toc@href', intro: '.intro@text' },
  ruleToc: { chapterList: 'li', chapterName: 'a@text', chapterUrl: 'a@href' }, ruleContent: { content: '#content@html' },
};
const expectedQuery = [...iconv.encode('编码验收', 'GBK')].map(byte => `%${byte.toString(16).toUpperCase()}`).join('');
const requests = [];
http.createServer((request, response) => {
  const url = new URL(request.url, origin);
  const json = value => { response.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  if (url.pathname === '/fixture.json') return json([source]);
  if (url.pathname === '/__state') return json({ requests });
  const stage = url.pathname === '/search' ? 'search' : url.pathname === '/book' ? 'info' : url.pathname === '/toc' ? 'toc' : url.pathname.startsWith('/chapter/') ? 'content' : undefined;
  const row = rows[stage], valid = !!row && (stage !== 'search' || url.search === `?q=${expectedQuery}`);
  const entry = { time: new Date().toISOString(), rawUrl: request.url, method: request.method, stage, valid, status: valid ? 200 : 422 };
  requests.push(entry);
  if (!valid) { response.writeHead(422, { 'Content-Type': 'text/plain; charset=UTF-8' }); response.end('Unexpected path or query bytes'); return; }
  const bytes = Buffer.from(row.base64, 'base64');
  entry.contentType = row.contentType; entry.byteCount = bytes.length; entry.bodySha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  response.writeHead(200, { 'Content-Type': row.contentType, 'Content-Length': bytes.length, 'Cache-Control': 'no-store' }); response.end(bytes);
}).listen(18213, '127.0.0.1', () => console.log(`Source response fixture ready: ${origin}`));
