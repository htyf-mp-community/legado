import {
  coverTitleColumnOffsets,
  coverTitleTextSize,
  verticalCoverGlyphs,
} from '../src/core/coverLayout';

test('long titles retain every Unicode code point across bottom-aligned columns', () => {
  const title = '一二三四五六七八九十甲乙丙丁戊己庚辛壬癸😀';
  const glyphs = verticalCoverGlyphs(title, '', false, 300, 400);
  expect(glyphs.map(glyph => glyph.text).join('')).toBe(title);
  const columns = [...new Set(glyphs.map(glyph => glyph.x))].map(x =>
    glyphs.filter(glyph => glyph.x === x),
  );
  expect(columns.length).toBeGreaterThan(1);
  const lastBaseline = columns[0].at(-1)!.y;
  columns.forEach(column => expect(column.at(-1)!.y).toBeCloseTo(lastBaseline));
  expect(glyphs.every(glyph => glyph.size === 300 / 9)).toBe(true);
});

test('a final character stays in the current column when the source spacing permits it', () => {
  expect(coverTitleColumnOffsets(4, 100, 24)).toEqual([[0, 24, 48, 67.2]]);
  expect(coverTitleColumnOffsets(0, 100, 24)).toEqual([]);
  expect(coverTitleTextSize(70, 100, 3, 12)).toBe(10);
});

test('author uses a separate right column, respects its visibility and clips a long author', () => {
  const titleOnly = verticalCoverGlyphs('书', '作者', false, 300, 400);
  expect(titleOnly.map(glyph => glyph.text).join('')).toBe('书');
  const glyphs = verticalCoverGlyphs(
    '书',
    '非常长的作者名称'.repeat(20),
    true,
    300,
    400,
  );
  const author = glyphs.filter(glyph => !glyph.bold);
  expect(author.length).toBeGreaterThan(0);
  expect(author.length).toBeLessThan(160);
  expect(
    author.every(
      glyph => glyph.x === 240 && glyph.size === 30 && glyph.y <= 380,
    ),
  ).toBe(true);
});
