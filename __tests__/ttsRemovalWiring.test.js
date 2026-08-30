const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('text narration and HTTP TTS are absent from runtime routes and screens', () => {
  const index = read('src/index.tsx');
  const audio = read('src/screens/AudioPlayer.tsx');
  expect(index).not.toMatch(/HttpTtsRules|HttpTtsRuleManager|readAloud/);
  expect(index).toMatch(/book\.sourceType === 1 \? \([\s\S]*?audioPlayback/);
  expect(audio).not.toMatch(/httpTts|ttsRules|synthesizeHttpTts|splitTtsText/i);
  expect(audio).toContain("book.sourceType !== 1");
});

test('TTS rules are absent from QR and legacy backup ingestion', () => {
  expect(read('src/core/qrPayload.ts')).not.toMatch(/httpTts/i);
  expect(read('src/data/qrImport.ts')).not.toMatch(/httpTts/i);
  expect(read('src/data/legacyBackup.ts')).not.toMatch(/httpTts/i);
});
