import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PageHeader } from '../components/PageHeader';
import { InTreeSheet } from '../components/InTreeSheet';
import {
  listBookmarks,
  listHighlights,
  removeBookmark,
  removeHighlight,
} from '../data/annotations';
import type { Book, Bookmark, Highlight } from '../types';
import { useAppTheme } from '../theme/AppTheme';
import {
  saveBookmarkExport,
  type BookmarkExportFormat,
} from '../core/annotationExport';
type Tab = 'bookmarks' | 'highlights';
export function AnnotationManager({
  books,
  back,
  open,
}: {
  books: Book[];
  back: () => void;
  open: (bookId: string, chapterId: string) => void;
}) {
  const { colors, dark, t } = useAppTheme();
  const [tab, setTab] = useState<Tab>('bookmarks'),
    [bookmarks, setBookmarks] = useState(() => listBookmarks()),
    [highlights, setHighlights] = useState(() => listHighlights()),
    [exportVisible, setExportVisible] = useState(false),
    [exporting, setExporting] = useState(false),
    [message, setMessage] = useState(''),
    bookName = (id: string) =>
      books.find(x => x.id === id)?.name ?? t('deletedBook');
  const empty =
    tab === 'bookmarks' ? bookmarks.length === 0 : highlights.length === 0;
  return (
    <View style={[s.flex, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('annotationsTitle')}
        onBack={back}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('exportBookmarks')}
            accessibilityState={{ disabled: bookmarks.length === 0 }}
            disabled={bookmarks.length === 0}
            style={s.headerAction}
            onPress={() => setExportVisible(true)}
          >
            <Text
              style={{
                color: bookmarks.length ? colors.primary : colors.muted,
                fontWeight: '700',
              }}
            >
              {t('exportShort')}
            </Text>
          </Pressable>
        }
      />
      <View style={s.tabs}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'bookmarks' }}
          style={[
            s.tab,
            {
              backgroundColor: colors.surface,
              borderColor: tab === 'bookmarks' ? colors.primary : colors.border,
            },
            tab === 'bookmarks' && s.active,
          ]}
          onPress={() => setTab('bookmarks')}
        >
          <Text style={{ color: colors.text }}>
            {t('bookmarksCount', { count: bookmarks.length })}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'highlights' }}
          style={[
            s.tab,
            {
              backgroundColor: colors.surface,
              borderColor:
                tab === 'highlights' ? colors.primary : colors.border,
            },
            tab === 'highlights' && s.active,
          ]}
          onPress={() => setTab('highlights')}
        >
          <Text style={{ color: colors.text }}>
            {t('highlightsCount', { count: highlights.length })}
          </Text>
        </Pressable>
      </View>
      {empty ? (
        <View style={s.center}>
          <Text style={[s.empty, { color: colors.muted }]}>
            {t(tab === 'bookmarks' ? 'emptyBookmarks' : 'emptyHighlights')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {tab === 'bookmarks'
            ? bookmarks.map(item => (
                <BookmarkRow
                  key={item.id}
                  item={item}
                  bookName={bookName(item.bookId)}
                  open={() => open(item.bookId, item.chapterId)}
                  remove={() => {
                    removeBookmark(item.id);
                    setBookmarks(listBookmarks());
                  }}
                  colors={colors}
                  chapterBookmark={t('chapterBookmark')}
                  deleteLabel={t('deleteBookmark')}
                />
              ))
            : highlights.map(item => (
                <HighlightRow
                  key={item.id}
                  item={item}
                  bookName={bookName(item.bookId)}
                  open={() => open(item.bookId, item.chapterId)}
                  remove={() => {
                    removeHighlight(item.id);
                    setHighlights(listHighlights());
                  }}
                  colors={colors}
                  dark={dark}
                  deleteLabel={t('deleteHighlight')}
                />
              ))}
        </ScrollView>
      )}
      {message ? (
        <Text
          accessibilityRole="alert"
          style={[s.message, { color: colors.muted }]}
        >
          {message}
        </Text>
      ) : null}
      <InTreeSheet
        visible={exportVisible}
        onDismiss={() => !exporting && setExportVisible(false)}
      >
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          {t('exportBookmarks')}
        </Text>
        {(['json', 'markdown'] as BookmarkExportFormat[]).map(format => (
          <Pressable
            accessibilityRole="button"
            disabled={exporting}
            key={format}
            style={[s.exportAction, { borderColor: colors.border }]}
            onPress={() => {
              setExporting(true);
              setMessage('');
              void saveBookmarkExport(bookmarks, books, format)
                .then(() => {
                  setMessage(t('bookmarkExported'));
                  setExportVisible(false);
                })
                .catch(reason =>
                  setMessage(
                    t('bookmarkExportFailed', {
                      message:
                        reason instanceof Error
                          ? reason.message
                          : String(reason),
                    }),
                  ),
                )
                .finally(() => setExporting(false));
            }}
          >
            <Text style={{ color: colors.text }}>
              {t(
                format === 'json'
                  ? 'exportBookmarkJson'
                  : 'exportBookmarkMarkdown',
              )}
            </Text>
          </Pressable>
        ))}
      </InTreeSheet>
    </View>
  );
}
function BookmarkRow({
  item,
  bookName,
  open,
  remove,
  colors,
  chapterBookmark,
  deleteLabel,
}: {
  item: Bookmark;
  bookName: string;
  open: () => void;
  remove: () => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
  chapterBookmark: string;
  deleteLabel: string;
}) {
  return (
    <View style={[s.item, { borderColor: colors.border }]}>
      <Pressable accessibilityRole="button" style={s.content} onPress={open}>
        <Text style={[s.title, { color: colors.text }]}>
          {bookName} · {item.chapterTitle}
        </Text>
        <Text numberOfLines={2} style={[s.body, { color: colors.muted }]}>
          {item.excerpt || chapterBookmark}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={deleteLabel}
        style={s.delete}
        onPress={remove}
      >
        <Text style={[s.deleteText, { color: colors.danger }]}>×</Text>
      </Pressable>
    </View>
  );
}
function HighlightRow({
  item,
  bookName,
  open,
  remove,
  colors,
  dark,
  deleteLabel,
}: {
  item: Highlight;
  bookName: string;
  open: () => void;
  remove: () => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
  dark: boolean;
  deleteLabel: string;
}) {
  return (
    <View style={[s.item, { borderColor: colors.border }]}>
      <Pressable accessibilityRole="button" style={s.content} onPress={open}>
        <Text style={[s.title, { color: colors.text }]}>{bookName}</Text>
        <Text
          numberOfLines={2}
          style={[
            s.highlight,
            {
              color: dark ? '#fff0a8' : '#6d5510',
              backgroundColor: dark ? '#4a3f18' : '#fff5bd',
            },
          ]}
        >
          “{item.text}”
        </Text>
        {item.note ? (
          <Text numberOfLines={2} style={[s.body, { color: colors.muted }]}>
            {item.note}
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={deleteLabel}
        style={s.delete}
        onPress={remove}
      >
        <Text style={[s.deleteText, { color: colors.danger }]}>×</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { flexDirection: 'row', padding: 12, gap: 10 },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { borderWidth: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 18 },
  list: { paddingHorizontal: 14, paddingBottom: 24 },
  item: {
    minHeight: 82,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: { flex: 1, paddingVertical: 12, gap: 6 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { lineHeight: 20 },
  highlight: { lineHeight: 22 },
  delete: {
    width: 52,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { fontSize: 28 },
  headerAction: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { paddingHorizontal: 14, paddingVertical: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  exportAction: {
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
});
