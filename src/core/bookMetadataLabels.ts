/** BaseBook.getKindList: word count first, then nonblank comma/newline-separated kinds. */
export function bookMetadataLabels(book: {
  wordCount?: string;
  kind?: string;
}): string[] {
  const whitespace =
    '[\\u0009-\\u000d\\u001c-\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]';
  const trim = new RegExp(`^${whitespace}+|${whitespace}+$`, 'g');
  const labels: string[] = [];
  if (book.wordCount && book.wordCount.replace(trim, ''))
    labels.push(book.wordCount);
  if (book.kind)
    labels.push(
      ...book.kind
        .split(/[,\n]/)
        .map(value => value.replace(trim, ''))
        .filter(Boolean),
    );
  return labels;
}
