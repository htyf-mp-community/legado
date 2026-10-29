import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  PanResponder,
  PixelRatio,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { BookCover } from './BookCover';
import { SourceIcon } from './SourceIcon';
import { useAppTheme } from '../theme/AppTheme';
import {
  shelfReadProgress,
  shelfTimeAgo,
  shelfUnreadCount,
} from '../core/bookshelfDisplay';
import { isLocalBook } from '../core/bookKinds';
import { toolbarForeground } from '../theme/appColors';
import type { Book, BookGroup } from '../types';
import type { BookshelfPreferences } from '../data/bookshelfPreferences';
export type ShelfItem =
  | { key: string; book: Book }
  | { key: string; group: BookGroup; preview: Book[] };
export function BookshelfContent({
  items,
  preferences,
  selected,
  running,
  empty,
  open,
  details,
  openGroup,
  editGroup,
  refresh,
  enableRefresh,
}: {
  items: ShelfItem[];
  preferences: BookshelfPreferences;
  selected: ReadonlySet<string>;
  running: ReadonlySet<string>;
  empty: string;
  open: (book: Book) => void;
  details: (book: Book) => void;
  openGroup: (group: BookGroup) => void;
  editGroup: (group: BookGroup) => void;
  refresh: () => void;
  enableRefresh: boolean;
}) {
  const { width } = useWindowDimensions(),
    { colors } = useAppTheme();
  const [viewport, setViewport] = useState(width),
    [metrics, setMetrics] = useState({ viewport: 0, content: 0, offset: 0 });
  const list = useRef<FlatList<ShelfItem>>(null),
    columns = Math.max(1, preferences.layout),
    grid = preferences.layout >= 2;
  const margin = preferences.margin / PixelRatio.get(),
    extra = 24 / PixelRatio.get();
  const renderItem = useCallback(
    ({ item, index }: { item: ShelfItem; index: number }) => {
      const row = grid ? Math.floor(index / columns) : index,
        lastRow = Math.ceil(items.length / (grid ? columns : 1)) - 1;
      return (
        <View
          style={{
            width: grid ? viewport / columns : viewport,
            paddingHorizontal: grid ? margin : 0,
            paddingTop: margin + (row === 0 ? extra : 0),
            paddingBottom: margin + (row === lastRow && row !== 0 ? extra : 0),
          }}
        >
          <ShelfCard
            item={item}
            preferences={preferences}
            width={grid ? viewport / columns - margin * 2 : viewport}
            selected={'book' in item && selected.has(item.book.id)}
            running={'book' in item && running.has(item.book.id)}
            open={() =>
              'book' in item ? open(item.book) : openGroup(item.group)
            }
            details={() =>
              'book' in item ? details(item.book) : editGroup(item.group)
            }
          />
        </View>
      );
    },
    [
      columns,
      details,
      editGroup,
      extra,
      grid,
      items.length,
      margin,
      open,
      openGroup,
      preferences,
      running,
      selected,
      viewport,
    ],
  );
  return (
    <View
      style={s.flex}
      onLayout={event => setViewport(event.nativeEvent.layout.width)}
    >
      <FlatList
        ref={list}
        key={`shelf-${preferences.layout}`}
        data={items}
        keyExtractor={item => item.key}
        numColumns={grid ? columns : 1}
        renderItem={renderItem}
        contentContainerStyle={items.length ? undefined : s.empty}
        ListEmptyComponent={
          <Text
            style={{ color: colors.muted, fontSize: 16, textAlign: 'center' }}
          >
            {empty}
          </Text>
        }
        showsVerticalScrollIndicator={!preferences.showFastScroller}
        onLayout={event => {
          const viewport = event.nativeEvent.layout.height;
          setMetrics(value => ({ ...value, viewport }));
        }}
        onContentSizeChange={(_width, content) =>
          setMetrics(value => ({ ...value, content }))
        }
        onScroll={event => {
          const offset = event.nativeEvent.contentOffset.y;
          setMetrics(value => ({ ...value, offset }));
        }}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refresh}
            enabled={enableRefresh}
            tintColor={colors.accent}
          />
        }
      />
      {preferences.showFastScroller &&
      metrics.content > metrics.viewport &&
      metrics.viewport > 0 ? (
        <ShelfFastScroller
          metrics={metrics}
          scroll={offset =>
            list.current?.scrollToOffset({ offset, animated: false })
          }
        />
      ) : null}
    </View>
  );
}
function ShelfCard({
  item,
  preferences,
  width,
  selected,
  running,
  open,
  details,
}: {
  item: ShelfItem;
  preferences: BookshelfPreferences;
  width: number;
  selected: boolean;
  running: boolean;
  open: () => void;
  details: () => void;
}) {
  const { colors, dark, t } = useAppTheme(),
    grid = preferences.layout >= 2,
    compact = preferences.layout === 1;
  const book = 'book' in item ? item.book : undefined,
    group = 'group' in item ? item.group : undefined;
  const name = book?.name ?? group!.name,
    coverWidth = grid ? Math.max(1, width - 16) : book && compact ? 48 : 66;
  const progress =
      book && preferences.readProgressMode
        ? shelfReadProgress(book)
        : undefined,
    unread = book && preferences.showUnread ? shelfUnreadCount(book) : 0;
  const percentage =
    progress === undefined ? undefined : Math.round(progress * 100);
  const badge = (
    <>
      {running ? (
        <ActivityIndicator color={colors.accent} size="small" />
      ) : unread > 0 ? (
        <Text
          style={[
            s.badge,
            {
              backgroundColor: book?.lastCheckCount
                ? colors.accent
                : dark
                  ? '#66666666'
                  : '#AAAAAAAA',
              color: toolbarForeground(
                book?.lastCheckCount
                  ? colors.accent
                  : dark
                    ? '#666666'
                    : '#AAAAAA',
              ),
            },
          ]}
        >
          {unread}
        </Text>
      ) : null}
    </>
  );
  const bar =
    progress !== undefined ? (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('shelfReadProgress')}
        accessibilityValue={{ min: 0, max: 100, now: percentage }}
        style={{
          height: preferences.readProgressMode === 2 ? 4 : 2,
          backgroundColor: `${colors.accent.slice(0, 7)}3D`,
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${percentage ?? 0}%`,
            backgroundColor: colors.accent,
          }}
        />
      </View>
    ) : null;
  const cover = book ? (
    <BookCover
      name={name}
      author={book.author}
      book={book}
      style={{ width: coverWidth }}
    />
  ) : (
    <GroupCover
      group={group!}
      preview={'preview' in item ? item.preview : []}
      width={coverWidth}
    />
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={group ? t('shelfOpenGroup', { name }) : name}
      accessibilityHint={
        book
          ? `${t('shelfReadHint')}${unread ? `，${t('shelfUnreadCount', { count: unread })}` : ''}`
          : undefined
      }
      accessibilityState={{ selected }}
      onPress={open}
      onLongPress={details}
      style={({ pressed }) => [
        grid ? s.gridCard : s.listCard,
        !grid && group && { paddingTop: 8, paddingBottom: 12 },
        { backgroundColor: pressed || selected ? '#ACACAC63' : 'transparent' },
      ]}
    >
      {grid ? (
        <>
          <View style={s.gridCover}>
            {cover}
            <View pointerEvents="none" style={s.gridBadge}>
              {badge}
            </View>
            {preferences.nameStyle === 2 ? (
              <View pointerEvents="none" style={s.titleOverlay}>
                <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                  <Defs>
                    <LinearGradient id="shelfShade" x1="0" y1="1" x2="0" y2="0">
                      <Stop
                        offset="0"
                        stopColor="#000"
                        stopOpacity={160 / 255}
                      />
                      <Stop
                        offset="0.7"
                        stopColor="#000"
                        stopOpacity={96 / 255}
                      />
                      <Stop offset="1" stopColor="#000" stopOpacity={0} />
                    </LinearGradient>
                  </Defs>
                  <Rect width="100%" height="100%" fill="url(#shelfShade)" />
                </Svg>
                <Text numberOfLines={2} style={s.overlayName}>
                  {name}
                </Text>
              </View>
            ) : null}
            {bar ? <View style={s.gridProgress}>{bar}</View> : null}
          </View>
          {preferences.nameStyle === 0 ? (
            <Text
              numberOfLines={2}
              style={[s.gridName, { color: colors.text }]}
            >
              {name}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          {cover}
          <View style={[s.listText, !book && { justifyContent: 'center' }]}>
            <View style={s.nameRow}>
              <Text
                numberOfLines={1}
                style={[s.listName, { color: colors.text }]}
              >
                {name}
              </Text>
              <View style={s.listBadge}>{badge}</View>
            </View>
            {book ? (
              <>
                {compact ? (
                  <View style={s.metadataRow}>
                    <SourceIcon
                      name="ic_author"
                      color={colors.muted}
                      size={18}
                    />
                    <Text
                      numberOfLines={1}
                      style={[s.authorCompact, { color: colors.muted }]}
                    >
                      {book.author}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {' '}
                      •{' '}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[s.description, { color: colors.muted }]}
                    >
                      {book.chapterTitle}
                    </Text>
                    {preferences.showLastUpdateTime && !isLocalBook(book) ? (
                      <TimeSince value={book.latestChapterTime ?? 0} />
                    ) : null}
                  </View>
                ) : (
                  <>
                    <View style={s.metadataRow}>
                      <SourceIcon
                        name="ic_author"
                        color={colors.muted}
                        size={18}
                      />
                      <Text
                        numberOfLines={1}
                        style={[s.description, { color: colors.muted }]}
                      >
                        {book.author}
                      </Text>
                      {preferences.showLastUpdateTime && !isLocalBook(book) ? (
                        <TimeSince value={book.latestChapterTime ?? 0} />
                      ) : null}
                    </View>
                    <MetadataLine icon="ic_history" text={book.chapterTitle} />
                  </>
                )}
                <View style={s.metadataRow}>
                  <SourceIcon
                    name="ic_book_last"
                    color={colors.muted}
                    size={18}
                  />
                  <Text
                    numberOfLines={1}
                    style={[s.description, { color: colors.muted }]}
                  >
                    {book.latestChapterTitle ??
                      book.chapters?.at(-1)?.title ??
                      book.chapterTitle}
                  </Text>
                  {percentage !== undefined ? (
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {percentage}%
                    </Text>
                  ) : null}
                </View>
                {bar ? <View style={s.listProgress}>{bar}</View> : null}
              </>
            ) : null}
          </View>
        </>
      )}
    </Pressable>
  );
}
function GroupCover({
  group,
  preview,
  width,
}: {
  group: BookGroup;
  preview: Book[];
  width: number;
}) {
  if (group.cover?.trim() || !preview.length)
    return <BookCover name="" uri={group.cover} style={{ width }} />;
  return (
    <View
      style={{
        width,
        height: (width * 4) / 3,
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}
    >
      {Array.from({ length: 4 }, (_, index) => {
        const book = preview[index];
        return (
          <View
            key={index}
            style={{ width: width / 2, height: (width * 2) / 3 }}
          >
            {book ? (
              <BookCover
                name={book.name}
                author={book.author}
                book={book}
                style={{ width: width / 2 }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
function MetadataLine({ icon, text }: { icon: 'ic_history'; text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={s.metadataRow}>
      <SourceIcon name={icon} color={colors.muted} size={18} />
      <Text numberOfLines={1} style={[s.description, { color: colors.muted }]}>
        {text}
      </Text>
    </View>
  );
}
function TimeSince({ value }: { value: number }) {
  const { colors } = useAppTheme();
  return (
    <Text style={{ color: colors.muted, fontSize: 13 }}>
      {shelfTimeAgo(value)}
    </Text>
  );
}
function ShelfFastScroller({
  metrics,
  scroll,
}: {
  metrics: { viewport: number; content: number; offset: number };
  scroll: (offset: number) => void;
}) {
  const { colors, t } = useAppTheme(),
    current = useRef({ metrics, scroll }),
    start = useRef(0),
    [dragging, setDragging] = useState(false);
  current.current = { metrics, scroll };
  const thumb = Math.max(
      32,
      (metrics.viewport * metrics.viewport) / metrics.content,
    ),
    track = Math.max(1, metrics.viewport - thumb),
    fraction = Math.min(
      1,
      Math.max(0, metrics.offset / (metrics.content - metrics.viewport)),
    );
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const value = current.current.metrics;
        start.current =
          value.offset / Math.max(1, value.content - value.viewport);
        setDragging(true);
      },
      onPanResponderMove: (_event, gesture) => {
        const { metrics: value, scroll: move } = current.current,
          travel =
            value.viewport -
            Math.max(32, (value.viewport * value.viewport) / value.content);
        move(
          Math.min(
            1,
            Math.max(0, start.current + gesture.dy / Math.max(1, travel)),
          ) *
            (value.content - value.viewport),
        );
      },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    }),
  ).current;
  return (
    <View
      pointerEvents="box-none"
      style={[s.fastTrack, { height: metrics.viewport }]}
    >
      <View
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('shelfQuickScroll')}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(fraction * 100),
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event =>
          scroll(
            Math.max(
              0,
              Math.min(
                metrics.content - metrics.viewport,
                metrics.offset +
                  metrics.viewport *
                    (event.nativeEvent.actionName === 'increment' ? 1 : -1),
              ),
            ),
          )
        }
        style={{
          position: 'absolute',
          right: 0,
          top: fraction * track,
          width: 24,
          height: thumb,
          alignItems: 'flex-end',
        }}
      >
        <View
          style={{
            width: dragging ? 8 : 4,
            height: '100%',
            backgroundColor: colors.accent,
            borderRadius: 4,
          }}
        />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  empty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gridCard: { padding: 4 },
  listCard: {
    flexDirection: 'row',
    paddingLeft: 8,
    paddingRight: 16,
    paddingBottom: 4,
  },
  gridCover: { margin: 4, alignSelf: 'flex-start' },
  gridBadge: { position: 'absolute', top: -4, right: -4 },
  badge: {
    minWidth: 16,
    minHeight: 16,
    textAlign: 'center',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontSize: 11,
    overflow: 'hidden',
  },
  gridName: { fontSize: 12, textAlign: 'center', marginTop: 6, minHeight: 30 },
  titleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 4,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingBottom: 4,
    paddingTop: 8,
  },
  overlayName: {
    fontSize: 11,
    lineHeight: 14,
    minHeight: 28,
    color: '#FFFFFFDE',
  },
  gridProgress: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  listText: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 4,
    justifyContent: 'space-between',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', minHeight: 22 },
  listName: { flex: 1, fontSize: 16, paddingLeft: 2, paddingBottom: 4 },
  listBadge: { marginHorizontal: 5 },
  metadataRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  description: { flex: 1, fontSize: 13 },
  authorCompact: { fontSize: 13, flexShrink: 1, maxWidth: '45%' },
  listProgress: { position: 'absolute', bottom: 1, left: 0, right: 0 },
  fastTrack: { position: 'absolute', right: 0, top: 0, width: 24 },
});
