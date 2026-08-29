import{findMediaUrl,mediaFileName,parseMediaRequest}from'../src/core/media';
test('parses media URL options and headers',()=>expect(parseMediaRequest('video/a.m3u8,{"headers":{"Referer":"https://a"}}','https://a/base/')).toEqual({uri:'https://a/base/video/a.m3u8',headers:{Referer:'https://a'}}));
test('finds embedded media URLs',()=>expect(findMediaUrl('<video src="https://cdn.test/a.mp4?x=1"></video>')).toBe('https://cdn.test/a.mp4?x=1'));
test('creates safe download names',()=>expect(mediaFileName('https://x.test/a.m3u8','A/B')).toBe('A_B.m3u8'));
