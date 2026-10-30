import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Disposable native-ZIP WebDAV fixture. Serves staged test bytes only, never private exports.
const root = '/private/tmp/legado-ios-debug/read-record-import';
const authorization = 'Basic ' + Buffer.from('fixture:fixture').toString('base64');
const requests = [];
http.createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1:18201').pathname;
  const send = (status, type, body) => {
    response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    response.end(body);
  };
  if (path === '/__state') return send(200, 'application/json', JSON.stringify({ requests }));
  const stage = JSON.parse(fs.readFileSync(root + '/active.json', 'utf8')).name;
  if (!['null-item', 'fraction', 'null-author', 'valid-duplicate'].includes(stage)) throw Error('Unexpected stage');
  const event = { time: new Date().toISOString(), method: request.method, path, stage };
  requests.push(event);
  if (request.headers.authorization !== authorization) { event.status = 401; return send(401, 'text/plain', ''); }
  if (request.method === 'MKCOL') { event.status = 201; return send(201, 'text/plain', ''); }
  if (request.method === 'PROPFIND' && path === '/legado/') {
    event.status = 207;
    return send(207, 'application/xml', '<d:multistatus xmlns:d="DAV:"><d:response><d:href>/legado/backup-htyf.zip</d:href><d:propstat><d:prop><d:displayname>backup-htyf.zip</d:displayname><d:getlastmodified>Fri, 30 Oct 2026 00:00:00 GMT</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>');
  }
  if (request.method === 'GET' && path === '/legado/backup-htyf.zip') {
    const body = fs.readFileSync(root + '/' + stage + '.zip');
    event.status = 200; event.sha256 = crypto.createHash('sha256').update(body).digest('hex');
    return send(200, 'application/zip', body);
  }
  event.status = 404; send(404, 'text/plain', '');
}).listen(18201, '127.0.0.1', () => console.log('Read-record import fixture ready on 127.0.0.1:18201'));
