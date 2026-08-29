jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
import {
  highlightSegments,
  matchHighlightRules,
} from '../src/core/highlightRules';
import {
  normalizeHighlightRule,
  parseHighlightRules,
} from '../src/data/highlightRules';
import { highlightTextStyle } from '../src/core/highlightTextStyle';
import { highlightGeometry, wavePath } from '../src/core/highlightGeometry';

describe('highlight rules', () => {
  it('accepts the Android export envelope and preserves style JSON', () => {
    const rules = parseHighlightRules(
      '{"type":"highlightRule","rules":[{"id":1,"uuid":"u","pattern":"hero","style":"{\\"bold\\":true}"}]}',
    );
    expect(rules[0]).toMatchObject({
      id: 1,
      uuid: 'u',
      pattern: 'hero',
      applyToBody: true,
    });
    expect(JSON.parse(rules[0].style)).toEqual({ bold: true });
  });
  it('matches literal and regular-expression rules by target and scope', () => {
    const literal = normalizeHighlightRule({
      id: 1,
      uuid: 'a',
      pattern: 'hero',
      scope: 'Book',
      style: { bold: true },
    });
    const regex = normalizeHighlightRule({
      id: 2,
      uuid: 'b',
      pattern: 'v\\d+',
      isRegex: true,
      applyToTitle: true,
      applyToBody: false,
      style: { textColor: -65536 },
    });
    expect(
      matchHighlightRules('hero hero', [literal], 'body', 'My Book'),
    ).toHaveLength(2);
    expect(
      matchHighlightRules('v12', [regex], 'title', 'Any')[0],
    ).toMatchObject({ start: 0, end: 3, ruleId: 2 });
    expect(matchHighlightRules('hero', [literal], 'body', 'Other')).toEqual([]);
  });
  it('rejects malformed regex', () =>
    expect(() =>
      normalizeHighlightRule({ pattern: '[', isRegex: true }),
    ).toThrow('正则表达式无效'));
  it('maps supported Android highlight channels to React Native text styles', () =>
    expect(
      highlightTextStyle({
        fill: -2130771968,
        fillShape: 'PILL',
        box: { color: -65536 },
        underline: { kind: 'DOUBLE', color: -16711936 },
        shadow: { radius: 20, dx: -20, dy: 2, color: -2147483648 },
      }),
    ).toMatchObject({
      backgroundColor: '#ff000080',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#ff0000ff',
      textDecorationStyle: 'double',
      textDecorationColor: '#00ff00ff',
      textShadowRadius: 10,
      textShadowOffset: { width: -10, height: 2 },
    }));
  it('maps advanced fill, wave and emphasis channels to JS geometry', () => {
    expect(
      highlightGeometry({ fill: -2130771968, fillShape: 'HALF' }).fillBand,
    ).toEqual({ topRatio: 0.5, bottomRatio: 0.94, marker: false });
    expect(
      highlightGeometry({ fill: -2130771968, fillShape: 'BASELINE' }).fillBand,
    ).toEqual({ topRatio: 0.82, bottomRatio: 0.96, marker: false });
    expect(
      highlightGeometry({ fill: -2130771968, fillShape: 'MARKER' }).fillBand
        ?.marker,
    ).toBe(true);
    expect(
      highlightGeometry({ underline: { kind: 'WAVY', width: 2 } }).wavy,
    ).toEqual({ color: undefined, width: 2 });
    expect(highlightGeometry({ emphasis: { color: -65536 } }).emphasis).toEqual(
      { color: -65536 },
    );
    expect(wavePath(8, 10, 1)).toMatch(/^M0\.00 10\.00 L2\.00/);
  });
  it('splits overlapping matches into merged styled segments', () => {
    const segments = highlightSegments('abcdef', [
      { start: 1, end: 4, ruleId: 1, style: { bold: true } },
      { start: 3, end: 5, ruleId: 2, style: { italic: true } },
    ]);
    expect(segments.map(item => item.text)).toEqual(['a', 'bc', 'd', 'e', 'f']);
    expect(segments.map(item => item.ruleIds)).toEqual([
      [],
      [1],
      [1, 2],
      [2],
      [],
    ]);
    expect(segments[2].style).toMatchObject({ bold: true, italic: true });
  });
});
