import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Book, LocalChapter } from '../types';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import { useAppTheme } from '../theme/AppTheme';
import { loadReaderPreferences } from '../data/readerPreferences';
import { loadGeneralPreferences } from '../data/generalPreferences';
import { loadReplaceRules } from '../data/replaceRules';
import { addAppLog } from '../data/appLog';
import { automaticBookReplacementEnabled } from '../core/readerReplacement';
import { runBookContentSearch } from '../core/contentSearchProcessor';
import { contentSearchSnippetParts, trimContentSearchQuery, type ContentMatch, type ContentSearchSession } from '../core/contentSearch';

// Native companion-object choices live for this process, without a persisted preference key.
let processOptions = { replace: false, regex: false };

export function ContentSearch({ book, initialSession, back, select }: {
  book?: Book; initialSession?: ContentSearchSession; back: () => void; select: (session: ContentSearchSession) => void;
}) {
  const { colors, t } = useAppTheme();
  const [query, setQuery] = useState(initialSession?.query ?? '');
  const [options, setOptions] = useState(processOptions), [optionsOpen, setOptionsOpen] = useState(false);
  const [results, setResults] = useState<ContentMatch[]>(initialSession?.results ?? []);
  const [running, setRunning] = useState(false), [submitted, setSubmitted] = useState(!!initialSession);
  const [lastQuery, setLastQuery] = useState(initialSession?.query ?? ''), [lastRegex, setLastRegex] = useState(initialSession?.regex ?? false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | undefined>(undefined);
  const input = useRef<InstanceType<typeof TextInput>>(null), list = useRef<FlatList<ContentMatch>>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const stop = () => { controller.current?.abort(); setRunning(false); };
  const start = async () => {
    const key = trimContentSearchQuery(query);
    if (!key || !book) return;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    Keyboard.dismiss(); setResults([]); setSubmitted(true); setRunning(true); setLastQuery(key); setLastRegex(options.regex); setError('');
    try {
      const preferences = await loadReaderPreferences();
      if (request.signal.aborted) return;
      const chapters: LocalChapter[] = book.chapters?.length ? book.chapters : [{ id: `${book.id}-legacy`, title: book.chapterTitle, content: book.content }];
      await runBookContentSearch({ book, chapters, query: key, regex: options.regex, preferences,
        rules: loadReplaceRules(), replaceEnabled: options.replace && automaticBookReplacementEnabled(book, loadGeneralPreferences().replaceEnableDefault),
        signal: request.signal, onChapter: items => { if (!request.signal.aborted && items.length) setResults(current => [...current, ...items]); },
      });
    } catch (reason) {
      if (!request.signal.aborted) { setError(reason instanceof Error ? reason.message : String(reason)); addAppLog('[content-search] failed', reason); }
    } finally { if (controller.current === request) setRunning(false); }
  };
  const choose = (selected: number) => {
    stop(); select({ query: lastQuery, regex: lastRegex, results, selected });
  };
  return <View style={[s.flex, { backgroundColor: colors.background }]}>
    <PageHeader title={t('contentSearchTitle')} onBack={() => { stop(); back(); }} sourceTone
      titleContent={<View style={s.search}>
        <TextInput ref={input} accessibilityLabel={t('searchBody')} value={query} onChangeText={setQuery}
          placeholder={t('searchKeywordPlaceholder')} placeholderTextColor={colors.muted} returnKeyType="search"
          onSubmitEditing={() => void start()} autoFocus={!initialSession} autoCapitalize="none" autoCorrect={false}
          style={[s.input, { color: colors.toolbarText }]} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('search')} style={s.touch} onPress={() => void start()}><Text style={[s.icon, { color: colors.toolbarText }]}>⌕</Text></Pressable>
      </View>}
      action={<Pressable accessibilityRole="button" accessibilityLabel={t('contentSearchOptions')} style={s.touch} onPress={() => setOptionsOpen(true)}><Text style={[s.icon, { color: colors.toolbarText }]}>⋮</Text></Pressable>} />
    {running ? <ActivityIndicator color={colors.primary} style={s.progress} /> : null}
    <FlatList ref={list} data={results} keyExtractor={item => `${item.chapterId}:${item.ordinal}`}
      keyboardShouldPersistTaps="handled" contentContainerStyle={s.results}
      ListEmptyComponent={submitted && !running ? <Text style={[s.empty, { color: colors.muted }]}>{error || t('contentSearchEmpty')}</Text> : null}
      renderItem={({ item, index }) => {
        const parts = contentSearchSnippetParts(item);
        return <Pressable accessibilityRole="button" accessibilityLabel={`${item.chapterTitle}: ${item.excerpt}`}
        style={[s.result, { borderBottomColor: colors.border }]} onPress={() => choose(index)}>
        <Text style={[s.chapter, { color: colors.primary }]}>{item.chapterTitle}</Text>
        <Text style={[s.excerpt, { color: colors.text }]}>{parts.before}<Text style={{ color: colors.primary }}>{parts.match}</Text>{parts.after}</Text>
      </Pressable>;
      }} />
    <View style={[s.footer, { backgroundColor: colors.surface }]}>
      <Pressable accessibilityRole="button" style={s.count} onPress={() => input.current?.focus()}><Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>{t('searchResultCount', { count: results.length })}</Text></Pressable>
      {running ? <Pressable accessibilityRole="button" accessibilityLabel={t('stopSearch')} style={s.touch} onPress={stop}><Text style={{ color: colors.primary }}>■</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={t('contentSearchTop')} style={s.touch} onPress={() => list.current?.scrollToOffset({ offset: 0 })}><Text style={{ color: colors.text }}>▲</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('contentSearchBottom')} style={s.touch} onPress={() => { if (results.length) list.current?.scrollToEnd(); }}><Text style={{ color: colors.text }}>▼</Text></Pressable>
    </View>
    <InTreeSheet visible={optionsOpen} onDismiss={() => setOptionsOpen(false)}>
      {[['replace', t('contentSearchReplace')], ['regex', t('useRegex')]].map(([key, label]) => {
        const option = key as keyof typeof options;
        return <Pressable key={key} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: options[option] }} style={s.option} onPress={() => {
          const next = { ...options, [option]: !options[option] }; processOptions = next; setOptions(next);
        }}><Text style={{ color: colors.text }}>{options[option] ? '☑︎' : '☐'}　{label}</Text></Pressable>;
      })}
    </InTreeSheet>
  </View>;
}
const s = StyleSheet.create({
  flex: { flex: 1 }, search: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  input: { minHeight: 44, paddingHorizontal: 4, flex: 1, fontSize: 17 }, touch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 27 }, progress: { height: 3 }, results: { paddingHorizontal: 16 },
  result: { minHeight: 70, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth }, chapter: { fontSize: 15, marginBottom: 4 }, excerpt: { fontSize: 15, lineHeight: 22 },
  empty: { marginVertical: 24, textAlign: 'center' }, footer: { flexDirection: 'row', alignItems: 'center', minHeight: 44 }, count: { flex: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }, option: { minHeight: 48, justifyContent: 'center' },
});
