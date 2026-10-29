import http from 'node:http';
import { deflateSync } from 'node:zlib';
// Local protocol fixture only: synthetic image bytes never enter the production bundle.
const origin = 'http://127.0.0.1:18199';
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name), size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([size, type, data, checksum]);
}
function png(color) {
  const width = 120, height = 160, header = Buffer.alloc(13), rows = Buffer.alloc((width * 3 + 1) * height);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) rows[y * (width * 3 + 1) + 1 + x * 3 + c] = color[c];
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
const sourceImage = png([24, 91, 190]), customImage = png([211, 43, 55]), requests = [];
const source = { bookSourceUrl: origin, bookSourceName: 'iOS 封面验收源', bookSourceType: 0, customOrder: 0, enabled: true, enabledExplore: false, header: '{"X-Cover-Source":"fixture-only"}' };
const book = {
  id: `remote:${encodeURIComponent(origin)}:${encodeURIComponent(origin + '/book')}`,
  bookUrl: origin + '/book', origin, originName: source.bookSourceName,
  name: 'iOS封面验收', author: '封面作者', intro: '仅用于独立 iOS 的封面分层与文件保存验收。',
  coverUrl: origin + '/source.png', customCoverUrl: 'http://localhost:18199/custom.png',
  chapterTitle: '封面验收章', content: '封面操作应保留本文、阅读位置和分组。',
  chapters: [{ id: 'cover-chapter', title: '封面验收章', content: '封面操作应保留本文、阅读位置和分组。', url: origin + '/chapter/1' }],
  currentChapterIndex: 0, progress: .35, groupIds: ['1'], updatedAt: Date.now(), sourceType: 0,
};
const server = http.createServer((req, res) => {
  const path = new URL(req.url, origin).pathname, sourceHeader = req.headers['x-cover-source'] === 'fixture-only';
  requests.push({ time: new Date().toISOString(), path, sourceHeader });
  console.log(`${requests.at(-1).time} ${req.method} ${path} sourceHeader=${sourceHeader}`);
  const send = (value, type = 'application/json', status = 200) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(type === 'application/json' ? JSON.stringify(value) : value); };
  if (path === '/source.json') return send(source);
  if (path === '/book.json') return send(book);
  if (path === '/__state') return send({ requests });
  if (path === '/source.png') return sourceHeader ? send(sourceImage, 'image/png') : send('source header required', 'text/plain', 403);
  if (path === '/custom.png') return sourceHeader ? send('source header leaked', 'text/plain', 403) : send(customImage, 'image/png');
  if (path === '/invalid.png') return send('<html>not an image</html>', 'image/png');
  if (path === '/slow.png') {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
    res.write(customImage.subarray(0, 20));
    const timer = setTimeout(() => res.end(customImage.subarray(20)), 30000);
    res.on('close', () => { clearTimeout(timer); console.log(`${new Date().toISOString()} /slow.png closed finished=${res.writableFinished}`); });
    return;
  }
  if (path === '/chapter/1') return send(book.content, 'text/plain');
  send('not found', 'text/plain', 404);
});
server.listen(18199, '127.0.0.1', () => console.log(`Cover-persistence fixture ready: ${origin}`));
