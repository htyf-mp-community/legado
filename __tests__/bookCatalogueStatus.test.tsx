import React from 'react';
import { act, create } from 'react-test-renderer';
let mockPortalVisible = false;
jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (v: unknown) => v },
}));
jest.mock('../src/theme/AppTheme', () => ({
  useAppTheme: () => ({
    colors: { text: '#000', muted: '#888', accent: '#a00' },
    t: (v: string) => v,
  }),
}));
jest.mock('../src/components/InTreeSheet', () => ({
  InTreeSheet: ({ visible }: { visible: boolean }) => {
    require('react').useEffect(() => {
      mockPortalVisible = visible;
    }, [visible]);
    return null;
  },
}));
import { BookCatalogueStatus } from '../src/components/BookCatalogueStatus';
test('a completed catalogue explicitly dismisses its portal before status UI disappears', () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    needed: true,
    loading: true,
    error: '',
    cancel: jest.fn(),
    retry: jest.fn(),
  };
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(<BookCatalogueStatus state={state} />);
  });
  expect(mockPortalVisible).toBe(true);
  act(() =>
    tree.update(
      <BookCatalogueStatus
        state={{ ...state, needed: false, loading: false }}
      />,
    ),
  );
  expect(mockPortalVisible).toBe(false);
  act(() => tree.unmount());
});
