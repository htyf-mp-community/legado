jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
jest.mock('../src/data/generalPreferences', () => ({
  loadGeneralPreferences: () => ({ userAgent: 'Legado-HTYF/1' }),
}));
import { buildSourceRequest } from '../src/core/sourceRequest';
import type { BookSource } from '../src/types';

const source = (header?: string) => ({
  bookSourceUrl: 'https://example.com',
  bookSourceName: 'Example',
  bookSourceType: 0,
  enabled: true,
  enabledExplore: true,
  customOrder: 0,
  header,
} as BookSource);

test('adds the general user agent to source requests', () => {
  expect(buildSourceRequest(source(), '/books').headers['User-Agent']).toBe('Legado-HTYF/1');
});

test('keeps an explicit source user agent', () => {
  expect(buildSourceRequest(source('{"user-agent":"Source-UA"}'), '/books').headers['user-agent']).toBe('Source-UA');
});
