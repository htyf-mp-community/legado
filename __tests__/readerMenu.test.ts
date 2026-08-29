jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn() },
}));

import {
  READER_MENU_KEYS,
  loadReaderMenuConfig,
  moveReaderMenuItem,
  normalizeReaderMenuConfig,
  saveReaderMenuConfig,
  setReaderMenuSection,
} from '../src/data/readerMenu';
import { appStorage } from '../src/data/storage';

test('normalizes duplicate, unknown and newly added reader actions', () => {
  const config = normalizeReaderMenuConfig({
    primary: ['help', 'help', 'unknown'],
    more: ['log', 'help'],
  });
  expect(config.primary.slice(0, 2)).toEqual(['help', 'bookmark']);
  expect(config.more).toEqual(['log']);
  expect([...config.primary, ...config.more]).toEqual(
    expect.arrayContaining([...READER_MENU_KEYS]),
  );
  expect(new Set([...config.primary, ...config.more]).size).toBe(
    READER_MENU_KEYS.length,
  );
});

test('moves actions inside a section and transfers them without loss', () => {
  const initial = normalizeReaderMenuConfig({
    primary: ['bookmark', 'help'],
    more: ['log'],
  });
  const moved = moveReaderMenuItem(initial, 'help', -1);
  expect(moved.primary.slice(0, 2)).toEqual(['help', 'bookmark']);
  const transferred = setReaderMenuSection(moved, 'help', 'more');
  expect(transferred.primary).not.toContain('help');
  expect(transferred.more).toEqual(['log', 'help']);
});

test('persists the normalized menu in the dedicated application storage', () => {
  const getString = appStorage.getString as jest.Mock;
  getString.mockReturnValue(
    JSON.stringify({ primary: ['help'], more: ['bookmark'] }),
  );
  expect(loadReaderMenuConfig()).toMatchObject({
    primary: expect.arrayContaining(['help']),
    more: ['bookmark'],
  });
  saveReaderMenuConfig({ primary: ['help'], more: ['bookmark'] });
  expect(appStorage.set).toHaveBeenCalledWith(
    'reader.menu.config.v1',
    expect.stringContaining('"help"'),
  );
});
