import {
  normalizeSimulatedReading,
  removeDuplicateChapterTitle,
  reverseContentLines,
  simulatedChapterCount,
} from '../src/core/readerAdvanced';

test('reverses chapter content by lines like the Android action', () => {
  expect(reverseContentLines('第一段\n第二段\n第三段')).toBe(
    '第三段\n第二段\n第一段',
  );
});

test('removes only an exact normalized duplicate title at the beginning', () => {
  expect(removeDuplicateChapterTitle('第 12 章\n\n正文', '第十二章')).toBe(
    '第 12 章\n\n正文',
  );
  expect(removeDuplicateChapterTitle('第十二章\n\n正文', '第 十二 章')).toBe(
    '正文',
  );
  expect(removeDuplicateChapterTitle('序言\n正文', '第一章')).toBe(
    '序言\n正文',
  );
});

test('calculates simulated unlocked chapters from local calendar days', () => {
  expect(
    simulatedChapterCount(
      {
        simulatedReading: {
          enabled: true,
          startDate: '2026-08-27',
          startChapter: 2,
          dailyChapters: 3,
        },
      },
      30,
      new Date('2026-08-29T12:00:00'),
    ),
  ).toBe(11);
  expect(simulatedChapterCount({}, 30)).toBe(30);
});

test('normalizes simulation bounds and rejects invalid dates', () => {
  expect(
    normalizeSimulatedReading(
      {
        enabled: true,
        startDate: '2020-01-01',
        startChapter: 99,
        dailyChapters: 0,
      },
      20,
    ),
  ).toEqual({
    enabled: true,
    startDate: '2020-01-01',
    startChapter: 20,
    dailyChapters: 3,
  });
  expect(() =>
    normalizeSimulatedReading({ startDate: 'invalid' }, 20),
  ).toThrow('INVALID_SIMULATED_DATE');
});
