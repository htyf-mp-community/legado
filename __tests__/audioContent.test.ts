import { formatAudioTime, parseAudioContent } from '../src/core/audioContent';

test('parses a single URL and newline playlist with deduplication', () => {
  expect(parseAudioContent('https://audio.example/one.mp3')).toEqual([
    { url: 'https://audio.example/one.mp3' },
  ]);
  expect(
    parseAudioContent(
      'https://audio.example/one.mp3\nhttps://audio.example/two.mp3\nhttps://audio.example/one.mp3',
    ),
  ).toEqual([
    { url: 'https://audio.example/one.mp3' },
    { url: 'https://audio.example/two.mp3' },
  ]);
});

test('parses serialized audio objects with titles and request headers', () => {
  expect(
    parseAudioContent(
      '[{"url":"https://audio.example/a.m4a","name":"上半章","headers":{"Referer":"https://book.example"}}]',
    ),
  ).toEqual([
    {
      url: 'https://audio.example/a.m4a',
      title: '上半章',
      headers: { Referer: 'https://book.example' },
    },
  ]);
});

test('parses audio elements and rejects non-http values', () => {
  expect(
    parseAudioContent(
      '<audio controls src="https://audio.example/a.mp3"></audio>',
    ),
  ).toEqual([{ url: 'https://audio.example/a.mp3' }]);
  expect(parseAudioContent('file:///private/audio.mp3')).toEqual([]);
});

test('formats playback duration', () => {
  expect(formatAudioTime(65)).toBe('1:05');
  expect(formatAudioTime(3661)).toBe('1:01:01');
  expect(formatAudioTime(Number.NaN)).toBe('0:00');
});
