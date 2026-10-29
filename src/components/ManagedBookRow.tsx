import { useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Book, BookGroup } from '../types';
import { isLocalBook } from '../core/bookKinds';
import { userBookGroups } from '../core/bookshelfGroups';
import { useAppTheme } from '../theme/AppTheme';
export function SelectionMark({
  checked,
  color,
}: {
  checked: boolean;
  color: string;
}) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" accessibilityElementsHidden>
      <Rect
        x={2}
        y={2}
        width={16}
        height={16}
        rx={1}
        fill={checked ? color : 'none'}
        stroke={color}
        strokeWidth={2}
      />
      {checked ? (
        <Path d="M5 10l3 3 7-7" fill="none" stroke="#fff" strokeWidth={2} />
      ) : null}
    </Svg>
  );
}
export function ManagedBookRow({
  book,
  groups,
  checked,
  toggle,
  open,
  group,
  remove,
  openTitle,
  move,
}: {
  book: Book;
  groups: BookGroup[];
  checked: boolean;
  toggle: () => void;
  open: () => void;
  group: () => void;
  remove: () => void;
  openTitle: boolean;
  move?: (offset: number) => void;
}) {
  const { colors, t } = useAppTheme(),
    translate = useRef(new Animated.Value(0)).current,
    armed = useRef(false),
    draggingRef = useRef(false),
    height = useRef(72),
    moved = useRef(move);
  moved.current = move;
  const [dragging, setDragging] = useState(false);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        !!moved.current && armed.current && Math.abs(gesture.dy) > 3,
      onPanResponderGrant: () => {
        draggingRef.current = true;
        setDragging(true);
      },
      onPanResponderMove: (_event, gesture) => translate.setValue(gesture.dy),
      onPanResponderRelease: (_event, gesture) => {
        const offset = Math.round(gesture.dy / height.current);
        armed.current = false;
        draggingRef.current = false;
        translate.setValue(0);
        setDragging(false);
        if (offset) moved.current?.(offset);
      },
      onPanResponderTerminate: () => {
        armed.current = false;
        draggingRef.current = false;
        translate.setValue(0);
        setDragging(false);
      },
    }),
  ).current;
  const arm = () => {
      armed.current = !!moved.current;
    },
    disarm = () => {
      void Promise.resolve().then(() => {
        if (!draggingRef.current) armed.current = false;
      });
    },
    names = userBookGroups(groups)
      .filter(value => book.groupIds?.includes(value.id))
      .map(value => value.name)
      .join(',');
  return (
    <Animated.View
      {...pan.panHandlers}
      onLayout={event => {
        height.current = event.nativeEvent.layout.height || 72;
      }}
      style={{
        backgroundColor: colors.background,
        transform: [{ translateY: translate }],
        zIndex: dragging ? 2 : 0,
        opacity: dragging ? 0.85 : 1,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessible={false}
        onPress={toggle}
        onLongPress={arm}
        onPressOut={disarm}
        style={[s.row, { borderBottomColor: colors.border }]}
      >
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={t('manageSelectBook', { name: book.name })}
          accessibilityState={{ checked }}
          accessibilityActions={[
            {
              name: 'toggleSelection',
              label: t('manageToggleBook'),
            },
          ]}
          onAccessibilityAction={event => {
            if (event.nativeEvent.actionName === 'toggleSelection') toggle();
          }}
          onPress={toggle}
          style={s.check}
        >
          <SelectionMark
            checked={checked}
            color={checked ? colors.accent : colors.muted}
          />
        </Pressable>
        <View style={s.body}>
          <View style={s.line}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={book.name}
              accessibilityHint={move ? t('manageDrag') : undefined}
              accessibilityActions={
                move
                  ? [
                      {
                        name: 'decrement',
                        label: t('manageMoveUp', { name: book.name }),
                      },
                      {
                        name: 'increment',
                        label: t('manageMoveDown', { name: book.name }),
                      },
                    ]
                  : undefined
              }
              onAccessibilityAction={event =>
                move?.(event.nativeEvent.actionName === 'decrement' ? -1 : 1)
              }
              onPress={openTitle ? open : toggle}
              onLongPress={arm}
              onPressOut={disarm}
              style={{
                flexShrink: 1,
                padding: 3,
                minHeight: 28,
                justifyContent: 'center',
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: colors.text, fontSize: 15 }}
              >
                {book.name}
              </Text>
            </Pressable>
            {book.author ? (
              <Text
                numberOfLines={1}
                style={[s.author, { color: colors.muted }]}
              >
                {book.author}
              </Text>
            ) : null}
          </View>
          <View style={[s.line, { marginTop: 8 }]}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.muted,
                fontSize: 12,
                padding: 3,
                maxWidth: '40%',
              }}
            >
              {isLocalBook(book) ? t('manageLocalBook') : book.originName}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: colors.muted, fontSize: 12, flex: 1, padding: 3 }}
            >
              {names || t('manageNoGroup')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('manageGroupButton')} ${book.name}`}
              style={s.action}
              onPress={group}
            >
              <Text style={{ color: colors.muted }}>
                {t('manageGroupButton')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('delete')} ${book.name}`}
              style={s.action}
              onPress={remove}
            >
              <Text style={{ color: colors.muted }}>{t('delete')}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    padding: 6,
    minHeight: 72,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  check: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  body: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center' },
  author: { fontSize: 12, paddingLeft: 12, paddingRight: 8, flex: 1 },
  action: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
});
