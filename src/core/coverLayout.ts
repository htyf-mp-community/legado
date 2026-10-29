/** Geometry from CoverImageView. Android default-font metrics are used until host font parity is verified. */
export const COVER_TEXT_HEIGHT_RATIO = 1.171875;
export function coverTitleTextSize(
  width: number,
  height: number,
  count: number,
  largeTextHeight: number,
) {
  return (count - 2) * largeTextHeight > height * 0.7 ||
    (count - 3) * largeTextHeight > height * 0.6
    ? width / 9
    : width / 7;
}
export function coverTitleColumnOffsets(
  count: number,
  height: number,
  textHeight: number,
): number[][] {
  if (count <= 0 || height <= 0 || textHeight <= 0) return [];
  const columns: number[][] = [];
  let column: number[] = [],
    offset = 0,
    line = 0,
    nextY = height * 0.2;
  for (let index = 0; index < count; index++) {
    column.push(offset);
    offset += textHeight;
    nextY += textHeight;
    const remaining = count - index - 1;
    if (nextY > height * 0.9) {
      if (remaining === 1) {
        nextY -= textHeight / 5;
        offset -= textHeight / 5;
      } else if (remaining > 0) {
        columns.push(column);
        column = [];
        offset = 0;
        nextY = height * 0.2 + textHeight * ++line;
      }
    } else if (nextY > height * 0.8 && remaining > 2) {
      columns.push(column);
      column = [];
      offset = 0;
      nextY = height * 0.2 + textHeight * ++line;
    }
  }
  if (column.length) columns.push(column);
  return columns;
}
export type CoverGlyph = {
  text: string;
  x: number;
  y: number;
  size: number;
  bold: boolean;
};
export function verticalCoverGlyphs(
  title: string,
  author: string,
  drawAuthor: boolean,
  width: number,
  height: number,
): CoverGlyph[] {
  const characters = [...title],
    glyphs: CoverGlyph[] = [];
  const size = coverTitleTextSize(
    width,
    height,
    characters.length,
    (width / 7) * COVER_TEXT_HEIGHT_RATIO,
  );
  const columns = coverTitleColumnOffsets(
    characters.length,
    height,
    size * COVER_TEXT_HEIGHT_RATIO,
  );
  const bottom = Math.max(0, ...columns.map(column => column.at(-1) ?? 0));
  let index = 0;
  columns.forEach((column, columnIndex) => {
    const startY = height * 0.2 + Math.max(0, bottom - (column.at(-1) ?? 0));
    column.forEach(offset =>
      glyphs.push({
        text: characters[index++],
        x: width * 0.2 + size * columnIndex,
        y: startY + offset,
        size,
        bold: true,
      }),
    );
  });
  if (drawAuthor) {
    const authorSize = width / 10,
      authorHeight = authorSize * COVER_TEXT_HEIGHT_RATIO;
    let y = Math.max(
      height * 0.95 - [...author].length * authorHeight,
      height * 0.3,
    );
    for (const text of [...author]) {
      glyphs.push({ text, x: width * 0.8, y, size: authorSize, bold: false });
      y += authorHeight;
      if (y > height * 0.95) break;
    }
  }
  return glyphs;
}
