import {createSourceRuleLookup,sourceRuleText} from '../src/core/sourceRule';
import {createSourceWorkerDom} from '../src/core/sourceWorkerDom';

test('queries and selects host DOM elements using per-task handles', () => {
  const html='<div class="group"><p><a href="/a"><em>甲</em></a></p><p><a href="/b">乙</a></p></div>';
  const dom=createSourceWorkerDom(createSourceRuleLookup(html));
  const groups=dom.elements('class.group');
  expect(groups.kind).toBe('elements');
  if(groups.kind!=='elements') throw new Error('expected elements');
  const links=dom.select(groups.handles,'a');
  expect(links.handles).toHaveLength(2);
  expect(dom.attr(links.handles,'href')).toBe('/a');
  expect(dom.text(links.handles)).toBe('甲 乙');
  expect(dom.html([links.handles[0]])).toBe('<em>甲</em>');
  expect(sourceRuleText(dom.resolve(links.handles[1]),'text')).toBe('乙');
});

test('keeps JSON results as values and rejects foreign or excessive DOM operations', () => {
  const dom=createSourceWorkerDom(createSourceRuleLookup({items:[{name:'甲'},{name:'乙'}]}));
  expect(dom.elements('$.items[*]')).toEqual({kind:'values',values:[{name:'甲'},{name:'乙'}]});
  expect(()=>dom.text(['unknown'])).toThrow(/元素/);
  expect(()=>dom.select([],'x'.repeat(513))).toThrow(/选择器/);
});
