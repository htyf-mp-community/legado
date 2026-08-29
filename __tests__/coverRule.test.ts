jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn(), remove: jest.fn() }) }));
import { parseCoverRule } from '../src/data/coverRule';
import { searchBookCover } from '../src/core/coverRule';
const book = { id:'1',name:'测试书',author:'作者',intro:'',chapterTitle:'',content:'',progress:0,updatedAt:0 };
describe('cover rule', () => {
  it('preserves Android cover fields', () => expect(parseCoverRule('{"enable":true,"searchUrl":"https://x?q={{key}}","coverRule":"$.data.cover","enabledCookieJar":true}')).toMatchObject({ enable:true, enabledCookieJar:true }));
  it('requests and extracts an absolute cover URL', async () => { globalThis.fetch = jest.fn().mockResolvedValue({ ok:true, url:'https://x/search', headers:{ get:()=>null }, text:async()=>'{"data":{"cover":"/a.jpg"}}' }); await expect(searchBookCover(book, parseCoverRule('{"enable":true,"searchUrl":"https://x?q={{key}}","coverRule":"$.data.cover"}'))).resolves.toBe('https://x/a.jpg'); });
});
