import { bookMetadataLabels } from '../src/core/bookMetadataLabels';
test('native detail labels put word count first and split, trim and retain repeated kinds', () => {
  expect(
    bookMetadataLabels({
      wordCount: '1.2万字',
      kind: ' 玄幻, ,经典\n玄幻,\u3000科幻\u3000',
    }),
  ).toEqual(['1.2万字', '玄幻', '经典', '玄幻', '科幻']);
});
test('blank or missing fields do not create labels; nonblank word count is not trimmed', () => {
  expect(
    bookMetadataLabels({ wordCount: '\u00a0\u3000', kind: '  ,\n\t' }),
  ).toEqual([]);
  expect(bookMetadataLabels({ wordCount: ' 2万字 ', kind: undefined })).toEqual(
    [' 2万字 '],
  );
  expect(bookMetadataLabels({})).toEqual([]);
});
