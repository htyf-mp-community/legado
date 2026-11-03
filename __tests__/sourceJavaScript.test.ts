import { sourceRuleText, sourceRuleValues } from '../src/core/sourceRule';

describe('book source JavaScript rules', () => {
  it('passes ordinary JSON objects with a type field as data', () => {
    expect(sourceRuleValues({type:'book',title:'西游记'}, '@js:result.type + ":" + result.title')).toEqual(['book:西游记']);
  });

  it('does not mistake a JSON object resembling an HTML node for a parser node', () => {
    expect(sourceRuleValues({type:'tag',name:'book',attribs:{title:'西游记'}}, '@js:result.name + ":" + result.attribs.title')).toEqual(['book:西游记']);
  });

  it('runs a script block before the following HTML rule', () => {
    expect(sourceRuleText('<a>标题</a>', '<js>result</js>tag.a@text')).toBe('标题');
    expect(sourceRuleValues('A', '<js>result + "B"</js>')).toEqual(['AB']);
  });

  it('runs a JavaScript transformation after a selector', () => {
    expect(sourceRuleText('<a href="/book/1">One</a>', 'a@href\n@js:String(result) + ",tail"')).toBe('/book/1,tail');
  });

  it('does not manufacture a URL when a selector found no value', () => {
    expect(sourceRuleText('<div></div>', `id.next@href\n@js:String(result)+',{}'`, true)).toBe('');
  });

  it('preserves HTML elements when a script filters and reorders them', () => {
    const html = '<div id="list"><a href="/1">One</a><a href="/2">Two</a><a href="/1">Duplicate</a></div>';
    const rule = `id.list@tag.a\n@js:var seen={};var out=[];for(var i=result.length-1;i>=0;i--){var u=String(result[i].attr("href")||"");if(u&&!seen[u]){seen[u]=1;out.unshift(result[i])}}out;`;
    const items = sourceRuleValues(html, rule);
    expect(items.map(item => sourceRuleText(item, 'text'))).toEqual(['Two', 'Duplicate']);
  });

  it('supports simple bounded string replacements', () => {
    expect(sourceRuleValues('foobar', '@js:result.replace("foo", "bar")')).toEqual(['barbar']);
  });

  it('matches regular expressions without native backtracking', () => {
    expect(sourceRuleValues('<form action="/search.html">', '@js:String(result).match(/<form[^>]*action="([^"]*)"/)[1]')).toEqual(['/search.html']);
  });

  it('rejects oversized arrays and strings', () => {
    expect(() => sourceRuleValues('', '@js:var a=[]; a.length=99999999; a;')).toThrow(/限制/);
    expect(() => sourceRuleValues('', '@js:var s="x"; for(var i=0;i<25;i++) s+=s; s;')).toThrow(/限制/);
  });

  it('stops nonterminating scripts rather than blocking the host', () => {
    expect(() => sourceRuleValues('anything', '@js:while (true) {}')).toThrow(/脚本|限制|JavaScript/i);
  });

  it('does not allow dynamic compilation or unbounded JSON expansion', () => {
    expect(() => sourceRuleValues('', '@js:eval("1+1")')).toThrow(/JavaScript/);
    expect(() => sourceRuleValues('', '@js:Function("return 1")()')).toThrow(/JavaScript/);
    expect(() => sourceRuleValues('', '@js:var a={v:1};for(var i=0;i<20;i++)a={a:a,b:a};JSON.stringify(a);')).toThrow(/限制/);
  });

  it('does not expose the host JavaScript globals', () => {
    expect(sourceRuleValues('anything', '@js:typeof globalThis')).toEqual(['undefined']);
  });
});

test('search scripts can await their scoped network bridge', async () => {
  const { runSourceJavaScriptAsync } = require('../src/core/sourceJavaScript');
  const ajax = jest.fn().mockResolvedValue('<form action="/find">');
  const removeCookie = jest.fn();
  const result = await runSourceJavaScriptAsync(
    'cookie.removeCookie(baseUrl); var h=String(java.ajax(baseUrl)); var m=h.match(/action="([^\"]*)"/); baseUrl+m[1]+"?q="+key;',
    { baseUrl: 'https://example.org', key: '三体', page: 1, ajax, removeCookie },
  );
  expect(result).toBe('https://example.org/find?q=三体');
  expect(ajax).toHaveBeenCalledWith('https://example.org');
  expect(removeCookie).toHaveBeenCalledWith('https://example.org');
});
