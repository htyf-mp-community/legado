import { sourceRuleValues } from '../src/core/sourceRule';

test('parses JSON and serializes nested objects, arrays and primitives', () => {
  const script = `var x=JSON.parse(result); JSON.stringify({name:x.name,items:x.items,missing:undefined,invalid:NaN});`;
  expect(sourceRuleValues('{"name":"西游记","items":[1,true,null]}', '@js:' + script))
    .toEqual(['{"name":"西游记","items":[1,true,null],"invalid":null}']);
});

test('matches array holes, functions, boxed primitives and undefined', () => {
  const script = `JSON.stringify([1,,undefined,function(){},new Number(3),new String('x'),new Boolean(false)]);`;
  expect(sourceRuleValues('', '@js:' + script)).toEqual(['[1,null,null,null,3,"x",false]']);
  expect(sourceRuleValues('', '@js:typeof JSON.stringify(undefined)')).toEqual(['undefined']);
});

test('supports a property-list replacer and formatting', () => {
  const script = `JSON.stringify({a:1,b:{a:2,b:3},c:4}, ['b','a'], 2);`;
  expect(sourceRuleValues('', '@js:' + script)).toEqual([JSON.stringify({a:1,b:{a:2,b:3},c:4}, ['b','a'], 2)]);
});

test('rejects cyclic and exponentially shared objects without exhausting memory', () => {
  expect(() => sourceRuleValues('', '@js:var a={};a.self=a;JSON.stringify(a);')).toThrow(/循环|circular|JavaScript/i);
  expect(() => sourceRuleValues('', '@js:var a={v:"x"};for(var i=0;i<20;i++) a={left:a,right:a};JSON.stringify(a);')).toThrow(/限制/);
});

test('rejects excessive parsed nesting and oversized serialized strings', () => {
  const nested = '['.repeat(25) + '0' + ']'.repeat(25);
  expect(() => sourceRuleValues(nested, '@js:JSON.parse(result);')).toThrow(/限制/);
  expect(() => sourceRuleValues('\u0001'.repeat(200_000), '@js:JSON.stringify(result);')).toThrow(/限制/);
});

test('does not invoke unsupported getters or replacer functions in native code', () => {
  expect(() => sourceRuleValues('', '@js:var x={};Object.defineProperty(x,"a",{enumerable:true,get:function(){while(true){}}});JSON.stringify(x);')).toThrow(/getter|访问器|JavaScript/i);
  expect(() => sourceRuleValues('', '@js:JSON.stringify({x:1},function(k,v){return v;});')).toThrow(/函数|JavaScript/);
});

test('reports invalid JSON and cyclic values as catchable JavaScript errors', () => {
  expect(sourceRuleValues('', `@js:var x='no';try{JSON.parse('{');}catch(e){x='caught';}x;`)).toEqual(['caught']);
  expect(sourceRuleValues('', `@js:var a={};a.self=a;var x='no';try{JSON.stringify(a);}catch(e){x='caught';}x;`)).toEqual(['caught']);
});

test('does not silently ignore user-defined toJSON on boxed values', () => {
  expect(() => sourceRuleValues('', `@js:var x=new Number(3);x.toJSON=function(){return 9};JSON.stringify(x);`)).toThrow(/toJSON|JavaScript/);
});

test('serializes Date values like JavaScript', () => {
  expect(sourceRuleValues('', `@js:JSON.stringify({time:new Date(0),bad:new Date('invalid')});`)).toEqual(['{"time":"1970-01-01T00:00:00.000Z","bad":null}']);
});

test('does not silently ignore an overridden Date toJSON method', () => {
  expect(() => sourceRuleValues('', `@js:Date.prototype.toJSON=function(){return 'custom'};JSON.stringify(new Date(0));`)).toThrow(/toJSON|JavaScript/);
  expect(sourceRuleValues('', `@js:var d=new Date(0);d.toJSON=null;JSON.stringify(d);`)).toEqual(['{"toJSON":null}']);
});

test('parses boxed text while rejecting unbounded object coercion', () => {
  expect(sourceRuleValues('', `@js:JSON.parse(new String('{"x":3}')).x;`)).toEqual([3]);
  expect(() => sourceRuleValues('', `@js:JSON.parse({toString:function(){while(true){}}});`)).toThrow(/JSON|JavaScript/);
});
