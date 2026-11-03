import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
const root = '/private/tmp/legado-webfile-native-fixture';
const requests = [];
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  requests.push({ method: req.method, path, fixtureHeader: req.headers['x-legado-fixture'] === 'allowed' });
  await writeFile(`${root}/requests.json`, JSON.stringify(requests, null, 2));
  if (req.method !== 'GET' || req.headers['x-legado-fixture'] !== 'allowed' || !['/native.epub', '/native.mobi'].includes(path)) { res.writeHead(403); res.end(); return; }
  try { const body = await readFile(`${root}${path}`); res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': body.length }); res.end(body); }
  catch { res.writeHead(500); res.end(); }
});
server.listen(18216, '127.0.0.1', () => console.log('fixture 127.0.0.1:18216'));
