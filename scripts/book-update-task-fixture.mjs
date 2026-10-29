import http from 'node:http';

const port = 18198, host = `http://127.0.0.1:${port}`;
let chapterCount = 2;
const advances = new Set();
const book = { name: 'iOS书单验收', author: '验收作者', intro: '这是书源返回的简介。', url: `${host}/book` };
const source = {
  bookSourceUrl: host, bookSourceName: 'iOS 书单验收源', customOrder: -100,
  enabled: true, enabledExplore: false, bookSourceType: 0, searchUrl: `${host}/search`,
  ruleSearch: { bookList: '$[*]', name: '$.name', author: '$.author', bookUrl: '$.url', intro: '$.intro' },
  ruleBookInfo: { name: '$.name', author: '$.author', intro: '$.intro', tocUrl: '$.tocUrl' },
  ruleToc: { chapterList: '$[*]', chapterName: '$.title', chapterUrl: '$.url' }, ruleContent: { content: '$.content' },
};
const title = index => ['第一章 书单导入', '第二章 延迟目录', '第三章 定时更新'][index - 1] ?? `第${index}章 定时更新`;
const server = http.createServer((request, response) => {
  const path = new URL(request.url, host).pathname;
  let data;
  if (path === '/__fixture__/advance' && request.method === 'POST') {
    const key = request.headers['x-fixture-advance-id'];
    if (!key || !advances.has(key)) { chapterCount++; if (key) advances.add(key); }
    data = { chapterCount };
  } else if (path === '/__fixture__/state') data = { chapterCount };
  else if (path === '/source') data = source;
  else if (path === '/books.json') data = [{ name: book.name, author: book.author, intro: '此输入简介不应覆盖书源简介。' }];
  else if (path === '/search') data = [{ ...book, author: '错误作者', url: `${host}/wrong-author` }, book];
  else if (path === '/book') data = { ...book, tocUrl: `${host}/toc` };
  else if (path === '/toc') data = Array.from({ length: chapterCount }, (_, index) => ({ title: title(index + 1), url: `${host}/chapter/${index + 1}` }));
  else if (/^\/chapter\/\d+$/.test(path) && Number(path.split('/').at(-1)) <= chapterCount) {
    const index = Number(path.split('/').at(-1));
    data = { content: index === 1 ? '这是从书单精确搜索并加载目录后取得的第一章正文。\n书单本身只包含书名、作者和简介。' : index === 2 ? '这是第二章正文。\n目录、阅读位置和原有分组应继续保留。' : '这段内容来自本地验收书源。\n目录新增章节后，原来的阅读位置和分组应继续保留。' };
  } else { response.writeHead(404); response.end('Not found'); return; }
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(data));
  process.stdout.write(`${new Date().toISOString()} ${request.method} ${path} chapters=${chapterCount}\n`);
});
server.listen(port, '127.0.0.1', () => process.stdout.write(`Book-list/update-task fixture ready: ${host}\n`));
