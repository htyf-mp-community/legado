import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  FlatList: 'FlatList',
  PanResponder: { create: () => ({ panHandlers: {} }) },
  PixelRatio: { get: () => 1 },
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
  useWindowDimensions: () => ({ width: 320, height: 800 }),
}));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Rect: 'Rect',
  Stop: 'Stop',
}));
jest.mock('../src/components/BookCover', () => ({ BookCover: () => null }));
jest.mock('../src/components/SourceIcon', () => ({ SourceIcon: () => null }));
jest.mock('../src/theme/AppTheme', () => ({
  useAppTheme: () => ({
    colors: { muted: '#777', accent: '#000' },
    t: (key: string) => key,
  }),
}));
import { BookshelfContent } from '../src/components/BookshelfContent';
import type { BookshelfPreferences } from '../src/data/bookshelfPreferences';
const preferences: BookshelfPreferences = {
  layout: 0,
  groupStyle: 0,
  nameStyle: 0,
  margin: 12,
  sort: 0,
  readProgressMode: 1,
  showUnread: true,
  showLastUpdateTime: false,
  showWaitUpCount: false,
  showFastScroller: true,
  showRecentReading: false,
  showStatistics: false,
};
let tree: ReactTestRenderer | undefined;
beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
});
function mount() {
  act(() => {
    tree = create(
      <BookshelfContent
        items={[]}
        preferences={preferences}
        selected={new Set()}
        running={new Set()}
        empty="Empty"
        open={jest.fn()}
        details={jest.fn()}
        openGroup={jest.fn()}
        editGroup={jest.fn()}
        refresh={jest.fn()}
        enableRefresh
      />,
    );
  });
  return tree!.root.findByType('FlatList' as never);
}
const fastScroller = () =>
  tree!.root.findByProps({ accessibilityLabel: 'shelfQuickScroll' });
test('layout metrics survive a host releasing the native event before React reduces queued updates', () => {
  const list = mount(),
    event: { nativeEvent: { layout: { height: number } } | null } = {
      nativeEvent: { layout: { height: 400 } },
    };
  act(() => {
    list.props.onContentSizeChange(320, 1600);
    list.props.onLayout(event);
    event.nativeEvent = null;
  });
  expect(fastScroller().props.style.height).toBe(100);
  expect(fastScroller().props.accessibilityValue.now).toBe(0);
});
test('scroll metrics survive released events and retain the latest offset in a queued batch', () => {
  const list = mount();
  act(() => {
    list.props.onLayout({ nativeEvent: { layout: { height: 400 } } });
  });
  const first: { nativeEvent: { contentOffset: { y: number } } | null } = {
      nativeEvent: { contentOffset: { y: 300 } },
    },
    second: { nativeEvent: { contentOffset: { y: number } } | null } = {
      nativeEvent: { contentOffset: { y: 600 } },
    };
  act(() => {
    list.props.onContentSizeChange(320, 1600);
    list.props.onScroll(first);
    first.nativeEvent = null;
    list.props.onScroll(second);
    second.nativeEvent = null;
  });
  expect(fastScroller().props.accessibilityValue.now).toBe(50);
});
