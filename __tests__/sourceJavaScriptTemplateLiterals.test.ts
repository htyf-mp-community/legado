import {runSourceJavaScript} from '../src/core/sourceJavaScript';

test('evaluates template expressions with intrinsic string conversion and in order', () => {
  const script = 'var n=0; var v="text"; String=function(){return "shadowed"}; `a${v}:${++n}:${++n}`';
  expect(runSourceJavaScript(script, '')).toBe('atext:1:2');
});

test('refuses unsupported object conversion instead of returning the wrong string', () => {
  expect(() => runSourceJavaScript('var v={toString:function(){return "text"}}; `${v}`', '')).toThrow(/对象转换/);
});

test('handles escapes, nested expressions and nested template literals', () => {
  const script = 'var x={a:2}; `line\\n\\`\\${literal}:${`nested ${x.a+1}`}:${({a:"}"}).a}`';
  expect(runSourceJavaScript(script, '')).toBe('line\n`${literal}:nested 3:}');
});

test('leaves backticks inside strings, comments and regular expressions untouched', () => {
  const script = 'var s="`"; /* ` */ var r=/[`]/; // `\n `${s}:${r.test(s)}`';
  expect(runSourceJavaScript(script, '')).toBe('`:true');
});

test('keeps valid ES5 scripts unchanged when backticks only occur in literals', () => {
  expect(runSourceJavaScript('var 标签="`"; 标签', '')).toBe('`');
  expect(runSourceJavaScript('if(true){} /`/.test("`")', '')).toBe(true);
});

test('rejects tagged templates instead of executing a different expression', () => {
  expect(() => runSourceJavaScript('function tag(x){return x[0]};tag`hello`', '')).toThrow();
  expect(() => runSourceJavaScript('var 标签=function(x){return x[0]};标签`hello`', '')).toThrow();
});

test('rejects ambiguous slash after a block without rewriting its regexp', () => {
  expect(() => runSourceJavaScript('if(true){} /`/.test("`"); `ok`', '')).toThrow();
});

test('supports template escapes and interpolation of primitive values', () => {
  expect(runSourceJavaScript('`\\u{1F600}\\x21:${null}:${undefined}:${false}`', '')).toBe('😀!:null:undefined:false');
  expect(() => runSourceJavaScript('`\\8`', '')).toThrow();
});
