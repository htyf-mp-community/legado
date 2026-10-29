import http from 'node:http';
// Dedicated simulator fixture. No fixture strings or data are production inputs.
const port = 18200, origin = `http://127.0.0.1:${port}`, requests = [];
const names = { a: 'iOS批量换源甲', b: 'iOS批量换源乙' }, author = '换源验收作者';
const source = mode => ({
  bookSourceUrl: `${origin}/${mode}`, bookSourceName: `iOS 批量${mode === 'normal' ? '正常' : '慢速'}验收源`,
  bookSourceGroup: 'iOS 批量验收', bookSourceComment: 'batch-source-fixture',
  bookSourceType: 0, customOrder: -120, enabled: true, enabledExplore: false,
  header: '{"X-Batch-Source":"fixture-only"}',
  searchUrl: `${origin}/${mode}/search?key={{key}}`,
  ruleSearch: { bookList: '$[*]', name: '$.name', author: '$.author', bookUrl: '$.url' },
  ruleBookInfo: { name: '$.name', author: '$.author', intro: '$.intro', kind: '$.kind', wordCount: '$.wordCount', tocUrl: '$.toc' },
  ruleToc: { chapterList: '$[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' },
});
const oldTitle = (key, index) => key === 'a' && index === 1 ? '第二章 归途' : key === 'b' && index === 5 ? '第六章 旧标题' : `第${index + 1}章 旧目录`;
const newTitle = (key, index) => key === 'a' && index === 4 ? '第五章 归途' : key === 'b' && index === 9 ? '第6话 全新标题' : `第${index + 101}章 新目录`;
const books = ['a', 'b'].map((key, i) => ({
  id: `ios-batch-source-${key}`, name: names[key], author, origin: `${origin}/old`, originName: '原书源', bookUrl: `${origin}/old/${key}`,
  intro: '原书源简介', customIntro: `私人简介${key}，换源后保留`, customTag: `tag-${key}`,
  sourceType: 0, nativeType: 24, updateError: true, canUpdate: false,
  chapterTitle: oldTitle(key, i ? 5 : 1), currentChapterIndex: i ? 5 : 1,
  chapters: Array.from({ length: i ? 12 : 6 }, (_, index) => ({ id: `old-${key}-${index}`, title: oldTitle(key, index), content: '原书源缓存', url: `${origin}/old/${key}/${index}` })),
  content: '原书源缓存', progress: .35, groupIds: ['1'], order: 70 + i, updatedAt: 1700000000000 + i, durChapterTime: 1690000000000 + i,
  customCoverUrl: `http://localhost:18199/custom.png`, reSegment: true, deleteHeadingTag: true, useReplaceRules: false, reverseToc: true,
}));
const server = http.createServer((req, res) => {
  const u = new URL(req.url, origin), path = u.pathname, header = req.headers['x-batch-source'] === 'fixture-only';
  const record = { time: new Date().toISOString(), method: req.method, path, query: u.search, header };
  requests.push(record); console.log(JSON.stringify(record));
  const send = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  if (path === '/sources') return send([source('normal'), source('slow'), { ...source('normal'), bookSourceUrl: `${origin}/disabled`, bookSourceName: '不应显示的禁用验收源', enabled: false }]);
  if (path === '/books') return send(books);
  if (path === '/__state') return send({ requests });
  if (!header) return send({ error: 'source header required' }, 403);
  const mode = path.split('/')[1], key = path.split('/')[3];
  if (path === `/${mode}/search`) {
    const name = u.searchParams.get('key'), id = Object.keys(names).find(value => names[value] === name);
    const results = id ? [{ name, author: '错误作者', url: `${origin}/${mode}/book/wrong` }, { name, author, url: `${origin}/${mode}/book/${id}` }] : [];
    if (mode !== 'slow') return send(results);
    const timer = setTimeout(() => send(results), 30000);
    res.on('close', () => { clearTimeout(timer); console.log(JSON.stringify({ time: new Date().toISOString(), path, closed: true, finished: res.writableFinished })); });
    return;
  }
  if (/^\/(normal|slow)\/book\/[ab]$/.test(path)) return send({ name: '详情页不同书名', author: '详情页不同作者', intro: `新书源简介${key}`, kind: '验收分类', wordCount: '20万字', toc: `${origin}/${mode}/toc/${key}` });
  if (/^\/(normal|slow)\/toc\/[ab]$/.test(path)) return send(Array.from({ length: 12 }, (_, index) => ({ title: newTitle(key, index), url: `${origin}/${mode}/chapter/${key}/${index}` })));
  if (/^\/(normal|slow)\/chapter\/[ab]\/\d+$/.test(path)) return send({ content: `换源后正文${key} 第${Number(path.split('/')[4]) + 1}章。\n此内容来自新的验收书源。` });
  send({ error: 'not found' }, 404);
});
server.listen(port, '127.0.0.1', () => console.log(`Batch source fixture ready: ${origin}`));
