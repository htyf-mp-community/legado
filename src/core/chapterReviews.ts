import type { Book, BookSource, LocalChapter } from '../types';
import { buildSourcePageRequest, executeSourceRequest } from './sourceRequest';
import { sourceRuleText, sourceRuleValues } from './sourceRule';
import { resolveNativeSourceUrl } from './nativeSourceUrl';

export type ChapterReview = { id: string; name: string; content: string; avatar?: string; badge?: string; replyToName?: string; imageUrl?: string; audioUrl?: string; time?: string; likeCount?: string; replyCount?: string; replies?: ChapterReviewReply[] };
export type ChapterReviewReply = Omit<ChapterReview, 'replyCount'>;
export type ChapterReviewSummary = { paragraphIndex: number; count: number; data?: string };
const rules = (source: BookSource) => (source.ruleReview ?? {}) as Record<string, unknown>;
const absolute = (value: string, base: string) => value ? resolveNativeSourceUrl(value, base) : undefined;
const interpolate = (value: string, book: Book, chapter: LocalChapter, page: number) => value.replace(/\{\{page\}\}/g, String(page)).replace(/\{\{bookUrl\}\}/g, book.bookUrl ?? '').replace(/\{\{chapterUrl\}\}/g, chapter.url ?? '').replace(/\{\{chapterIndex\}\}/g, String(book.currentChapterIndex ?? 0));
const protocol = (raw: string, baseUrl: string) => { try { const value = JSON.parse(raw) as Record<string, unknown>; if (!value || typeof value !== 'object' || Array.isArray(value)) return { content: raw }; const text = String(value.text ?? '').trim(), imageUrl = absolute(String(value.img ?? ''), baseUrl), audioUrl = absolute(String(value.audio ?? ''), baseUrl), replyToName = String(value.replyToName ?? '').trim() || undefined, time = String(value.time ?? '').trim() || undefined, likeCount = value.likeCount === undefined ? undefined : String(value.likeCount), replyCount = value.replyCount === undefined ? undefined : String(value.replyCount); return text || imageUrl || audioUrl ? { content: text, imageUrl, audioUrl, replyToName, time, likeCount, replyCount } : { content: raw }; } catch { return { content: raw }; } };

const replyItems = (source: BookSource, data: unknown, baseUrl: string): ChapterReviewReply[] => { const r = rules(source), items = sourceRuleValues(data, String(r.replyListRule ?? '$[*]')); return items.map((item, index) => { const parsed = protocol(sourceRuleText(item, r.replyContentRule), baseUrl); return ({ id: sourceRuleText(item, r.replyIdRule) || `${baseUrl}#reply-${index}`, name: sourceRuleText(item, r.replyNameRule) || '匿名', ...parsed, avatar: absolute(sourceRuleText(item, r.replyAvatarRule, true), baseUrl), badge: sourceRuleText(item, r.replyBadgeRule) || undefined, time: parsed.time ?? (sourceRuleText(item, r.replyTimeRule) || undefined), likeCount: parsed.likeCount ?? (sourceRuleText(item, r.replyLikeCountRule) || undefined) }); }).filter(item => !!item.content || !!item.imageUrl || !!item.audioUrl); };

export function parseChapterReviews(source: BookSource, data: unknown, baseUrl: string): ChapterReview[] {
  const r = rules(source), items = sourceRuleValues(data, String(r.detailListRule ?? '$[*]'));
  return items.map((item, index) => { const parsed = protocol(sourceRuleText(item, r.detailContentRule), baseUrl); return ({
    id: sourceRuleText(item, r.detailIdRule) || `${baseUrl}#${index}`,
    name: sourceRuleText(item, r.detailNameRule) || '匿名',
    ...parsed,
    avatar: absolute(sourceRuleText(item, r.detailAvatarRule, true), baseUrl),
    badge: sourceRuleText(item, r.detailBadgeRule) || undefined,
    time: parsed.time ?? (sourceRuleText(item, r.detailTimeRule) || undefined),
    likeCount: parsed.likeCount ?? (sourceRuleText(item, r.detailLikeCountRule) || undefined),
    replyCount: parsed.replyCount ?? (sourceRuleText(item, r.detailReplyCountRule) || undefined),
    replies: r.replyListRule ? replyItems(source, item, baseUrl) : undefined,
  }); }).filter(item => !!item.content || !!item.imageUrl || !!item.audioUrl);
}

export function parseReviewSummaries(source: BookSource, data: unknown): ChapterReviewSummary[] {
  const r = rules(source), items = sourceRuleValues(data, String(r.summaryListRule ?? '$[*]'));
  return items.map(item => ({ paragraphIndex: Number(sourceRuleText(item, r.summaryParagraphIndexRule)), count: Math.max(0, Number(sourceRuleText(item, r.summaryCountRule)) || 0), data: sourceRuleText(item, r.summaryParagraphDataRule) || undefined })).filter(item => Number.isInteger(item.paragraphIndex) && item.paragraphIndex >= -1 && item.count > 0);
}

export async function loadReviewSummaries(source: BookSource, book: Book, chapter: LocalChapter) {
  const rawUrl = String(rules(source).reviewSummaryUrl ?? '').trim();
  if (!rawUrl) return [];
  const response = await executeSourceRequest(buildSourcePageRequest(source, interpolate(rawUrl, book, chapter, 1)));
  return parseReviewSummaries(source, response.data);
}

export async function loadChapterReviews(source: BookSource, book: Book, chapter: LocalChapter, page = 1, summary?: ChapterReviewSummary) {
  return (await loadChapterReviewPage(source, book, chapter, page, summary)).items;
}

export async function loadChapterReviewPage(source: BookSource, book: Book, chapter: LocalChapter, page = 1, summary?: ChapterReviewSummary, nextUrl?: string) {
  const r = rules(source);
  if (r.enabled === false) return { items: [], nextUrl: undefined };
  const rawUrl = String(r.reviewDetailUrl ?? r.reviewSummaryUrl ?? '').trim();
  if (!rawUrl) throw new Error('书源未配置段评详情 URL');
  const target = nextUrl || interpolate(rawUrl, book, chapter, page).replace(/\{\{paragraphIndex\}\}/g, String(summary?.paragraphIndex ?? -1)).replace(/\{\{paragraphData\}\}/g, encodeURIComponent(summary?.data ?? ''));
  const response = await executeSourceRequest(buildSourcePageRequest(source, target, page));
  const next = sourceRuleText(response.data, r.reviewDetailNextPageUrl, true);
  return { items: parseChapterReviews(source, response.data, response.url), nextUrl: absolute(next, response.url) };
}

export function parseReviewReplies(source: BookSource, data: unknown, baseUrl: string): ChapterReviewReply[] {
  return replyItems(source, data, baseUrl);
}

export async function loadReviewReplies(source: BookSource, book: Book, chapter: LocalChapter, reviewId: string, page = 1) {
  const rawUrl = String(rules(source).reviewQuoteUrl ?? '').trim();
  if (!rawUrl) throw new Error('书源未配置段评回复 URL');
  const target = interpolate(rawUrl, book, chapter, page).replace(/\{\{reviewId\}\}/g, encodeURIComponent(reviewId));
  const response = await executeSourceRequest(buildSourcePageRequest(source, target, page));
  return parseReviewReplies(source, response.data, response.url);
}
