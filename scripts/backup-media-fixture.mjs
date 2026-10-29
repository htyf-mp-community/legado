import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const port = 18201, root = '/private/tmp/legado-ios-debug/backup-media-fixture', origin = `http://127.0.0.1:${port}`, requests = [];
await mkdir(root, { recursive: true });
const xml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const authorization = 'Basic ' + Buffer.from('fixture:fixture').toString('base64');
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin), authenticated = req.headers.authorization === authorization;
    const event = { time: new Date().toISOString(), method: req.method, path: url.pathname, authenticated };
    requests.push(event); console.log(JSON.stringify(event));
    if (url.pathname === '/__state') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ requests })); return; }
    if (!authenticated) { res.writeHead(401); res.end('fixture credentials required'); return; }
    if (req.method === 'MKCOL') { res.writeHead(201); res.end(); return; }
    if (req.method === 'PROPFIND') {
      const files = await readdir(root), records = [];
      for (const name of files) { const info = await stat(path.join(root, name)); if (info.isFile()) records.push(`<d:response><d:href>/legado/${xml(encodeURIComponent(name))}</d:href><d:propstat><d:prop><d:displayname>${xml(name)}</d:displayname><d:getlastmodified>${info.mtime.toUTCString()}</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`); }
      res.writeHead(207, { 'Content-Type': 'application/xml' }); res.end(`<d:multistatus xmlns:d="DAV:">${records.join('')}</d:multistatus>`); return;
    }
    const name = decodeURIComponent(url.pathname.split('/').at(-1));
    if (url.pathname !== '/legado/' + encodeURIComponent(name) || !name || name !== path.basename(name)) { res.writeHead(404); res.end(); return; }
    const destination = path.join(root, name);
    if (req.method === 'PUT') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk); const bytes = Buffer.concat(chunks); await writeFile(destination, bytes);
      event.bytes = bytes.length; event.contentType = req.headers['content-type']; console.log(JSON.stringify({ uploaded: name, bytes: bytes.length, contentType: event.contentType }));
      res.writeHead(201); res.end(); return;
    }
    if (req.method === 'GET') {
      try { const info = await stat(destination); res.writeHead(200, { 'Content-Type': name.endsWith('.zip') ? 'application/zip' : 'application/json', 'Content-Length': info.size, 'Cache-Control': 'no-store' }); createReadStream(destination).pipe(res); }
      catch { res.writeHead(404); res.end(); } return;
    }
    res.writeHead(405); res.end();
  } catch (error) { res.writeHead(500); res.end(String(error)); }
}).listen(port, '127.0.0.1', () => console.log(`Backup-media WebDAV fixture: ${origin}; fixture credentials only`));
