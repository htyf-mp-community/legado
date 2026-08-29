import {
  previewReplacementRules,
  shouldCancelTwoFingerPreview,
} from '../src/core/readerReplacePreview';

describe('two-finger replacement preview', () => {
  const starts = [
    { x: 10, y: 20 },
    { x: 80, y: 90 },
  ];

  test('keeps a stable two-finger hold pending inside the touch slop', () => {
    expect(
      shouldCancelTwoFingerPreview(starts, [
        { x: 14, y: 24 },
        { x: 75, y: 94 },
      ]),
    ).toBe(false);
  });

  test('cancels when a pointer moves beyond slop or disappears', () => {
    expect(
      shouldCancelTwoFingerPreview(starts, [
        { x: 30, y: 20 },
        { x: 80, y: 90 },
      ]),
    ).toBe(true);
    expect(shouldCancelTwoFingerPreview(starts, [starts[0]])).toBe(true);
  });

  test('temporarily removes configured rules or restores available rules', () => {
    const available = ['a', 'b'];
    expect(previewReplacementRules(['a'], available, false)).toEqual(['a']);
    expect(previewReplacementRules(['a'], available, true)).toEqual([]);
    expect(previewReplacementRules([], available, true)).toEqual(available);
  });
});
