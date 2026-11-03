/** Java Pattern's default \\s is ASCII, unlike JavaScript's Unicode \\s. */
const nameSuffix =
  /[\t\n\v\f\r ]+作[\t\n\v\f\r ]*者[^\r\n\u0085\u2028\u2029]*|[\t\n\v\f\r ]+[^\t\n\v\f\r ]+[\t\n\v\f\r ]+著/g;
const authorMarker =
  /^[\t\n\v\f\r ]*作[\t\n\v\f\r ]*者[:：\t\n\v\f\r ]+|[\t\n\v\f\r ]+著/g;
const trimNative = (value: string) =>
  value.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');

export const formatNativeBookName = (value: string) =>
  trimNative(value.replace(nameSuffix, ''));
export const formatNativeBookAuthor = (value: string) =>
  trimNative(value.replace(authorMarker, ''));

/** Java DecimalFormat's HALF_EVEN rounding of the actual IEEE-754 double to one decimal. */
function roundDoubleToTenths(value: number): bigint {
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setFloat64(0, value, false);
  const high = bytes.getUint32(0, false),
    low = bytes.getUint32(4, false);
  const exponent = ((high >>> 20) & 0x7ff) - 1023;
  const significand =
    (1n << 52n) | (BigInt(high & 0xfffff) << 32n) | BigInt(low);
  const numerator = significand * 10n;
  const shift = 52 - exponent;
  if (shift <= 0) return numerator << BigInt(-shift);
  const denominator = 1n << BigInt(shift);
  const integer = numerator / denominator,
    remainder = numerator % denominator;
  const doubled = remainder * 2n;
  return (
    integer +
    (doubled > denominator || (doubled === denominator && integer % 2n === 1n)
      ? 1n
      : 0n)
  );
}

/** StringUtils.wordCountFormat for the Chinese/default decimal locale; undefined means Int overflow. */
export function formatNativeWordCount(value: string): string | undefined {
  if (!/^-?[0-9]+$/.test(value)) return value;
  const negative = value.startsWith('-');
  const digits = value.slice(negative ? 1 : 0).replace(/^0+/, '') || '0';
  if (digits.length > 10) return undefined;
  const n = BigInt(`${negative ? '-' : ''}${digits}`);
  if (n < -2147483648n || n > 2147483647n) return undefined;
  if (n <= 0n) return '';
  if (n <= 10000n) return `${n}字`;
  const tenths = roundDoubleToTenths(Math.fround(Number(n)) / 10000);
  const fraction = tenths % 10n;
  return `${tenths / 10n}${fraction === 0n ? '' : `.${fraction}`}万字`;
}
