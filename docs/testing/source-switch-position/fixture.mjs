import http from 'node:http';
import { writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:18222';
const requests = [];
const events = [];
let delayNextToc = '';
async function logEvent(path, event) {
  events.push({ path, event, at: Date.now() });
  await writeFile('/private/tmp/legado-source-switch-events.json', JSON.stringify(events));
}
const sources = ['a', 'b'].map(part => ({
  bookSourceUrl: `${base}/${part}`,
  bookSourceName: `iOS 换源位置${part.toUpperCase()}`,
  bookSourceType: 0, customOrder: 0, enabled: true, enabledExplore: false,
  searchUrl: `${base}/${part}/search?key={{key}}`,
  ruleSearch: { bookList: 'class.book', name: 'tag.a@text', author: 'class.author@text', bookUrl: 'tag.a@href' },
  ruleBookInfo: { name: 'tag.h1@text', author: 'class.author@text', tocUrl: 'class.toc@href' },
  ruleToc: { chapterList: 'class.chapters@tag.li', chapterName: 'tag.a@text', chapterUrl: 'tag.a@href' },
  ruleContent: { content: 'class.content@html' },
}));
const chapterText = Array.from({ length: 60 }, (_, i) =>
  `<p>第${String(i + 1).padStart(3, '0')}段：山风吹过林间，读者沿着小路继续前行。这是一段用于核对换源后阅读位置的正文。</p>`,
).join('');
http.createServer(async (req, res) => {
  const path = new URL(req.url, base).pathname;
  requests.push(path);
  await writeFile('/private/tmp/legado-source-switch-requests.json', JSON.stringify(requests));
  if (path === '/control/slow-toc' || path === '/control/slow-stale') {
    delayNextToc = path.endsWith('slow-stale') ? 'stale' : 'normal';
    res.writeHead(200); res.end('armed'); return;
  }
  if (path === '/sources.json') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(sources)); return; }
  const match = /^\/(a|b)\/(search|book|toc|chapter\/\d+)$/.exec(path);
  if (!match) { res.writeHead(404); res.end(); return; }
  const [, part, page] = match;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  if (page === 'search') { res.end(`<div class="book"><a href="/${part}/book">换源位置验收书</a><span class="author">验收作者</span></div>`); return; }
  if (page === 'book') { res.end(`<h1>换源位置验收书</h1><p class="author">验收作者</p><a class="toc" href="/${part}/toc">目录</a>`); return; }
  if (page === 'toc') {
    let stale = false;
    if (part === 'b' && delayNextToc) {
      stale = delayNextToc === 'stale';
      delayNextToc = '';
      await logEvent(path, stale ? 'slow-stale-start' : 'slow-start');
      await new Promise(resolve => setTimeout(resolve, 12000));
      await logEvent(path, stale ? 'slow-stale-finish' : 'slow-finish');
    } else {
      await logEvent(path, 'fast');
    }
    const prologue = part === 'b' ? `<li><a href="/${part}/chapter/0">前言</a></li>` : '';
    res.end(`<ul class="chapters">${prologue}<li><a href="/${part}/chapter/1">${stale ? '第一章旧结果' : '第一章'}</a></li><li><a href="/${part}/chapter/2">${stale ? '第二章旧结果' : '第二章'}</a></li></ul>`); return;
  }
  res.end(`<div class="content">${chapterText}</div>`);
}).listen(18222, '127.0.0.1', () => console.log('source-switch fixture 127.0.0.1:18222'));
