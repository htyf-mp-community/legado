import { runSourceJavaScript } from '../src/core/sourceJavaScript';
import { sourceRuleText, sourceRuleValues } from '../src/core/sourceRule';

test('executes the original rezero chapter rule using endsWith', () => {
  const node = sourceRuleValues('<a href="/chapter/index.html">目录</a>', 'tag.a')[0];
  expect(sourceRuleText(node, "@js:result.attr('href').endsWith('index.html');")).toBe('true');
});

test('supports modern string searches with standard position behavior', () => {
  const script = `[
    '西游记'.includes('游'), 'abc'.includes('a', 1), 'abc'.includes('', 99),
    'abc'.startsWith('b', 1), 'abc'.startsWith('a', -3), 'abc'.startsWith('', Infinity),
    'abc'.endsWith('b', 2), 'abc'.endsWith('c'), 'abc'.endsWith('', -1)
  ].join(',')`;
  expect(runSourceJavaScript(script, '')).toBe('true,false,true,true,true,true,true,true,true');
});

test('rejects regular expressions and supports boxed strings', () => {
  expect(runSourceJavaScript('try { "abc".includes(/a/); } catch (e) { e.name; }', '')).toBe('TypeError');
  expect(runSourceJavaScript('new String("abc").startsWith("ab")', '')).toBe(true);
});

test('limits repeated scanning of large strings', () => {
  expect(() => runSourceJavaScript('var s="x";for(var i=0;i<17;i++)s+=s;for(var j=0;j<300;j++)s.includes("y");', '')).toThrow(/限制/);
  expect(() => runSourceJavaScript('var a=[];for(var i=0;i<100;i++)a.push("large");"x".includes(a);', '')).toThrow(/对象转换/);
});
