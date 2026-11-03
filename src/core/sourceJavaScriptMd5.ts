/** Match Java UTF-8 replacement for unmatched surrogate code units. */
export function sourceJavaScriptMd5(input:string):string {
  const text=input.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g,part=>part.length===2?part:'?');
  const hash=require('react-native-quick-crypto').createHash('md5');
  hash.update(text,'utf8');
  return hash.digest('hex') as string;
}
