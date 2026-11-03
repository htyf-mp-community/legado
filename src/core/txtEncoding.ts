import { toByteArray } from 'react-native-quick-base64';
import { reSegmentContent } from './contentReSegment';
import { decodeSourceCharset } from './sourceCharsetDecode';
import { decodeTxtLegacy, legacyTxtCharset } from './txtLegacyDecode';
import { decodeRawUtf16 } from './rawUtf16Decode';
import { decodeSingleByte, supportsSingleByteCharset } from './singleByteCharset';
import { decodeUtf32Compatibility, utf32Order } from './utf32Compatibility';
import {decodeAutoUtf16, decodeRemainingCharset, supportsRemainingCharset} from './remainingCharsets';

export const TXT_CHARSETS = [
  'UTF-8',
  'GB18030',
  'GBK',
  'BIG5',
  'UTF-16LE',
  'UTF-16BE',
] as const;

export function decodeTxtBase64(base64: string, charset = 'UTF-8') {
  const key = charset.toLowerCase().replace(/:\d{4}$|[^a-z0-9]/g, '');
  if (key === 'utf8' || key === 'unicode11utf8')
    return decodeSourceCharset(toByteArray(base64), 'UTF-8').replace(/^\uFEFF{1,2}/, '');
  if (key === 'utf16le' || key === 'ucs2' || key === 'utf16be')
    return decodeRawUtf16(toByteArray(base64), key !== 'utf16be').replace(/^\uFEFF{1,2}/, '');
  if (key === 'utf16') return decodeAutoUtf16(toByteArray(base64)).replace(/^\uFEFF{1,2}/, '');
  const utf32 = utf32Order(charset);
  if (utf32) return decodeUtf32Compatibility(toByteArray(base64), utf32).replace(/^\uFEFF{1,2}/, '');
  const kind = legacyTxtCharset(key);
  if (kind) return decodeTxtLegacy(toByteArray(base64), kind).replace(/^\uFEFF/, '');
  if (supportsSingleByteCharset(charset)) return decodeSingleByte(toByteArray(base64), charset).replace(/^\uFEFF/, '');
  if (supportsRemainingCharset(charset)) {
    const decoded = decodeRemainingCharset(toByteArray(base64), charset);
    return decoded.replace(key === 'cesu8' || key === 'utf7' || key === 'unicode11utf7' || key === 'utf7imap' ? /^\uFEFF{1,2}/ : /^\uFEFF/, '');
  }
  throw new Error('UNSUPPORTED_CHARSET');
}

/** Complete native paragraph repair, including its probabilistic long splits. */
export function reSegmentText(content: string, chapterTitle = '', random?: () => number) {
  return reSegmentContent(content, chapterTitle, random);
}
