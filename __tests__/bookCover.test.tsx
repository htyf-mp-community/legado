import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Image } from 'react-native';
import { Text as SvgText } from 'react-native-svg';
import { BookCover } from '../src/components/BookCover';

jest.mock('../src/data/storage', () => ({
  appStorage: {
    getString: () => undefined,
    addOnValueChangedListener: () => ({ remove: () => undefined }),
  },
}));
jest.mock('../src/core/bookCoverRequest', () => ({
  buildBookCoverRequest: (uri: string) => ({ uri, headers: {} }),
}));

jest.mock('react-native', () => ({
  Image: 'Image',
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: (value: unknown) => value,
    flatten: (value: unknown) => value,
    absoluteFill: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
  },
}));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Text: 'SvgText',
}));
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ type: 'wifi' }),
}));
jest.mock('../src/assets/image_cover_default.jpg', () => 'original-cover');
jest.mock('../src/hooks/useCoverPreferences', () => ({
  useCoverPreferences: () => mockPreferences,
}));
jest.mock('../src/theme/AppTheme', () => ({
  useAppTheme: () => ({
    dark: mockDark,
    colors: { background: '#f5f5f5', accent: '#e53935' },
    t: () => '封面',
  }),
}));
const mockPreferences = {
  useDefaultCover: false,
  loadOnlyWifi: false,
  defaultCover: '',
  defaultCoverDark: '',
  showName: true,
  showAuthor: true,
  showNameDark: true,
  showAuthorDark: true,
  horizontal: false,
  keepPunctuation: false,
};
let mockDark = false;
let renderer: ReactTestRenderer;
const cover = (uri?: string) => (
  <BookCover
    name="长标题😀"
    author="作者"
    uri={uri}
    style={{ width: 66, height: 90 }}
  />
);
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(mockPreferences, {
    useDefaultCover: false,
    defaultCover: '',
    defaultCoverDark: '',
    showName: true,
    showNameDark: true,
  });
  mockDark = false;
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});
const images = () => renderer.root.findAllByType(Image);
const glyphs = () => renderer.root.findAllByType(SvgText);
test('loading or failed images show the original background and text; a new URL can still load', async () => {
  await act(async () => {
    renderer = create(cover('https://example.com/a.jpg'));
  });
  expect(images()[0].props.source).toBe('original-cover');
  expect(glyphs().length).toBeGreaterThan(0);
  await act(async () => images()[1].props.onError());
  expect(images()).toHaveLength(1);
  await act(async () => renderer.update(cover('https://example.com/b.jpg')));
  expect(images()[1].props.source).toEqual({
    uri: 'https://example.com/b.jpg',
  });
  await act(async () => images()[1].props.onLoad());
  expect(glyphs()).toHaveLength(0);
});
test('uniform default cover overrides an existing book image and draws text over the chosen background', async () => {
  Object.assign(mockPreferences, {
    useDefaultCover: true,
    defaultCover: 'file:///paper.jpg',
  });
  await act(async () => {
    renderer = create(cover('https://example.com/book.jpg'));
  });
  expect(images()).toHaveLength(1);
  expect(images()[0].props.source).toEqual({ uri: 'file:///paper.jpg' });
  expect(glyphs().length).toBeGreaterThan(0);
  await act(async () => images()[0].props.onError());
  expect(images()[0].props.source).toBe('original-cover');
});
test('night background is independent of day background; hiding the title also hides author text', async () => {
  Object.assign(mockPreferences, {
    defaultCover: 'file:///day.jpg',
    showNameDark: false,
  });
  mockDark = true;
  await act(async () => {
    renderer = create(cover());
  });
  expect(images()[0].props.source).toBe('original-cover');
  expect(glyphs()).toHaveLength(0);
});
test('a stored cover takes priority and restores to custom then source without changing those layers', async () => {
  const book = {
    origin: 'https://source',
    coverUrl: 'https://source/a.jpg',
    customCoverUrl: 'https://custom/a.jpg',
    persistedCoverUrl: '/docs/covers/a.cover',
  };
  await act(async () => {
    renderer = create(<BookCover name="B" book={book} style={{ width: 66 }} />);
  });
  expect(images()[1].props.source).toEqual({
    uri: 'file:///docs/covers/a.cover',
  });
  await act(async () => {
    renderer.update(
      <BookCover
        name="B"
        book={{ ...book, persistedCoverUrl: undefined }}
        style={{ width: 66 }}
      />,
    );
  });
  expect(images()[1].props.source).toEqual({ uri: 'https://custom/a.jpg' });
  await act(async () => {
    renderer.update(
      <BookCover
        name="B"
        book={{
          ...book,
          customCoverUrl: undefined,
          persistedCoverUrl: undefined,
        }}
        style={{ width: 66 }}
      />,
    );
  });
  expect(images()[1].props.source).toEqual({ uri: 'https://source/a.jpg' });
});
