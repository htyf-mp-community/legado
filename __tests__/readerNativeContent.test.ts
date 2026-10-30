jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }) }));
import { formattedSourceToReaderContent, readerContentSegments, readerHtmlMarker, readerImageMarker } from '../src/core/readerImages';
import { decodeReaderContent, protectNativeReaderHtml, renderNativeReaderContent } from '../src/core/readerNativeContent';
import { prepareReaderText } from '../src/core/readerText';
import { applyReplaceRules, parseReplaceRules } from '../src/data/replaceRules';
import { readerReplacementPolicy, runReaderContentRules } from '../src/core/readerReplacement';
import { formatReaderParagraphs } from '../src/core/htmlFormatter';
import native from './fixtures/readerNativeContent.native.json';

test('conversion and replacement see raw HTML/image content before render encoding', () => {
  const cached = formattedSourceToReaderContent('外部頭髮<usehtml><b>頭髮</b></usehtml><img src="https://x.test/頭髮.png">', 'https://x.test/chapter');
  const converted = prepareReaderText(decodeReaderContent(cached).content, '第一章', false, 1);
  const rules = parseReplaceRules('[{"pattern":"头发.png","replacement":"图片.png","isRegex":false}]');
  expect(applyReplaceRules(converted, rules, 'content', { name: '书', origin: '源' })).toContain('图片.png');
});

test('recovers exact native source bytes including adjacent blocks and literal decoded tags', () => {
  for (const raw of ['', 'plain &lt; <b>literal</b>', '<usehtml>A</usehtml><usehtml>B</usehtml>', '前\n<usehtml><b>A\r\nB</b></usehtml>\n后', '<img src="https://x.test/甲.png">']) {
    expect(decodeReaderContent(formattedSourceToReaderContent(raw, 'https://x.test/redirect')).content).toBe(raw);
  }
});

test('uses native placeholders and LF-only flattening without collision avoidance', () => {
  const raw = '特殊格式的占位不应该被看见0。<usehtml>A\r\nB</usehtml>';
  const protectedValue = protectNativeReaderHtml(raw, true);
  expect(protectedValue.text).toBe('特殊格式的占位不应该被看见0。特殊格式的占位不应该被看见0。');
  expect(protectedValue.restore(protectedValue.text)).toBe('\n<usehtml>A\rB</usehtml>\n\n<usehtml>A\rB</usehtml>\n');
  expect(protectNativeReaderHtml(raw, false).restore(raw)).toBe(raw);
});

test('renders only native paragraph-leading HTML and retains cached tags when adaptation is disabled', () => {
  const context = decodeReaderContent(readerHtmlMarker({ html: '<b>甲</b>', baseUrl: 'https://x.test/redirect' }));
  expect(readerContentSegments(renderNativeReaderContent('　　<usehtml><b>甲</b></usehtml>', context, true))).toEqual([
    { type: 'html', html: { html: '<b>甲</b>', baseUrl: 'https://x.test/redirect', sourceFormatted: true } },
  ]);
  expect(renderNativeReaderContent('前<usehtml><b>甲</b></usehtml>', context, true)).toBe('前<usehtml><b>甲</b></usehtml>');
  expect(renderNativeReaderContent('<usehtml><b>甲</b></usehtml>', context, false)).toBe('<usehtml><b>甲</b></usehtml>');
});

test('preserves legacy image click metadata and does not double-unescape literal text', () => {
  const context = decodeReaderContent('A &amp; <b>B</b>' + readerImageMarker({ src: 'https://x.test/a', click: 'https://x.test/open' }));
  expect(readerContentSegments(renderNativeReaderContent(context.content, context, true))).toEqual([
    { type: 'text', text: 'A &amp; <b>B</b>' },
    { type: 'image', image: { src: 'https://x.test/a', click: 'https://x.test/open' } },
  ]);
  expect(decodeReaderContent('{{HTYF_HTML:bad}}').content).toBe('{{HTYF_HTML:bad}}');
});

test('matches unchanged native getContent across HTML, conversion, resegmentation and rule policies', () => {
  const plans = native.plans.map(plan => plan.length ? parseReplaceRules(JSON.stringify(plan)) : []);
  for (const item of native.cases) {
    const context = decodeReaderContent(formattedSourceToReaderContent(item.content, 'https://x.test/chapter'));
    expect(context.content).toBe(item.content);
    const policy = readerReplacementPolicy(plans[item.plan], item.policy === 'manualEmpty' ? [] : undefined, item.policy !== 'disabled', false);
    const prepared = prepareReaderText(context.content, '第一章', item.resegment, item.mode as 0 | 1 | 2, () => 0.5);
    const protectedValue = protectNativeReaderHtml(prepared, item.adapt);
    const replaced = runReaderContentRules(protectedValue.text, policy.rules, { name: '参考书', origin: '源' }, policy.contentEnabled);
    const actual = formatReaderParagraphs(protectedValue.restore(replaced.value), item.indent);
    expect({ item, value: actual, hitIds: replaced.hits.map(rule => rule.id) }).toEqual({ item, value: item.expected.value, hitIds: item.expected.hitIds });
  }
});
