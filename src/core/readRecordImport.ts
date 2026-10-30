import {
  compactGsonJson,
  parseGsonLegacyJson,
  type GsonJsonValue,
} from './gsonJson';
import { storeReadRecordLong, type ReadRecordLong } from './readRecord';

/** Gson can reflect explicit JSON null into non-null Kotlin String properties. */
export type NativeReadRecord = {
  deviceId: string | null;
  bookName: string | null;
  author: string | null;
  readTime: ReadRecordLong;
  lastRead: ReadRecordLong;
};
const MIN = -(1n << 63n),
  MAX = (1n << 63n) - 1n;
const isNull = (value: GsonJsonValue) =>
  value.kind === 'literal' && value.value === 'null';

// Gson 2.14 JsonReader rejects non-ASCII numeric strings before Long.parseLong.
function integer(value: string): bigint | null {
  if (!/^[+-]?\d+$/.test(value)) return null;
  try {
    const result = BigInt(value);
    return result >= MIN && result <= MAX ? result : null;
  } catch {
    return null;
  }
}

function javaDouble(value: string): number {
  const raw = value.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');
  const decimal = /^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)[fFdD]?$/;
  if (decimal.test(raw)) return Number(raw.replace(/[fFdD]$/, ''));
  const hex =
    /^([+-]?)0[xX]([\da-fA-F]*)(?:\.([\da-fA-F]*))?[pP]([+-]?\d+)[fFdD]?$/.exec(
      raw,
    );
  if (hex && (hex[2] || hex[3])) {
    const mantissa = BigInt('0x' + hex[2] + (hex[3] ?? ''));
    if (mantissa === 0n) return 0;
    const shift = Number(hex[4]) - (hex[3]?.length ?? 0) * 4;
    const bits = mantissa.toString(2).length;
    const exponent = bits - 1 + shift;
    if (exponent > 1023) return hex[1] === '-' ? -Infinity : Infinity;
    // This decoder is only used by Long: below one, only IEEE underflow to zero can pass.
    if (exponent < 0) {
      if (
        exponent < -1075 ||
        (exponent === -1075 && (mantissa & (mantissa - 1n)) === 0n)
      )
        return 0;
      return Number.MIN_VALUE;
    }
    // Round the significand before Number conversion; a huge mantissa may still scale to 1.
    const discarded = Math.max(0, bits - 53);
    let top = mantissa >> BigInt(discarded);
    if (discarded) {
      const tail = mantissa - (top << BigInt(discarded));
      const half = 1n << BigInt(discarded - 1);
      if (tail > half || (tail === half && (top & 1n) !== 0n)) top++;
    }
    return (hex[1] === '-' ? -1 : 1) * Number(top) * 2 ** (shift + discarded);
  }
  return NaN;
}

// JsonReader.nextLong first tries Long.parseLong, then checks a Java double-to-long cast.
// The equality check deliberately accepts the rounded 2^63 double as Long.MAX_VALUE.
function long(value: GsonJsonValue, field: string): ReadRecordLong {
  if (value.kind !== 'string' && value.kind !== 'literal')
    throw new Error(`阅读记录字段 ${field} 不是有效的 Long`);
  const exact = integer(value.value);
  if (exact !== null) return storeReadRecordLong(exact);
  const number = javaDouble(value.value);
  if (!Number.isFinite(number) || !Number.isInteger(number))
    throw new Error(`阅读记录字段 ${field} 不是有效的 Long`);
  const cast =
    number >= Number(MAX) ? MAX : number <= Number(MIN) ? MIN : BigInt(number);
  if (Number(cast) !== number)
    throw new Error(`阅读记录字段 ${field} 超出 Long 范围`);
  return storeReadRecordLong(cast);
}

/**
 * Decode native readRecord.json with Gson's InputStream/list/reflective-field contracts.
 * Null array elements and any invalid Long reject the entire file; String adapters coerce JSON.
 * Unknown fields are discarded. Duplicate fields are applied in input order; null primitive
 * fields retain their previous/default millisecond value. Explicit nullable Strings remain null
 * so restore can report their native insertion failure rather than silently inventing values.
 * `now` supplies the entity constructor's millisecond clock; no application data is written.
 */
export function parseNativeReadRecords(
  raw: string,
  now: () => number = Date.now,
): NativeReadRecord[] {
  const parsed = parseGsonLegacyJson(raw);
  if (parsed.kind !== 'array') throw new Error('阅读记录必须是数组');
  return parsed.values.map(value => {
    if (value.kind !== 'object')
      throw new Error('阅读记录列表必须是无空项的对象数组');
    const record: NativeReadRecord = {
      deviceId: '',
      bookName: '',
      author: '',
      readTime: 0,
      lastRead: now(),
    };
    for (const [field, item] of value.entries) {
      if (field === 'deviceId' || field === 'bookName' || field === 'author')
        record[field] = isNull(item)
          ? null
          : item.kind === 'string'
            ? item.value
            : compactGsonJson(item);
      else if ((field === 'readTime' || field === 'lastRead') && !isNull(item))
        record[field] = long(item, field);
    }
    return record;
  });
}
