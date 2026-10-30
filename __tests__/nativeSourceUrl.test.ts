import { resolveNativeSourceUrl, resolveNativeResourceUrl } from '../src/core/nativeSourceUrl';
import { encodeSourceParams } from '../src/core/sourceUrlEncoding';
import native from './fixtures/sourceUrl.native.json';

test('matches native absolute URL resolution without runtime URL normalization', () => {
  const differences = native.cases.filter(item => item.kind !== 'params').flatMap(item => {
    const actual = (item.kind === 'resource' ? resolveNativeResourceUrl : resolveNativeSourceUrl)(item.value, item.base ?? '');
    return actual === item.expected ? [] : [{ item, actual }];
  });
  expect({ count: differences.length, sample: differences.slice(0, 12) }).toEqual({ count: 0, sample: [] });
});

test('matches unchanged native query/form encoders and their surrogate behavior', () => {
  const differences = native.cases.filter(item => item.kind === 'params').flatMap(item => {
    const actual = encodeSourceParams(item.value, item.charset, item.isQuery);
    return actual === item.expected ? [] : [{ item, actual }];
  });
  expect({ count: differences.length, sample: differences.slice(0, 12) }).toEqual({ count: 0, sample: [] });
});
