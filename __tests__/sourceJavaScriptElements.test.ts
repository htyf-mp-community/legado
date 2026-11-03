jest.mock('../src/data/storage',()=>({appStorage:{getString:jest.fn(),set:jest.fn(),remove:jest.fn()}}));
import fixture from './fixtures/source-1321-ersan-toc.json';
import biquge from './fixtures/source-1321-biquge-select.json';
import {parseChapters} from '../src/core/webBook';
import {sourceRuleText,sourceRuleValues} from '../src/core/sourceRule';
import type {BookSource,SearchBook} from '../src/types';

test('runs the original 1321 二三中文 directory rule using element lists', () => {
  const source: BookSource={...fixture,bookSourceType:0,customOrder:0,enabled:true,enabledExplore:true};
  const book: SearchBook={bookUrl:source.bookSourceUrl+'/book',origin:source.bookSourceUrl,originName:source.bookSourceName,name:'书',author:''};
  const html='<div class="directoryArea"><p><a href="/skip">目录</a><a href="/1">第一章</a><a href="/2">第二章</a><a href="/skip2">下一页</a></p></div>';
  const chapters=parseChapters(source,book,html,book.bookUrl);
  expect(chapters.map(chapter=>[chapter.title,chapter.url])).toEqual([
    ['第一章','http://m.ersanwx.net/1'],['第二章','http://m.ersanwx.net/2'],
  ]);
});

test('element lists expose Java list methods and retain node identity', () => {
  const html='<div><a href="/a">甲</a><a href="/b">乙</a></div>';
  const script='@js:var xs=java.getElements("tag.a");xs.size()+":"+xs.get(1).text()+":"+xs.toArray()[0].attr("href")';
  expect(sourceRuleText(html,script)).toBe('2:乙:/a');
  const selected=sourceRuleValues(html,'@js:java.getElements("tag.a")');
  expect(selected.map(item=>sourceRuleText(item,'text'))).toEqual(['甲','乙']);
  expect(sourceRuleText({items:[null,{name:'甲'}]},'@js:var xs=java.getElements("$.items[*]");xs.length+":"+xs[0].name')).toBe('1:甲');
});

test('setContent changes later queries but does not replace result', () => {
  const script='@js:java.setContent("<p>新内容</p>");java.getString("tag.p@text")+":"+result';
  expect(sourceRuleText('<p>原内容</p>',script)).toBe('新内容:<p>原内容</p>');
  expect(sourceRuleText('<p>原内容</p>','@js:java.setContent({items:[{name:"甲"}]}).getElements("$.items[*]")[0].name')).toBe('甲');
  expect(sourceRuleText('', '@js:var data={items:[{name:"旧"}]};java.setContent(data);data.items[0].name="新";java.getString("$.items[0].name")')).toBe('新');
});

test('element lookup shares the existing query limit and rejects nested scripts', () => {
  expect(()=>sourceRuleText('<p>内容</p>','@js:for(var i=0;i<17;i++)java.getElements("tag.p");')).toThrow(/限制/);
  expect(()=>sourceRuleText('<p>内容</p>','@js:java.getElements("@js:1")')).toThrow(/嵌套/);
  expect(()=>sourceRuleText('<p>x</p>'.repeat(8001),'@js:java.getElements("tag.p")')).toThrow(/限制/);
});

test('runs the original 1321 笔趣阁 directory rule using nested element selection', () => {
  const source: BookSource={...biquge,bookSourceType:0,customOrder:0,enabled:true,enabledExplore:true};
  const book: SearchBook={bookUrl:source.bookSourceUrl+'/book/123/',origin:source.bookSourceUrl,originName:source.bookSourceName,name:'书',author:''};
  const html='<div id="list-chapterAll"><dd><a href="1.html">第一章</a></dd><dd><a href="2.html">第二章</a></dd></div>';
  expect(sourceRuleText(html,'@js:java.getElements("#list-chapterAll@dd").length')).toBe('2');
  const chapters=parseChapters(source,book,html,book.bookUrl);
  expect(chapters.map(chapter=>[chapter.title,chapter.url])).toEqual([
    ['第一章',book.bookUrl+'1.html'],['第二章',book.bookUrl+'2.html'],
  ]);
});

test('element and element-collection selection returns attributes, text and inner HTML', () => {
  const html='<div class="group"><p><a href="/a"><em>甲</em></a></p><p><a href="/b">乙</a></p></div>';
  const script='@js:var groups=java.getElements("class.group");var links=groups.select("a");links.attr("href")+":"+links.text()+":"+links.get(0).html()';
  expect(sourceRuleText(html,script)).toBe('/a:甲 乙:<em>甲</em>');
  expect(sourceRuleText(html,'@js:var xs=java.getElements("tag.p");xs[1].select("a").attr("href")')).toBe('/b');
  expect(sourceRuleText(html,'@js:var xs=java.getElements("tag.i");xs.attr("href")+":"+xs.text()+":"+xs.html()')).toBe('::');
  expect(sourceRuleText(html,'@js:java.getElements("class.group@p").length')).toBe('2');
  expect(sourceRuleText(html,'@js:java.getElements("class.group@p[0]").length')).toBe('1');
  expect(()=>sourceRuleText(html,'@js:java.getElements("tag.p")[0].select("'+'x'.repeat(513)+'")')).toThrow(/限制/);
});

test('java.log returns the original value', () => {
  const logger=jest.spyOn(console,'log').mockImplementation(()=>{});
  try {
    expect(sourceRuleText('', '@js:var x={name:"甲"};java.log(x)===x')).toBe('true');
    expect(logger).toHaveBeenCalled();
  } finally { logger.mockRestore(); }
});

test('explicit CSS element queries use CSS syntax rather than legacy prefixes', () => {
  const html='<class class="foo">匹配</class><p class="foo">不匹配</p><a>链接</a>';
  expect(sourceRuleText(html, '@js:var xs=java.getElements("@CSS:class.foo");xs.length+":"+xs[0].text()')).toBe('1:匹配');
  expect(sourceRuleText(html, '@js:java.getElements("@CSS:tag.a").length')).toBe('0');
  expect(sourceRuleText(html, '@CSS:class.foo@text')).toBe('匹配');
  expect(sourceRuleValues(html, '@CSS:class.foo')).toHaveLength(1);
  expect(sourceRuleText(html, '@CSS:class.absent@text||class.foo@text')).toBe('匹配');
  expect(sourceRuleText('<div id="page"><class class="foo">甲</class><p class="foo">乙</p></div>', '@CSS:#page@class.foo@text')).toBe('甲');
});

test('java.getElement returns an HTML element collection as used by 1321 sources', () => {
  const html='<div id="pb_next"><a href="/next">下一页</a><a href="/last">末页</a></div>';
  expect(sourceRuleText(html, '@js:var next=java.getElement("@@#pb_next@a");next.attr("href")+":"+next.size()+":"+next.text()')).toBe('/next:2:下一页 末页');
  expect(sourceRuleValues(html, '@js:java.getElement("#pb_next@a")').map(item=>sourceRuleText(item,'text'))).toEqual(['下一页','末页']);
  expect(sourceRuleText(html, '@js:java.getElement("tag.i").size()')).toBe('0');
  expect(sourceRuleText(html, '@js:java.getElement(null)===null')).toBe('true');
});

test('java.getElement returns JSON objects and arrays without flattening them', () => {
  const value={item:{name:'甲'},items:[{name:'乙'},{name:'丙'}]};
  expect(sourceRuleText(value, '@js:java.getElement("$.item").name')).toBe('甲');
  expect(sourceRuleText(value, '@js:var xs=java.getElement("$.items");xs.size()+":"+xs.get(1).name')).toBe('2:丙');
  expect(sourceRuleText(value, '@js:java.getElement("$.items[*]").length')).toBe('2');
  expect(sourceRuleText('', '@js:java.setContent("{\\"item\\":{\\"name\\":\\"丁\\"}}");java.getElement("$.item").name')).toBe('丁');
  expect(()=>sourceRuleText(value, '@js:for(var i=0;i<17;i++)java.getElement("$.item");')).toThrow(/限制/);
  expect(()=>sourceRuleText(value, '@js:java.getElement("@js:1")')).toThrow(/嵌套/);
  const deeplyNested = '{"x":'.repeat(40)+'1'+'}'.repeat(40);
  expect(()=>sourceRuleText('', '@js:java.setContent('+JSON.stringify(deeplyNested)+');java.getElement("$..x")')).toThrow(/限制/);
});

test('java.getElements reads JSON text supplied by a prior setContent', () => {
  const data='{"data":[{"comicList":[{"title":"第一章"},{"title":"第二章"}]}]}';
  const script='@js:java.setContent(result);var xs=java.getElements("$.data[*].comicList[*]");xs.length+":"+xs[1].title';
  expect(sourceRuleText(data,script)).toBe('2:第二章');
  expect(sourceRuleText(data,'@js:java.setContent(result);java.getElements("@Json:$.data[*].comicList[*]")[0].title')).toBe('第一章');
  const shared={title:'共享'};
  expect(sourceRuleText({items:[shared,shared]},'@js:java.getElements("$.items[*]").length')).toBe('2');
  expect(sourceRuleText(data,'@js:java.setContent(result);java.getString("$.data[0].comicList[0].title")')).toBe('第一章');
  expect(sourceRuleText(data,'@js:java.setContent(result);java.getStringList("$.data[0].comicList[*].title").join(",")')).toBe('第一章,第二章');
});
