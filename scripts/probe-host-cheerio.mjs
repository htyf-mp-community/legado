import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const hostPackage = process.argv[2];
if (!hostPackage) {
  console.error('Usage: node scripts/probe-host-cheerio.mjs <HTYF host package.json>');
  process.exitCode = 2;
} else {
  const target = createRequire(import.meta.url);
  const host = createRequire(resolve(hostPackage));
  const { load } = host('cheerio/slim');
  const css = target('css-select'); // Existing implementation, for this migration probe only.
  const document = load('<main id="m"><div id="a" class="foo"><div id="b" class="x">文本<b id="bb">标题</b></div><div id="c" data-v=":scope"></div></div><div id="d" class="foo"></div><p id="e"></p></main>').root().get(0);
  const context = css.selectOne('#a', document);
  const $ = load([]);
  const select = (selector, input) => {
    const selection = $(Array.isArray(input) ? input : [input]);
    const scoped = Object.create(selection);
    scoped.toArray = () => input;
    scoped.children = () => ({toArray: () => Array.isArray(input) ? input : input.children ?? []});
    return scoped.find(selector).toArray();
  };
  const atoms = ['*', 'div', 'b', 'p', 'main', '.foo', '.x', '#a', '#b', '[id]', '[data-v=":scope"]', ':scope', ':first-child', ':last-child', ':empty', ':not(.x)', ':has(b)', ':is(div,b)', ':nth-child(2)', 'b:contains(标题)', 'div:scope', 'div:is(:scope)'];
  const selectors = new Set(atoms);
  for (const left of atoms) for (const right of atoms) for (const separator of [' ', ' > ', ' + ', ' ~ ', ', ']) selectors.add(left + separator + right);
  const mismatches = [];
  let comparisons = 0;
  for (const selector of selectors) for (const input of [document, context, [document], [context]]) {
    comparisons++;
    const expected = css.selectAll(selector, input), actual = select(selector, input);
    if (expected.length !== actual.length || expected.some((node, index) => node !== actual[index])) {
      if (mismatches.length < 20) mismatches.push({selector, context: Array.isArray(input) ? 'array' : 'node'});
    }
  }
  console.log(JSON.stringify({hostCheerio: host('cheerio/package.json').version, comparisons, mismatches}, null, 2));
  if (mismatches.length) process.exitCode = 1;
}
