import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Disposable loopback-only native-backup and reader fixture; no private exports are served.
const root = '/private/tmp/legado-ios-debug/read-records';
const origin = 'http://127.0.0.1:18201/record-test';
const requests = [];
const auth = 'Basic ' + Buffer.from('fixture:fixture').toString('base64');
http.createServer((request, response) => {
  const path = new URL(request.url, origin).pathname;
  const send = (status, type, body) => {
    response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    response.end(body);
  };
  if (path === '/__state') return send(200, 'application/json', JSON.stringify({ requests }));
  const event = { time: new Date().toISOString(), method: request.method, path };
  requests.push(event);
  if (path.startsWith('/record-test/')) {
    event.status = 200;
    if (path === '/record-test/book') return send(200, 'application/json', JSON.stringify({ name: 'iOS 记录计时验收', author: '本机验收', toc: origin + '/toc' }));
    if (path === '/record-test/toc') return send(200, 'application/json', JSON.stringify([{ title: '第一章 计时验证', url: origin + '/chapter/1' }]));
    if (path === '/record-test/chapter/1') return send(200, 'application/json', JSON.stringify({ content: '<p>第一章 计时验证</p><p>这是独立 iOS 模拟器中的阅读计时验收正文。关闭记录后不新增本机计时，开启记录后保留远端计数并单独累计。</p>' }));
  }
  if (request.headers.authorization !== auth) { event.status = 401; return send(401, 'text/plain', ''); }
  if (request.method === 'MKCOL') { event.status = 201; return send(201, 'text/plain', ''); }
  if (request.method === 'PROPFIND' && path === '/legado/') {
    event.status = 207;
    return send(207, 'application/xml', '<d:multistatus xmlns:d="DAV:"><d:response><d:href>/legado/backup-htyf.zip</d:href><d:propstat><d:prop><d:displayname>backup-htyf.zip</d:displayname><d:getlastmodified>Fri, 30 Oct 2026 00:00:00 GMT</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>');
  }
  if (request.method === 'GET' && path === '/legado/backup-htyf.zip') {
    const body = fs.readFileSync(root + '/native-fixture.zip');
    event.status = 200; event.sha256 = crypto.createHash('sha256').update(body).digest('hex');
    return send(200, 'application/zip', body);
  }
  event.status = 404; send(404, 'text/plain', '');
}).listen(18201, '127.0.0.1', () => console.log('Read-record fixture ready on 127.0.0.1:18201'));
