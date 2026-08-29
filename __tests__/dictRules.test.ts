jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));

import { mergeDictRules, normalizeDictRule, parseDictRules } from '../src/data/dictRules';

describe('dictionary rules', () => {
  it('normalizes the Android-compatible entity shape', () => {
    expect(normalizeDictRule({ name: '海词', urlRule: 'https://x.test/{{key}}' })).toEqual({
      name: '海词', urlRule: 'https://x.test/{{key}}', showRule: '', enabled: true, sortNumber: 0,
    });
  });
  it('imports a single object and overwrites by primary-key name', () => {
    const incoming = parseDictRules('{"name":"A","urlRule":"https://new","sortNumber":2}');
    expect(mergeDictRules([{ name: 'A', urlRule: 'https://old', showRule: '', enabled: false, sortNumber: 0 }], incoming)[0]).toMatchObject({ name: 'A', urlRule: 'https://new', enabled: true });
  });
  it('rejects entries without a request URL', () => {
    expect(() => parseDictRules('[{"name":"broken"}]')).toThrow('缺少请求地址');
  });
});
