import { activeDanmaku, parseDanmaku } from '../src/core/danmaku';

test('parses Bilibili XML danmaku metadata and entities', () => {
  expect(parseDanmaku('<i><d p="1.5,1,25,16711680,0,0,0,1">甲&amp;乙</d><d p="3,5,25,255">顶部</d></i>')).toEqual([
    { time: 1.5, text: '甲&乙', color: '#ff0000', mode: 'scroll' },
    { time: 3, text: '顶部', color: '#0000ff', mode: 'top' },
  ]);
});

test('parses JSON and LRC-compatible timed comments', () => {
  expect(parseDanmaku('[{"progress":2500,"content":"JSON"}]')[0]).toMatchObject({ time: 2.5, text: 'JSON' });
  expect(parseDanmaku('[01:02.50]歌词弹幕')[0]).toMatchObject({ time: 62.5, text: '歌词弹幕' });
});

test('selects a bounded active danmaku window', () => {
  const items = parseDanmaku('[{"time":1,"text":"旧"},{"time":5,"text":"当前"},{"time":8,"text":"未来"}]');
  expect(activeDanmaku(items, 6, 3).map(item => item.text)).toEqual(['当前']);
});
