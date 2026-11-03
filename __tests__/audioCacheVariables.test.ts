import { prepareAudioCacheRange } from '../src/core/audioCache';
import type { Book } from '../src/types';

const book: Book = {id:'book',name:'书',author:'',intro:'',chapterTitle:'甲',content:'',progress:0,updatedAt:1,
  variable:'{"base":"1"}',chapters:[
    {id:'1',title:'甲',url:'/1',content:'',variable:'{"chapter":"one"}'},
    {id:'2',title:'乙',url:'/2',content:'',variable:'{"chapter":"two"}'},
  ]};

test('audio cache loads chapters in order and retains their variable changes', async () => {
  const seen: Array<string | undefined> = [];
  const result = await prepareAudioCacheRange(book,0,1,async (_chapter,index,bookVariable) => {
    seen.push(bookVariable);
    return {content:`https://audio.test/${index}`,variable:JSON.stringify({saved:String(index)}),
      bookVariable:JSON.stringify({...JSON.parse(bookVariable!),[`key${index}`]:'value'})};
  });
  expect(seen.map(value => JSON.parse(value!))).toEqual([{base:'1'},{base:'1',key0:'value'}]);
  expect(JSON.parse(result.book.variable!)).toEqual({base:'1',key0:'value',key1:'value'});
  expect(result.book.chapters!.map(chapter => JSON.parse(chapter.variable!).saved)).toEqual(['0','1']);
  expect(result.entries.map(item => item.content)).toEqual(['https://audio.test/0','https://audio.test/1']);
  expect(JSON.parse(book.variable!).base).toBe('1');
});
