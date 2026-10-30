import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Disposable loopback WebDAV fixture. Only the staged, three-key partial backup is served.
// Never serve the full diagnostic exports or log Authorization/header/body contents.
const root = '/private/tmp/legado-ios-debug/backup-value-types';
const requests = [];
const authorization = 'Basic ' + Buffer.from('fixture:fixture').toString('base64');
http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:18201');
  if (url.pathname === '/__state') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ requests })); return;
  }
  const stage = JSON.parse(fs.readFileSync(path.join(root, 'active.json'), 'utf8'));
  const authenticated = request.headers.authorization === authorization;
  const event = { time: new Date().toISOString(), method: request.method, path: url.pathname, stage: stage.name, authenticated };
  requests.push(event);
  if (!authenticated) { event.status = 401; response.writeHead(401); response.end(); return; }
  if (request.method === 'MKCOL') { event.status = 201; response.writeHead(201); response.end(); return; }
  if (request.method === 'PROPFIND' && url.pathname === '/legado/') {
    event.status = 207; response.writeHead(207, { 'Content-Type': 'application/xml' });
    response.end('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/legado/backup-htyf.json</d:href><d:propstat><d:prop><d:displayname>backup-htyf.json</d:displayname><d:getlastmodified>Fri, 30 Oct 2026 00:00:00 GMT</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>'); return;
  }
  if (request.method === 'GET' && url.pathname === '/legado/backup-htyf.json') {
    const raw = JSON.stringify(stage.payload);
    if (Object.keys(stage.payload.entries).length !== 3) throw new Error('Fixture must remain a three-key partial backup');
    event.status = 200; event.sha256 = crypto.createHash('sha256').update(raw).digest('hex');
    response.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' }); response.end(raw); return;
  }
  event.status = 404; response.writeHead(404); response.end();
}).listen(18201, '127.0.0.1', () => console.log('Typed-backup fixture ready on 127.0.0.1:18201'));
