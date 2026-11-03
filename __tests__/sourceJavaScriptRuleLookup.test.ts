import { sourceRuleText, sourceRuleValues } from '../src/core/sourceRule';

test('supports the content extraction expression used by 恩京书房', () => {
  const html = '<div id="nr1"><p>西游记正文</p></div>';
  const rule = "@js:java.getString('#nr1@html');";
  expect(sourceRuleText(html, rule)).toBe(sourceRuleText(html, '#nr1@html'));
  expect(sourceRuleText(html, rule)).toContain('西游记正文');
});

test('uses the original rule context after a selector has produced result', () => {
  const html = '<h1>书名</h1><span class="author">作者</span>';
  const rule = 'tag.h1@text\n@js:String(result)+":"+java.getString("class.author@text");';
  expect(sourceRuleText(html, rule)).toBe('书名:作者');
});

test('src retains the original page while result contains a selected value', () => {
  const html = '<h1>书名</h1><p>原始页面</p>';
  expect(sourceRuleText(html, 'tag.h1@text\n@js:result+":"+(src.indexOf("原始页面")>=0);')).toBe('书名:true');
});

test('src preserves JSON objects and the identity shared with result', () => {
  expect(sourceRuleText({name:'原名'}, '@js:result.name="新名";src.name;')).toBe('新名');
});

test('does not copy an unused large source page into a script', () => {
  const html = '<!--' + 'x'.repeat(1_000_001) + '--><p>正文</p>';
  expect(sourceRuleText(html, 'tag.p@text\n@js:result.toUpperCase();')).toBe('正文');
  expect(() => sourceRuleText(html, 'tag.p@text\n@js:src;')).toThrow(/限制|过长/);
  expect(() => sourceRuleText(html, 'tag.p@text\n@js:src.length;')).toThrow(/限制|过长/);
  expect(sourceRuleText(html, 'tag.p@text\n@js:src="替换";src+result;')).toBe('替换正文');
  expect(sourceRuleText(html, 'tag.p@text\n@js:this.src="替换";this.src+result;')).toBe('替换正文');
});

test('scripts may reassign src without changing the host input', () => {
  const input = {name:'原名'};
  expect(sourceRuleText(input, '@js:src={name:"替换"};src.name+":"+result.name;')).toBe('替换:原名');
  expect(input.name).toBe('原名');
});

test('looks up JSON values in the current object and respects URL extraction', () => {
  expect(sourceRuleValues({name:'西游记'}, '@js:java.getString("$.name")')).toEqual(['西游记']);
  const html = '<a href="/one"></a><a href="/two"></a>';
  expect(sourceRuleText(html, '@js:java.getString("tag.a@href", null, true)')).toBe('/one');
});

test('supports the native boolean unescape overload of java.getString', () => {
  const input = {name: '甲&amp;amp;乙'};
  expect(sourceRuleText(input, '@js:java.getString("$.name", false)')).toBe('甲&amp;amp;乙');
  expect(sourceRuleText(input, '@js:java.getString("$.name", true)')).toBe('甲&amp;乙');
  expect(sourceRuleText(input, '@js:java.getString("$.name")')).toBe('甲&amp;乙');
  expect(sourceRuleText(input, '@js:java.getString("", false)')).toBe('');
  const html = '<p>甲&amp;amp;乙</p>';
  expect(sourceRuleText(html, '@js:java.getString("p@text", false)')).toBe('甲&amp;乙');
  expect(sourceRuleText(html, '@js:java.getString("p@text", true)')).toBe('甲&乙');
  expect(sourceRuleText(html, '@js:java.setContent("<p>新&amp;amp;值</p>");java.getString("p@text",false)')).toBe('新&amp;值');
});

test('URL lookups resolve against the redirected page and use the original base for empty values', () => {
  const context = {baseUrl:'https://request.example/book/1',redirectUrl:'https://cdn.example/dir/page.html'};
  const html = '<a href="../read?a=1&amp;amp;b=2">正文</a>';
  expect(sourceRuleText(html, '@js:java.getString("tag.a@href",null,true)', false, context)).toBe('https://cdn.example/read?a=1&b=2');
  expect(sourceRuleText(html, '@js:java.getString("tag.i@href",null,true)', false, context)).toBe(context.baseUrl);
  expect(sourceRuleText(html, '@js:java.getString("",null,true)', false, context)).toBe('');
  expect(sourceRuleText(html, '@js:typeof redirectUrl', false, context)).toBe('undefined');
});

test('real source lookup expression can query the script-provided HTML result', () => {
  const rule = `@js:var result = '<div id="content">正文内容</div>'; java.getString('[id*="content"]@html',result);`;
  expect(sourceRuleText('<p>原始页面</p>', rule)).toBe(sourceRuleText('<div id="content">正文内容</div>', '[id*="content"]@html'));
});

test('queries a custom JSON object or a selected element without replacing the original context', () => {
  expect(sourceRuleText('<p>原始</p>', '@js:var obj={book:{name:"西游记"}};java.getString("$.book.name",obj);')).toBe('西游记');
  expect(sourceRuleText('<div><b>选中</b></div><p>原始</p>', 'tag.div\n@js:java.getString("tag.b@text",result[0]);')).toBe('选中');
  expect(sourceRuleText('<p>原始</p>', '@js:java.getString("p@text","<p>自定义</p>")+":"+java.getString("p@text");')).toBe('自定义:原始');
});

test('bounds custom lookup content and rejects recursive objects', () => {
  expect(() => sourceRuleText('', '@js:var x={};x.self=x;java.getString("$.x",x);')).toThrow(/限制/);
  expect(() => sourceRuleText('', '@js:var s="x";for(var i=0;i<20;i++)s+=s;java.getString("p@text",s);')).toThrow(/限制|过长/);
});

test('prevents lookup recursion and excessive query calls', () => {
  expect(() => sourceRuleText('<p>x</p>', '@js:java.getString("@js:1")')).toThrow(/嵌套/);
  expect(() => sourceRuleText('<p>x</p>', '@js:for(var i=0;i<20;i++)java.getString("p@text");')).toThrow(/限制/);
});
