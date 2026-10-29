const mockStorage = new Map<string, string>();
jest.mock('../src/data/storage', () => ({
  appStorage: {
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string) => mockStorage.set(key, value),
  },
}));
jest.mock('../src/data/generalPreferences', () => ({
  loadGeneralPreferences: () => ({ userAgent: '' }),
}));
jest.mock('../src/data/sourceCookies', () => ({
  sourceCookieHeader: () => '',
}));
jest.mock('../src/data/httpLog', () => ({ addHttpLog: jest.fn() }));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
import { defaultHttpTts } from '../src/data/defaultHttpTts';
import {
  loadHttpTts,
  loadReadAloudPreferences,
  mergeHttpTts,
  normalizeHttpTts,
  parseHttpTts,
  saveHttpTts,
  saveReadAloudPreferences,
  restoreDefaultHttpTts,
} from '../src/data/httpTts';
import {
  buildHttpTtsRequest,
  httpTtsAudioExtension,
  httpTtsPause,
  httpTtsValue,
  isSilentReadAloudParagraph,
  readAloudParagraphs,
  validateHttpTtsResponse,
} from '../src/core/httpTts';
import { readerImageMarker, readerLinkMarker } from '../src/core/readerImages';
import { backupCategoryForKey } from '../src/data/backupPreferences';

beforeEach(() => mockStorage.clear());
test('initializes bundled Android engines once, while preserving an intentionally empty list', () => {
  expect(loadHttpTts().map(engine => engine.id)).toEqual(
    defaultHttpTts.map(engine => engine.id),
  );
  expect(mockStorage.has('http.tts.engines.v1')).toBe(true);
  saveHttpTts([]);
  expect(loadHttpTts()).toEqual([]);
});

test('default-engine restore removes obsolete negative IDs while preserving custom engines', () => {
  const current = parseHttpTts(
    '[{"id":-999,"name":"obsolete","url":"https://old"},{"id":88,"name":"custom","url":"https://custom"}]',
  );
  const restored = restoreDefaultHttpTts(current);
  expect(restored.some(engine => engine.id === -999)).toBe(false);
  expect(restored.find(engine => engine.id === 88)?.name).toBe('custom');
  expect(restored.some(engine => engine.id === -100)).toBe(true);
});
test('preserves all Android default engine fields and normalizes loginUi arrays', () => {
  const engines = parseHttpTts(JSON.stringify(defaultHttpTts));
  expect(engines).toHaveLength(defaultHttpTts.length);
  expect(engines[1].loginUi).toBe(JSON.stringify(defaultHttpTts[1].loginUi));
  expect(engines[2].jsLib).toBe(defaultHttpTts[2].jsLib);
  expect(engines[2].loginCheckJs).toBe(defaultHttpTts[2].loginCheckJs);
  expect(
    normalizeHttpTts({ name: 'x', url: 'https://x', pauseDuration: 20_000 })
      .pauseDuration,
  ).toBe(10_000);
  expect(
    normalizeHttpTts({ name: 'x', url: 'https://x', pauseDuration: -1 })
      .pauseDuration,
  ).toBe(0);
});
test('engine primary-key merge, isolated persistence and Android defaults survive reload', () => {
  const first = normalizeHttpTts({
    id: 1,
    name: 'first',
    url: 'https://tts.test',
    customField: { value: 4 },
  });
  saveHttpTts([first]);
  saveHttpTts(mergeHttpTts(loadHttpTts(), [{ ...first, name: 'updated' }]));
  expect(loadHttpTts()).toEqual([{ ...first, name: 'updated' }]);
  expect(loadReadAloudPreferences()).toEqual({
    speechRate: 5,
    timerMinutes: 0,
  });
  saveReadAloudPreferences({ engineId: -100, speechRate: 99 });
  expect(loadReadAloudPreferences()).toEqual({
    engineId: -100,
    speechRate: 45,
    timerMinutes: 0,
  });
  expect(backupCategoryForKey('http.tts.engines.v1')).toBe('rules');
});
test('malformed import never overwrites previously saved engines', () => {
  saveHttpTts(parseHttpTts('{"id":1,"name":"good","url":"https://tts.test"}'));
  expect(() =>
    parseHttpTts('[{"name":"good","url":"https://x"},{"name":"bad"}]'),
  ).toThrow();
  expect(loadHttpTts()[0].name).toBe('good');
});
test('bundled Baidu rule matches Java URLEncoder, speed formula and HTTP POST fields', () => {
  const engine = parseHttpTts(JSON.stringify(defaultHttpTts[0]))[0];
  const request = buildHttpTtsRequest(engine, '你好 a!', 10);
  expect(request.url).toBe('http://tts.baidu.com/text2audio');
  expect(request.method).toBe('POST');
  expect(request.body).toContain(
    'tex=%25E4%25BD%25A0%25E5%25A5%25BD%2Ba%2521&spd=5.5&',
  );
  expect(request.sourceId).toBe('httpTts:-100');
});
test('JSON body interpolates text without allowing quotes to inject request fields', () => {
  const engine = normalizeHttpTts({
    name: 'json',
    url: 'https://tts.test,{"method":"POST","body":{"text":"{{speakText}}","rate":{{(speakSpeed-10)*20}}}}',
  });
  const request = buildHttpTtsRequest(engine, 'quote"\nline\\end', 15);
  expect(JSON.parse(request.body!)).toEqual({
    text: 'quote"\nline\\end',
    rate: 100,
  });
  const literal = buildHttpTtsRequest(
    engine,
    'searchKey searchPage {{key}}',
    15,
  );
  expect(JSON.parse(literal.body!).text).toBe('searchKey searchPage {{key}}');
});
test('untrusted JavaScript and non-finite arithmetic are rejected before network execution', () => {
  for (const expression of [
    'globalThis.secret',
    'speakSpeed;fetch("https://x")',
    '1/0',
    '1..2',
    'java.get("x")',
  ])
    expect(() => httpTtsValue(expression, 'text', 10)).toThrow();
  expect(() =>
    buildHttpTtsRequest(
      parseHttpTts(JSON.stringify(defaultHttpTts[2]))[0],
      'text',
      10,
    ),
  ).toThrow();
  expect(httpTtsValue('String((speakSpeed + 5) / 10 + 4)', 'text', 10)).toBe(
    '5.5',
  );
});
test('audio response validation follows source content-type handling', () => {
  expect(() => validateHttpTtsResponse('application/json')).toThrow();
  expect(() => validateHttpTtsResponse('text/html; charset=utf8')).toThrow();
  expect(() =>
    validateHttpTtsResponse('audio/mpeg; charset=binary', 'audio/.*'),
  ).not.toThrow();
  expect(() => validateHttpTtsResponse('audio/wav', 'audio/mpeg')).toThrow();
});

test('valid WAV bytes retain a playable iOS extension even with a generic response MIME', () => {
  const wave = Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
  expect(httpTtsAudioExtension('application/octet-stream', wave)).toBe('wav');
  expect(
    httpTtsAudioExtension('audio/mp4; codecs=mp4a.40.2', new Uint8Array()),
  ).toBe('m4a');
  expect(httpTtsAudioExtension('audio/mpeg', new Uint8Array())).toBe('mp3');
});
test('paragraph text excludes image URLs and speaks visible links, including symbol-only silence', () => {
  const content = `第一段\n${readerImageMarker({ src: 'https://private.test/image' })}\n${readerLinkMarker({ text: '链接文字', url: 'https://private.test' })}`;
  expect(readAloudParagraphs(content)).toEqual(['第一段', '链接文字']);
  expect(isSilentReadAloudParagraph('　……！★')).toBe(true);
  expect(isSilentReadAloudParagraph('正文。')).toBe(false);
  expect(httpTtsPause(0, 2, 10_001)).toBe(10_000);
  expect(httpTtsPause(2, 2, 1000)).toBe(0);
});
