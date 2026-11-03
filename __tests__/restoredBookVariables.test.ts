jest.mock('react-native-mmkv', () => ({createMMKV: () => ({getString:jest.fn(),set:jest.fn(),remove:jest.fn()})}));
jest.mock('../src/core/sourceRequest', () => ({
  buildSourcePageRequest: jest.fn((_source,url) => ({url})), executeSourceRequest:jest.fn(),
}));
jest.mock('../src/data/generalPreferences', () => ({loadGeneralPreferences: () => ({threadCount:1,tocCountWords:false})}));

import {convertLegacyBackup} from '../src/data/legacyBackup';
import {executeSourceRequest} from '../src/core/sourceRequest';
import {loadBookInfo,loadChapters} from '../src/core/webBook';
import {applyBookCatalogue,fetchBookCatalogue} from '../src/core/bookCatalogue';
import type {Book,BookSource} from '../src/types';

test('native backup book variables remain available while loading the restored directory', async () => {
  const variable = '{"token":"恢复值"}';
  const source: BookSource = {bookSourceUrl:'https://source.test',bookSourceName:'源',bookSourceType:0,
    customOrder:0,enabled:true,enabledExplore:true,ruleToc:{chapterList:'$.items[*]',
      chapterName:'@js:java.get("token")+":"+result.name',chapterUrl:'$.url'}};
  const backup = convertLegacyBackup({'bookshelf.json': JSON.stringify([{bookUrl:'https://source.test/book',
    tocUrl:'https://source.test/toc',origin:source.bookSourceUrl,name:'书',variable}])});
  const restored: Book = JSON.parse(String(backup.payload.entries['library.v1'].value))[0];
  jest.mocked(executeSourceRequest).mockResolvedValue({url:'https://source.test/toc',data:{items:[{name:'第一章',url:'/1'}]}});
  const {info,chapters} = await fetchBookCatalogue(restored,source,loadBookInfo,loadChapters);
  const ready = applyBookCatalogue(restored,restored,info,chapters);
  expect(ready.variable).toBe(variable);
  expect(ready.chapters?.[0].title).toBe('恢复值:第一章');
});
