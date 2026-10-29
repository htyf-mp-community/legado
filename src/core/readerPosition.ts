/** ContentProcessor's nonempty indented lines and TextChapter's UTF-16 chapter positions. */
function paragraphPositions(
  title: string,
  text: string,
  indent: string,
  titleVisible: boolean,
  honorSpecialPageBreaks: boolean,
) {
  let cursor = titleVisible ? title.length + 1 : 0;
  return [...text.matchAll(/[^\r\n]+/g)].flatMap(match => {
    const value = match[0],
      leading = value.match(/^[\u0000-\u0020\u3000]*/)?.[0].length ?? 0;
    const body = value.slice(leading).replace(/[\u0000-\u0020\u3000]*$/, '');
    if (!body || (honorSpecialPageBreaks && body === '[newpage]')) return [];
    const position = cursor + indent.length;
    cursor = position + body.length + 1;
    return [
      {
        start: match.index! + leading,
        end: match.index! + leading + body.length,
        position,
      },
    ];
  });
}
const safe = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
export function nativeTextOffset(
  title: string,
  text: string,
  offset: number,
  indent = '　　',
  titleVisible = true,
  honorSpecialPageBreaks = false,
) {
  const target = safe(offset);
  if (!target) return 0;
  const rows = paragraphPositions(
    title,
    text,
    indent,
    titleVisible,
    honorSpecialPageBreaks,
  );
  for (const row of rows)
    if (target <= row.end)
      return row.position + Math.max(0, target - row.start);
  const last = rows.at(-1);
  return last ? last.position + last.end - last.start : 0;
}
export function displayTextOffset(
  title: string,
  text: string,
  position: number,
  indent = '　　',
  titleVisible = true,
  honorSpecialPageBreaks = false,
) {
  const target = safe(position);
  if (!target || (titleVisible && target < title.length + 1)) return 0;
  for (const row of paragraphPositions(
    title,
    text,
    indent,
    titleVisible,
    honorSpecialPageBreaks,
  ))
    if (target <= row.position + row.end - row.start)
      return row.start + Math.max(0, target - row.position);
  return text.length;
}
export function textPageAtOffset(
  ranges: ReadonlyArray<{ start: number }>,
  offset: number,
) {
  let index = 0;
  for (let at = 0; at < ranges.length; at++) {
    if (ranges[at].start > offset) break;
    index = at;
  }
  return index;
}
