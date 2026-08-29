jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }) }));
import { parseChapterReviews, parseReviewReplies, parseReviewSummaries } from '../src/core/chapterReviews';
import type { BookSource } from '../src/types';
const base: BookSource = { bookSourceUrl: 'https://example.com', bookSourceName: '源', bookSourceType: 0, customOrder: 0, enabled: true, enabledExplore: false };

test('parses JSON chapter review rules and resolves avatars', () => {
  const source: BookSource = { ...base, ruleReview: { detailListRule: '$.items[*]', detailIdRule: '$.id', detailNameRule: '$.user', detailContentRule: '$.text', detailAvatarRule: '$.avatar', detailLikeCountRule: '$.likes' } };
  expect(parseChapterReviews(source, { items: [{ id: 1, user: '读者', text: '好看', avatar: '/a.png', likes: 3 }] }, 'https://example.com/reviews')).toEqual([{ id: '1', name: '读者', content: '好看', avatar: 'https://example.com/a.png', badge: undefined, time: undefined, likeCount: '3', replyCount: undefined }]);
});

test('drops empty review rows', () => {
  const source: BookSource = { ...base, ruleReview: { detailListRule: '$[*]', detailContentRule: '$.text' } };
  expect(parseChapterReviews(source, [{ text: '' }, { text: '有效' }], 'https://example.com')).toHaveLength(1);
});

test('parses nested reply rules', () => {
  const source: BookSource = { ...base, ruleReview: { replyListRule: '$.replies[*]', replyIdRule: '$.id', replyNameRule: '$.name', replyContentRule: '$.body', replyLikeCountRule: '$.likes' } };
  expect(parseReviewReplies(source, { replies: [{ id: 'r1', name: '回复者', body: '同意', likes: 2 }] }, 'https://example.com')).toEqual([{ id: 'r1', name: '回复者', content: '同意', avatar: undefined, badge: undefined, time: undefined, likeCount: '2' }]);
});

test('parses chapter and paragraph review summaries', () => {
  const source: BookSource = { ...base, ruleReview: { summaryListRule: '$.summary[*]', summaryParagraphIndexRule: '$.index', summaryCountRule: '$.count', summaryParagraphDataRule: '$.token' } };
  expect(parseReviewSummaries(source, { summary: [{ index: -1, count: 2, token: 'chapter' }, { index: 3, count: 5, token: 'p3' }, { index: 4, count: 0 }] })).toEqual([{ paragraphIndex: -1, count: 2, data: 'chapter' }, { paragraphIndex: 3, count: 5, data: 'p3' }]);
});

test('parses review content protocol and media URLs', () => {
  const source: BookSource = { ...base, ruleReview: { detailListRule: '$[*]', detailContentRule: '$.content' } };
  const [item] = parseChapterReviews(source, [{ content: JSON.stringify({ text: '正文', replyToName: '甲', img: '/p.jpg', audio: '/a.mp3', time: '刚刚', likeCount: 4, replyCount: 2 }) }], 'https://example.com/reviews');
  expect(item).toMatchObject({ content: '正文', replyToName: '甲', imageUrl: 'https://example.com/p.jpg', audioUrl: 'https://example.com/a.mp3', time: '刚刚', likeCount: '4', replyCount: '2' });
});

test('parses replies embedded in a detail item', () => {
  const source: BookSource = { ...base, ruleReview: { detailListRule: '$[*]', detailContentRule: '$.text', replyListRule: '$.replies[*]', replyContentRule: '$.text' } };
  expect(parseChapterReviews(source, [{ text: '主评', replies: [{ text: '内嵌回复' }] }], 'https://example.com')[0].replies?.[0].content).toBe('内嵌回复');
});
