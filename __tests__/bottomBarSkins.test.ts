jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn(), remove: jest.fn() }) }));
import { inferBottomBarSkinAssignments, normalizeBottomBarSkins, sanitizeBottomBarSkinName, uniqueBottomBarSkinName } from '../src/data/bottomBarSkins';

test('sanitizes Android-compatible skin directory names and resolves duplicates', () => {
  expect(sanitizeBottomBarSkinName(' ../猫咪:主题. ')).toBe('_猫咪_主题');
  expect(sanitizeBottomBarSkinName('')).toBe('skin');
  expect(uniqueBottomBarSkinName('猫咪', ['猫咪', '猫咪 (2)'])).toBe('猫咪 (3)');
});

test('prefills canonical selected and normal slot images from nested ZIP paths', () => {
  expect(inferBottomBarSkinAssignments([
    '/tmp/a/bookshelf_selected.PNG',
    '/tmp/a/bookshelf_normal.webp',
    '/tmp/settings_selected.jpg',
    '/tmp/unknown_selected.png',
  ])).toEqual({
    bookshelf: { selected: '/tmp/a/bookshelf_selected.PNG', normal: '/tmp/a/bookshelf_normal.webp' },
    settings: { selected: '/tmp/settings_selected.jpg' },
  });
});

test('drops invalid metadata and preserves partial slot assignments', () => {
  expect(normalizeBottomBarSkins([{ name: 'A', assignments: { bookshelf: { selected: '/docs/a.png' }, home: { normal: '/docs/n.png' }, bad: { selected: '/bad' } }, createdAt: 1, updatedAt: 2 }])).toEqual([{ name: 'A', assignments: { bookshelf: { selected: '/docs/a.png' } }, createdAt: 1, updatedAt: 2 }]);
});
