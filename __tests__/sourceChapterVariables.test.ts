jest.mock('../src/data/storage', () => ({ appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() } }));
jest.mock('../src/core/sourceRequest', () => ({
  buildSourcePageRequest: jest.fn((_source, url) => ({ url })),
  executeSourceRequest: jest.fn(),
}));
jest.mock('../src/data/generalPreferences', () => ({ loadGeneralPreferences: () => ({ threadCount: 2, tocCountWords: false }) }));

import { executeSourceRequest } from '../src/core/sourceRequest';
import { loadChapterContent, loadChapterPayload, loadChapters } from '../src/core/webBook';
import { toLibraryBook } from '../src/core/onlineLibrary';
import { refreshReaderChapter, refreshReaderToc } from '../src/core/readerRefresh';
import { refreshBookshelf } from '../src/core/bookshelfRefresh';
import { applyBookUpdate } from '../src/core/bookUpdate';
import type { BookSource, SearchBook } from '../src/types';

const request = executeSourceRequest as jest.MockedFunction<typeof executeSourceRequest>;
const source: BookSource = {
  bookSourceUrl: 'https://source.test', bookSourceName: '测试', bookSourceType: 0,
  customOrder: 0, enabled: true, enabledExplore: true,
  ruleToc: { chapterList: '$.items[*]',
    chapterName: '@js:java.put("chapterKey", result.name); result.name',
    chapterUrl: '@js:"/"+java.get("chapterKey")',
    updateTime: '@js:java.get("bookKey")+":"+java.get("chapterKey")' },
  ruleContent: { content: '@js:java.get("bookKey")+":"+java.get("chapterKey")+":"+java.get("title")' },
};
const book: SearchBook = {
  origin: source.bookSourceUrl, originName: source.bookSourceName, name: '书', author: '',
  bookUrl: 'https://source.test/book', tocUrl: 'https://source.test/toc', variable: '{"bookKey":"书变量"}',
};
beforeEach(() => request.mockReset());

test('chapter rules inherit book variables and keep chapter writes isolated through bookshelf reading', async () => {
  request.mockImplementation(async input => ({ url: input.url, data: input.url === book.tocUrl
    ? { items: [{name:'甲'}, {name:'乙'}] } : '<p>正文</p>' }));
  const chapters = await loadChapters(source, book);
  expect(chapters.map(chapter => [chapter.url, chapter.tag])).toEqual([
    ['https://source.test/甲', '书变量:甲'], ['https://source.test/乙', '书变量:乙'],
  ]);
  expect(chapters.map(chapter => JSON.parse(chapter.variable!).chapterKey)).toEqual(['甲', '乙']);
  const libraryBook = toLibraryBook(book, chapters);
  const read = await refreshReaderChapter(libraryBook, 1, source);
  expect(read.content).toContain('书变量:乙:乙');
});

test('chapter values override book values but empty chapter values fall back to the book', async () => {
  request.mockResolvedValue({url:'https://source.test/1', data:'<p>正文</p>'});
  const chapter = {url:'https://source.test/1', title:'标题', index:0, bookUrl:book.bookUrl,
    baseUrl:book.tocUrl!, isVolume:false, isVip:false, isPay:false,
    variable:'{"bookKey":"章节值","chapterKey":""}', bookVariable:'{"bookKey":"书值","chapterKey":"回退值"}'};
  expect(await loadChapterContent(source, chapter)).toContain('章节值:回退值:标题');
});

test('the update-time rule can set a variable consumed by the volume rule', async () => {
  const scripted = { ...source, ruleToc: { ...source.ruleToc,
    updateTime: '@js:java.put("volume", "1"); ""', isVolume: '@js:java.get("volume")' } };
  request.mockResolvedValue({ url: book.tocUrl!, data: { items: [{name:'卷一'}] } });
  expect((await loadChapters(scripted, book))[0].isVolume).toBe(true);
});

test('directory list and next-page rules update shared book variables before each chapter', async () => {
  const scripted = { ...source, ruleToc: {
    chapterList: '@js:java.put("phase",java.get("phase")+"L"); result.items',
    nextTocUrl: '@js:java.put("phase",java.get("phase")+"N"); result.next',
    chapterName: '@js:result.name+java.get("phase")', chapterUrl: '$.url',
  } };
  request.mockImplementation(async input => ({ url: input.url, data: input.url === book.tocUrl
    ? { items: [{name:'甲',url:'/1'}], next:'/p2' }
    : { items: [{name:'乙',url:'/2'}], next:'' } }));
  const selected = {...book};
  const chapters = await loadChapters(scripted, selected);
  expect(chapters.map(item => item.title)).toEqual(['甲LN', '乙LNLN']);
  expect(JSON.parse(selected.variable!).phase).toBe('LNLN');
});

test('concurrent directory pages do not evaluate their next-page rule', async () => {
  const scripted = { ...source, ruleToc: {
    chapterList: '$.items[*]', chapterName: '$.name', chapterUrl: '$.url',
    nextTocUrl: '@js:if(!result.next)throw "unexpected next-page evaluation"; result.next',
  } };
  request.mockImplementation(async input => ({ url: input.url, data: input.url === book.tocUrl
    ? { items: [{name:'甲',url:'/1'}], next:['/p2','/p3'] }
    : { items: [{name:input.url.endsWith('/p2')?'乙':'丙',url:input.url}] } }));
  expect((await loadChapters(scripted, {...book})).map(item => item.title)).toEqual(['甲','乙','丙']);
});

test('directory rule changes reach the reader and refreshed bookshelf', async () => {
  const scripted = { ...source, ruleToc: {
    chapterList: '@js:java.put("token", "new"); result.items', chapterName: '$.name', chapterUrl: '$.url',
  } };
  request.mockResolvedValue({ url: book.tocUrl!, data: { items: [{name:'甲',url:'/1'}] } });
  const saved = toLibraryBook(book, []);
  const reader = await refreshReaderToc(saved, scripted);
  expect(JSON.parse(reader.variable!).token).toBe('new');
  const shelf = await refreshBookshelf([saved], [scripted], {concurrency:1,onlyUpdateRead:false});
  expect(JSON.parse(shelf.books[0].variable!).token).toBe('new');
});

test('a delayed directory variable update cannot overwrite a newly selected source', () => {
  const before = toLibraryBook(book, []);
  const current = {...before, origin:'https://other.test', variable:'{"other":"value"}'};
  const stale = {...before, variable:'{"oldSource":"value"}'};
  expect(applyBookUpdate(current, before, stale).variable).toBe(current.variable);
  expect(JSON.parse(applyBookUpdate({...before, variable:'{"newer":"value"}'}, before, stale).variable!)).toEqual({newer:'value',oldSource:'value'});
});

test('content login check and rule writes are saved with the chapter on reader refresh', async () => {
  const scripted = { ...source,
    loginCheckJs: 'if(java.get("chapterKey")!=="原章节"||java.get("bookKey")!=="书变量"||java.get("title")!=="甲")throw "missing scope"; java.put("checked","通过"); result;',
    ruleContent: {content:'@js:java.put("saved",java.get("checked")); "正文"'} };
  request.mockResolvedValue({url:'https://source.test/1',data:'<p>正文</p>',body:'<p>正文</p>',code:200});
  const remote = {url:'https://source.test/1',title:'甲',index:0,bookUrl:book.bookUrl,baseUrl:book.tocUrl!,
    isVolume:false,isVip:false,isPay:false,variable:'{"chapterKey":"原章节"}'};
  const saved = toLibraryBook(book, [remote]);
  const result = await refreshReaderChapter(saved, 0, scripted);
  expect(result.content).toContain('正文');
  expect(JSON.parse(result.chapters![0].variable!)).toMatchObject({chapterKey:'原章节',checked:'通过',saved:'通过'});
  expect(JSON.parse(saved.chapters![0].variable!)).toEqual({chapterKey:'原章节'});
});

test('failed content parsing does not return an updated chapter variable', async () => {
  const scripted = {...source,ruleContent:{content:'@js:java.put("saved","new"); ""'}};
  request.mockResolvedValue({url:'https://source.test/1',data:'<p>正文</p>'});
  const chapter = {url:'https://source.test/1',title:'甲',index:0,bookUrl:book.bookUrl,baseUrl:book.tocUrl!,
    isVolume:false,isVip:false,isPay:false,variable:'{"saved":"old"}'};
  await expect(loadChapterPayload(scripted, chapter)).rejects.toThrow('正文为空');
  expect(JSON.parse(chapter.variable).saved).toBe('old');
});

test('delayed content updates do not overwrite newer chapter variables', () => {
  const before = toLibraryBook(book, [{url:'https://source.test/1',title:'甲',index:0,bookUrl:book.bookUrl,
    baseUrl:book.tocUrl!,isVolume:false,isVip:false,isPay:false,variable:'{"v":"old"}'}]);
  const current = {...before,chapters:before.chapters!.map(chapter => ({...chapter,variable:'{"v":"newer"}'}))};
  const stale = {...before,chapters:before.chapters!.map(chapter => ({...chapter,content:'正文',variable:'{"v":"stale"}'}))};
  expect(applyBookUpdate(current,before,stale).chapters![0]).toMatchObject({content:'正文',variable:'{"v":"newer"}'});
});

test('delayed book-variable updates preserve newer conflicts and merge unrelated keys', () => {
  const before = {...toLibraryBook(book, []),variable:'{"shared":"old","base":"1"}'};
  const current = {...before,variable:'{"shared":"newer","base":"1","current":"2"}'};
  const stale = {...before,variable:'{"shared":"stale","base":"1","incoming":"3"}'};
  expect(JSON.parse(applyBookUpdate(current,before,stale).variable!)).toEqual({shared:'newer',base:'1',current:'2',incoming:'3'});
});

test('damaged newer book variables are not replaced by an older asynchronous result', () => {
  const before = {...toLibraryBook(book, []),variable:'{"base":"1"}'};
  const current = {...before,variable:'{bad json'};
  const stale = {...before,variable:'{"base":"1","incoming":"3"}'};
  expect(applyBookUpdate(current,before,stale).variable).toBe('{bad json');
});
