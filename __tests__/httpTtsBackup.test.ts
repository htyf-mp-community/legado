jest.mock('../src/data/storage', () => ({
  APP_STORAGE_ID: 'io.legado.htyf.application-storage',
  appStorage: { getString: () => undefined, getNumber: () => undefined },
}));
import { convertLegacyBackup } from '../src/data/legacyBackup';
import { defaultHttpTts } from '../src/data/defaultHttpTts';
import { HTTP_TTS_KEY, parseHttpTts } from '../src/data/httpTts';

beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(1_793_159_668_000));
afterEach(() => jest.restoreAllMocks());

// The former removal-wiring assertions explicitly prohibited source narration.
// The 1:1 migration restores that feature; verify its real Android backup contract.
test('recognizes Android httpTTS.json and preserves every default engine during backup conversion', () => {
  const result = convertLegacyBackup({
    'httpTTS.json': JSON.stringify(defaultHttpTts),
  });
  expect(result.importedFiles).toContain('httpTTS.json');
  expect(result.warnings).toEqual([]);
  expect(
    JSON.parse(result.payload.entries[HTTP_TTS_KEY].value as string),
  ).toEqual(parseHttpTts(JSON.stringify(defaultHttpTts)));
});

test('malformed TTS backup is reported without discarding other valid backup datasets', () => {
  const result = convertLegacyBackup({
    'httpTTS.json': '[{"name":"incomplete"}]',
    'txtTocRule.json': '[{"name":"chapters","rule":"^第.*章","enable":true}]',
  });
  expect(result.payload.entries[HTTP_TTS_KEY]).toBeUndefined();
  expect(result.payload.entries['txt.toc.rules.v1']).toBeDefined();
  expect(result.warnings.some(value => value.startsWith('httpTTS.json:'))).toBe(
    true,
  );
});
