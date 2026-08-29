jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));

import { queryDictionary } from '../src/core/dictionary';

describe('dictionary query', () => {
  afterEach(() => jest.restoreAllMocks());

  it('substitutes the selected word and extracts the configured HTML rule', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      url: 'https://dict.test/hello',
      headers: { get: () => null },
      text: async () => '<main><div class="definition">a greeting</div></main>',
    } as unknown as Response);
    await expect(queryDictionary({
      name: 'Test',
      urlRule: 'https://dict.test/{{key}}',
      showRule: '.definition@text',
      enabled: true,
      sortNumber: 0,
    }, 'hello')).resolves.toBe('a greeting');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://dict.test/hello',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('does not execute disabled rules', async () => {
    await expect(queryDictionary({
      name: 'Off', urlRule: 'https://dict.test/{{key}}', showRule: '', enabled: false, sortNumber: 0,
    }, 'word')).rejects.toThrow('未启用');
  });
});
