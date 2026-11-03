import {createSourceRuleLookup} from '../src/core/sourceRule';
import {createSourceWorkerBridge} from '../src/core/sourceWorkerBridge';

test('encodes input nodes and shared objects using task-local references', () => {
  const lookup=createSourceRuleLookup('<div><a href="/1">第一章</a></div>');
  const node=lookup.elements('tag.a')[0],shared=[node,{name:'书'}];
  const adapter=createSourceWorkerBridge({baseUrl:'https://example.org',key:null,page:1,ajax:async()=>'',removeCookie:()=>{},lookup});
  const graph=adapter.encodeInput({result:shared,globals:{src:shared}});
  expect(graph).toMatchObject({kind:'object',id:1,entries:[['result',{kind:'array',id:2}],['globals',{kind:'object'}]]});
  expect(JSON.stringify(graph)).toContain('"kind":"ref","id":2');
  expect(JSON.stringify(graph)).toContain('"kind":"node","handle":"1"');
  expect(adapter.resolveNode('1')).toBe(node);
});

test('rejects cycles and excessive depth before sending a task', () => {
  const adapter=createSourceWorkerBridge({baseUrl:'https://example.org',key:null,page:1,ajax:async()=>'',removeCookie:()=>{}});
  const cycle:{self?:unknown}={};cycle.self=cycle;
  expect(()=>adapter.encodeInput(cycle)).toThrow(/循环|限制/);
  let deep:unknown='x';for(let i=0;i<22;i++)deep=[deep];
  expect(()=>adapter.encodeInput(deep)).toThrow(/限制|过深/);
});
