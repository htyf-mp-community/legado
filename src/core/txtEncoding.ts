import iconv from 'iconv-lite';
import { toByteArray } from 'react-native-quick-base64';
import { reSegmentContent } from './contentReSegment';

export const TXT_CHARSETS = [
  'UTF-8',
  'GB18030',
  'GBK',
  'BIG5',
  'UTF-16LE',
  'UTF-16BE',
] as const;

export function decodeTxtBase64(base64: string, charset = 'UTF-8') {
  if (!iconv.encodingExists(charset)) throw new Error('UNSUPPORTED_CHARSET');
  return iconv.decode(toByteArray(base64), charset).replace(/^\uFEFF/, '');
}

/** Complete native paragraph repair, including its probabilistic long splits. */
export function reSegmentText(content: string, chapterTitle = '', random?: () => number) {
  return reSegmentContent(content, chapterTitle, random);
}
