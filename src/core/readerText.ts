import { convertChinese, type ChineseConverterType } from './chineseConversion';
import { reSegmentContent } from './contentReSegment';

/** ContentProcessor order after duplicate-title removal, before HTML protection/replacement. */
export function prepareReaderText(
  content: string,
  title: string,
  reSegment: boolean,
  mode: ChineseConverterType,
  random?: () => number,
): string {
  if (content === 'null') return content;
  return convertChinese(
    reSegment ? reSegmentContent(content, title, random) : content,
    mode,
  );
}
