import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PageHeader } from '../components/PageHeader';
import { loadChapterReviewPage, loadReviewReplies, loadReviewSummaries, type ChapterReview, type ChapterReviewReply, type ChapterReviewSummary } from '../core/chapterReviews';
import { loadSources } from '../data/sources';
import { useAppTheme } from '../theme/AppTheme';
import type { Book, BookSource } from '../types';

export function ChapterReviews({ book, chapterIndex, initialParagraphIndex, back }: { book?: Book; chapterIndex: number; initialParagraphIndex?: number; back: () => void }) {
  const { colors, t } = useAppTheme(), chapter = book?.chapters?.[chapterIndex];
  const [items, setItems] = useState<ChapterReview[]>([]), [source, setSource] = useState<BookSource>(), [summaries, setSummaries] = useState<ChapterReviewSummary[]>([]), [selected, setSelected] = useState<ChapterReviewSummary>(), [nextUrl, setNextUrl] = useState<string>(), [replies, setReplies] = useState<Record<string, ChapterReviewReply[]>>({}), [replyLoading, setReplyLoading] = useState(''), [page, setPage] = useState(1), [loading, setLoading] = useState(true), [error, setError] = useState(''), [hasMore, setHasMore] = useState(true);
  const load = async (nextPage: number, append: boolean, requested = selected) => {
    if (!book || !chapter) return;
    setLoading(true); setError('');
    try {
      const all = await loadSources(), selected = all.find(item => item.bookSourceUrl === book.origin);
      if (!selected) throw new Error(t('sourceMissing'));
      setSource(selected);
      let summary = requested;
      if (nextPage === 1 && !append && !summaries.length) { const incomingSummaries = await loadReviewSummaries(selected, book, chapter); setSummaries(incomingSummaries); summary = incomingSummaries.find(item => item.paragraphIndex === initialParagraphIndex) ?? incomingSummaries.find(item => item.paragraphIndex === -1) ?? incomingSummaries[0]; setSelected(summary); }
      const result = await loadChapterReviewPage(selected, book, chapter, nextPage, summary, append ? nextUrl : undefined), incoming = result.items;
      setItems(current => append ? [...current, ...incoming.filter(item => !current.some(old => old.id === item.id))] : incoming);
      setNextUrl(result.nextUrl); setPage(nextPage); setHasMore(result.nextUrl ? true : !((selected.ruleReview as Record<string, unknown> | undefined)?.reviewDetailNextPageUrl) && incoming.length > 0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  };
  const toggleReplies = async (item: ChapterReview) => {
    if (replies[item.id]) { setReplies(current => { const next = { ...current }; delete next[item.id]; return next; }); return; }
    if (item.replies?.length) { setReplies(current => ({ ...current, [item.id]: item.replies! })); return; }
    if (!book || !chapter || !source) return;
    setReplyLoading(item.id);
    try { setReplies(current => ({ ...current, [item.id]: [] })); const incoming = await loadReviewReplies(source, book, chapter, item.id); setReplies(current => ({ ...current, [item.id]: incoming })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setReplies(current => { const next = { ...current }; delete next[item.id]; return next; }); }
    finally { setReplyLoading(''); }
  };
  useEffect(() => { void load(1, false); }, [book?.id, chapterIndex, initialParagraphIndex, t]);
  return <View style={[s.flex, { backgroundColor: colors.background }]}><PageHeader title={t('chapterReviewsTitle', { chapter: chapter?.title ?? t('chapterMissing') })} onBack={back} /><ScrollView contentContainerStyle={s.content}>{summaries.length ? <ScrollView horizontal contentContainerStyle={s.filters}>{summaries.map(summary => <Pressable accessibilityRole="radio" accessibilityState={{ selected: selected === summary }} key={`${summary.paragraphIndex}:${summary.data}`} style={[s.filter, { borderColor: selected === summary ? colors.primary : colors.border }]} onPress={() => { setSelected(summary); setReplies({}); void load(1, false, summary); }}><Text style={{ color: colors.text }}>{summary.paragraphIndex === -1 ? t('chapterReview') : t('paragraphReview', { index: summary.paragraphIndex })} · {summary.count}</Text></Pressable>)}</ScrollView> : null}{items.map(item => <View key={item.id} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Author item={item} colors={colors} /><ReviewBody item={item} colors={colors} /><View style={s.meta}>{item.likeCount ? <Text style={{ color: colors.muted }}>{t('likes', { count: item.likeCount })}</Text> : null}{item.replyCount ? <Pressable accessibilityRole="button" onPress={() => void toggleReplies(item)}><Text style={{ color: colors.primary }}>{replies[item.id] ? t('collapseReplies') : t('viewReplies', { count: item.replyCount })}</Text></Pressable> : null}</View>{replyLoading === item.id ? <ActivityIndicator /> : null}{replies[item.id]?.map(reply => <View key={reply.id} style={[s.reply, { borderColor: colors.border }]}><Author item={reply} colors={colors} /><ReviewBody item={reply} colors={colors} />{reply.likeCount ? <Text style={{ color: colors.muted }}>{t('likes', { count: reply.likeCount })}</Text> : null}</View>)}</View>)}{loading ? <ActivityIndicator /> : null}{error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}{!loading && !error && !items.length ? <Text style={{ color: colors.muted }}>{t('noChapterReviews')}</Text> : null}{!loading && hasMore ? <Pressable accessibilityRole="button" style={[s.more, { borderColor: colors.border }]} onPress={() => void load(page + 1, true)}><Text style={{ color: colors.primary }}>{t('loadNextPage')}</Text></Pressable> : null}</ScrollView></View>;
}

function Author({ item, colors }: { item: ChapterReviewReply; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  return <View style={s.author}>{item.avatar ? <Image source={{ uri: item.avatar }} style={s.avatar} /> : <View style={[s.avatar, { backgroundColor: colors.border }]} />}<View style={s.flex}><Text style={[s.name, { color: colors.text }]}>{item.name}{item.badge ? ` · ${item.badge}` : ''}</Text>{item.time ? <Text style={{ color: colors.muted }}>{item.time}</Text> : null}</View></View>;
}
function ReviewBody({ item, colors }: { item: ChapterReviewReply; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  const { t } = useAppTheme();
  return <View style={s.attachment}>{item.replyToName ? <Text style={{ color: colors.muted }}>{t('replyTo', { name: item.replyToName })}</Text> : null}{item.content ? <Text style={[s.body, { color: colors.text }]}>{item.content}</Text> : null}{item.imageUrl ? <Image source={{ uri: item.imageUrl }} resizeMode="contain" style={s.reviewImage} /> : null}{item.audioUrl ? <Pressable accessibilityRole="link" style={[s.audio, { borderColor: colors.border }]} onPress={() => void Linking.openURL(item.audioUrl!)}><Text style={{ color: colors.primary }}>{t('playAudioAttachment')}</Text></Pressable> : null}</View>;
}
const s = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 48 }, filters: { gap: 8 }, filter: { minHeight: 42, borderWidth: 1, borderRadius: 21, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }, card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 }, author: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 38, height: 38, borderRadius: 19 }, name: { fontWeight: '700' }, body: { fontSize: 16, lineHeight: 24 }, attachment: { gap: 8 }, reviewImage: { width: '100%', height: 220, borderRadius: 8 }, audio: { minHeight: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, meta: { flexDirection: 'row', gap: 18 }, reply: { borderTopWidth: 1, paddingTop: 10, gap: 7 }, more: { minHeight: 48, borderWidth: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' } });
