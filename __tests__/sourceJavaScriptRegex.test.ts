import { sourceRuleText, sourceRuleValues } from '../src/core/sourceRule';
import { runSourceJavaScript } from '../src/core/sourceJavaScript';
import sourceFixture from './fixtures/source-1321-xinbiquge.json';

describe('JavaScript source regular expressions', () => {
  it('uses RegExp.exec to iterate over captures and update lastIndex', () => {
    const script = `var r=/(\\w+):(\\d+)/g, m, out=[]; while ((m=r.exec(result))) out.push(m[1]+'='+m[2]+'@'+m.index); out.push('last='+r.lastIndex); out;`;
    expect(sourceRuleValues('a:1 b:23', '@js:' + script)).toEqual(['a=1@0', 'b=23@4', 'last=0']);
  });

  it('supports test, respects lastIndex, and resets it after a failed global match', () => {
    expect(sourceRuleValues('ab ab', '@js:var r=/ab/g; [r.test(result),r.lastIndex,r.test(result),r.lastIndex,r.test(result),r.lastIndex];')).toEqual([true, 2, true, 5, false, 0]);
  });

  it('replaces regex matches with JavaScript capture substitutions', () => {
    const input = 'a1 b22', replacement = '$2:$1:$$:$&';
    const expected = input.replace(/([a-z])(\d+)/g, replacement);
    expect(sourceRuleValues(input, `@js:result.replace(/([a-z])(\\d+)/g, '${replacement}')`)).toEqual([expected]);
  });

  it('only replaces the first match when the global flag is absent', () => {
    expect(sourceRuleValues('abc abc', '@js:result.replace(/(a)(b)/, "$2$1")')).toEqual(['bac abc']);
  });

  it('rejects unsupported patterns instead of falling back to native regex', () => {
    expect(() => sourceRuleValues('aaa', '@js:/(a+)\\1/.test(result)')).toThrow(/JavaScript/);
  });

  it('limits replacement output before creating oversized strings', () => {
    expect(() => sourceRuleValues('a'.repeat(10_000), '@js:result.replace(/a/g, "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")')).toThrow(/限制/);
  });
});

test('selector-prefixed JavaScript does not bypass the bounded regular expression engine', () => {
  expect(() => sourceRuleValues('<a>aa</a>', 'a@text@js:result.replace(/(a)\\1/, "x")')).toThrow(/JavaScript/);
  expect(() => sourceRuleValues('<a>aa</a>', 'a@text@js:result.match(/(a)\\1/)[1]')).toThrow(/JavaScript/);
});

test('extracts a chapter title with a real imported-source script', () => {
  const rule = "@js:(function(){function e(s){return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'\\\"').replace(/&#39;/g,\"'\").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}var s=String(result),a=(s.match(/<a[\\s\\S]*?>/i)||[''])[0],m,ar=/data-[^=]+=[\"']([^\"']*)[\"']/g;while((m=ar.exec(a))){var v=e(m[1]);if(v&&!/^[A-Za-z0-9+\\/]+={0,2}$/.test(v)&&!/^\\d+$/.test(v))return v;}m=s.match(/<a[\\s\\S]*?>([\\s\\S]*?)<\\/a>/i);return m?e(m[1].replace(/<[^>]+>/g,'').replace(/\\s+/g,' ').trim()):'';})()";
  const html = `<a data-id="YWJjZA==" data-name="第一章 &amp; 开始">标题</a>`;
  expect(sourceRuleValues(html, rule)).toEqual(['第一章 & 开始']);
});

test('matches JavaScript replacement token behavior for captures and unmatched groups', () => {
  const input = 'ab-c';
  const replacement = "$$:$&:$`:$':$1:$2:$10:$02:$0:$3";
  const expected = input.replace(/(a)(b)?/g, replacement);
  expect(sourceRuleValues(input, `@js:result.replace(/(a)(b)?/g, ${JSON.stringify(replacement)})`)).toEqual([expected]);
});

test('search returns the first match without changing a global expression lastIndex', () => {
  expect(sourceRuleValues('a12b', '@js:var r=/\\d/g; r.lastIndex=3; [result.search(r),r.lastIndex];')).toEqual([1, 3]);
});

test('replacement coerces primitive replacement values to strings', () => {
  expect(sourceRuleValues('a1', '@js:result.replace(/\\d/, 42)')).toEqual(['a42']);
});

test('global empty matches advance by UTF-16 code units like ES5', () => {
  const text = '😀';
  expect(sourceRuleValues(text, '@js:result.match(/(?:)/g).length')).toEqual([text.match(/(?:)/g)!.length]);
  expect(sourceRuleValues(text, '@js:result.replace(/(?:)/g, "-")')).toEqual([text.replace(/(?:)/g, '-')]);
});

test('array bounds also apply to Object.defineProperty descriptors', () => {
  expect(() => sourceRuleValues('', `@js:var a=[]; Object.defineProperty(a,"length",{value:100000000}); 'accepted';`)).toThrow(/限制/);
});

test('array bounds apply to numeric strings assigned to length', () => {
  expect(() => sourceRuleValues('', `@js:var a=[]; a.length='100000000'; 'accepted';`)).toThrow(/限制/);
});

test('splits source text with bounded regular expressions and JavaScript capture semantics', () => {
  const samples: Array<[string, string, RegExp, number | undefined]> = [
    ['a  b\tc', '/\\s+/', /\s+/, undefined],
    ['one<br/>two<BR >three', '/<br[ ]*[/]?>/i', /<br[ ]*[/]?>/i, undefined],
    ['a1b22c', '/(\\d+)/', /(\d+)/, undefined],
    ['ab-c', '/(a)(z)?/', /(a)(z)?/, undefined],
    ['abc', '/(?:)/', /(?:)/, undefined],
    ['', '/(?:)/', /(?:)/, undefined],
    ['abc', '/(?:)/', /(?:)/, 2],
    ['a:b:c', '/:/', /:/, 0],
    ['a:b:c', '/:/', /:/, 2],
  ];
  for (const [input, literal, regex, limit] of samples) {
    const script = `result.split(${literal}${limit === undefined ? '' : `,${limit}`})`;
    expect(runSourceJavaScript(script,input)).toEqual(input.split(regex,limit));
  }
  expect(runSourceJavaScript('var r=/[:,]/g;r.lastIndex=2;var x=result.split(r);[x.join("|"),r.lastIndex]', 'a:b,c')).toEqual(['a|b|c',2]);
  expect(runSourceJavaScript("result.split(/\\n+/).map(function(x){return x.replace(/^\\s+|\\s+$/g,'');}).filter(function(x){return x;}).join('\\n')", ' 甲 \n\n 乙 ')).toBe('甲\n乙');
});

test('split applies output limits and refuses unsupported regex patterns', () => {
  expect(()=>runSourceJavaScript('result.split(/(a+)\\1/)', 'aaaa')).toThrow(/JavaScript/);
  expect(()=>runSourceJavaScript('result.split("")', 'x'.repeat(9000))).toThrow(/限制/);
  expect(runSourceJavaScript('result.split("",3)', 'x'.repeat(9000))).toEqual(['x','x','x']);
});

test('regex split agrees with JavaScript for anchors, empty matches and captures', () => {
  const inputs=['','a','ab','aba','a,b,,c', 'a\nb'];
  const patterns=[/a/,/a*/,/a+/,/a?/,/(a)?/,/(a*)/,/^/,/$/,/,/,/\b/,/\s+/];
  for(const input of inputs) for(const pattern of patterns) for(const limit of [undefined,1,4]) {
    const script=`result.split(${pattern}${limit===undefined?'':`,`+limit})`;
    const actual=runSourceJavaScript(script,input),expected=input.split(pattern,limit);
    expect({input,pattern:String(pattern),limit,value:actual}).toEqual({input,pattern:String(pattern),limit,value:expected});
  }
});

test('runs the original imported source content rule that splits paragraphs', () => {
  const html='<div id="article"><p> 第一段 </p><p class="readinline">广告</p><p> 第二段 &amp; 后续 </p><!--over--></div>';
  expect(sourceRuleText(html,sourceFixture.ruleContent.content)).toBe('第一段\n第二段 & 后续');
});
