import { sourceRuleText, sourceRuleValues } from '../src/core/sourceRule';

test('supports the Java List access pattern used by an imported book source', () => {
  const html = '<div class="detail-main-info-author"><a>作者甲</a><a>作者乙</a></div>';
  const script = `@js:var list=java.getStringList('p.detail-main-info-author a@text'); var out=[]; for(var i=0;i<list.size();i++){var t=String(list.get(i)).trim();if(t)out.push(t);}out.join('、 ');`;
  const matchingHtml = html.replace('<div ', '<p ').replace('</div>', '</p>');
  expect(sourceRuleText(matchingHtml, script)).toBe('作者甲、 作者乙');
});

test('returns array indices, Java list methods, and a separate toArray copy', () => {
  const html = '<a>甲</a><a>乙</a>';
  const script = '@js:var list=java.getStringList("tag.a@text"); var a=list.toArray(); a[0]="改"; [list.length,list[0],list.get(1),list.isEmpty(),a.join("-")].join("|");';
  expect(sourceRuleText(html, script)).toBe('2|甲|乙|false|改-乙');
});

test('supports JSON and custom HTML content with native empty-rule behavior', () => {
  expect(sourceRuleValues({names:['甲','乙']}, '@js:java.getStringList("$.names[*]")')).toEqual(['甲','乙']);
  const script = '@js:var list=java.getStringList("option@value","<option value=1></option><option value=2></option>"); list.join(",")+":"+(java.getStringList("")===null)+":"+java.getStringList("tag.i@text").isEmpty();';
  expect(sourceRuleText('<p>原页面</p>', script)).toBe('1,2:true:true');
});

test('resolves and deduplicates URL list values against the redirected page', () => {
  const context = {baseUrl:'https://request.example/book', redirectUrl:'https://cdn.example/path/index.html'};
  const html = '<a href="../one">A</a><a href="https://cdn.example/one">B</a><a href="two">C</a><a href="javascript:void(0)">D</a>';
  const script = '@js:java.getStringList("tag.a@href",null,true).join("|")';
  expect(sourceRuleText(html, script, false, context)).toBe('https://cdn.example/one|https://cdn.example/path/two');
});

test('bounds list lookups and reports invalid Java list indices', () => {
  expect(() => sourceRuleText('<p>x</p>', '@js:for(var i=0;i<17;i++)java.getStringList("p@text");')).toThrow(/限制/);
  expect(() => sourceRuleText('<p>x</p>', '@js:java.getStringList("p@text").get(3);')).toThrow(/索引/);
  expect(() => sourceRuleText('<p>x</p>', '@js:java.getStringList("@js:1");')).toThrow(/嵌套/);
});
