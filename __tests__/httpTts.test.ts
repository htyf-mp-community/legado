jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }) }));
jest.mock('@dr.pogodin/react-native-fs', () => ({ CachesDirectoryPath: '/cache', mkdir: jest.fn(), writeFile: jest.fn() }));
jest.mock('react-native-quick-base64', () => ({ fromByteArray: () => 'BASE64' }));
import { buildHttpTtsRequest, expandHttpTtsUrl, splitTtsText } from '../src/core/httpTts';
import { parseHttpTtsRules } from '../src/data/httpTtsRules';
const rule = parseHttpTtsRules('[{"id":-100,"name":"百度","url":"https://tts.test/audio,{\\"method\\":\\"POST\\",\\"body\\":\\"tex={{java.encodeURI(java.encodeURI(speakText))}}&spd={{(speakSpeed + 5) / 10 + 4}}\\"}","contentType":"audio/wav"}]')[0];
describe('HTTP TTS', () => {
  it('expands Android-compatible text and speed variables', () => expect(expandHttpTtsUrl(rule.url, '你好 world', 10)).toContain(`tex=${encodeURIComponent(encodeURIComponent('你好 world'))}&spd=5.5`));
  it('builds the configured POST audio request', () => expect(buildHttpTtsRequest(rule, 'hello', 10)).toMatchObject({ url: 'https://tts.test/audio', method: 'POST', body: 'tex=hello&spd=5.5' }));
  it('preserves optional Android source fields', () => expect(parseHttpTtsRules('{"name":"T","url":"https://x","loginUi":[{"name":"token"}],"pauseDuration":20000}')[0]).toMatchObject({ loginUi: '[{"name":"token"}]', pauseDuration: 10000 }));
  it('splits long text at sentence boundaries without losing content', () => {
    const source = '第一句话。第二句话非常非常长而且仍然没有结束。第三句话也需要被完整保留。';
    const chunks = splitTtsText(source, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(source);
  });
});
