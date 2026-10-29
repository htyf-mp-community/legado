import {
  getBookshelfRefreshSnapshot,
  observeBookshelfRefresh,
  trackBookshelfRefresh,
} from '../src/services/bookshelfRefreshRuntime';
test('waiting counts include running books and combine overlapping scopes without double counting a book', () => {
  const changed = jest.fn(),
    remove = observeBookshelfRefresh(changed);
  const first = trackBookshelfRefresh(['one', 'two']),
    second = trackBookshelfRefresh(['two', 'three']);
  expect(getBookshelfRefreshSnapshot().pending).toBe(3);
  first.start('one');
  expect([...getBookshelfRefreshSnapshot().running]).toEqual(['one']);
  first.finish('one');
  expect(getBookshelfRefreshSnapshot().pending).toBe(2);
  second.start('two');
  first.dispose();
  expect(getBookshelfRefreshSnapshot().pending).toBe(2);
  expect([...getBookshelfRefreshSnapshot().running]).toEqual(['two']);
  second.dispose();
  expect(getBookshelfRefreshSnapshot().pending).toBe(0);
  remove();
  const count = changed.mock.calls.length;
  trackBookshelfRefresh([]).dispose();
  expect(changed).toHaveBeenCalledTimes(count);
});
