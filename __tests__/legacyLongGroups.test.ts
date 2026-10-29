jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn() },
  APP_STORAGE_ID: 'test',
}));
import { parseLegacyJson } from '../src/core/legacyJson';
import { convertLegacyBackup } from '../src/data/legacyBackup';
test('preserves unsafe native integer masks without changing strings, safe numbers or fractions', () => {
  expect(
    parseLegacyJson(
      '{"id":1152921504606846976,"small":3,"decimal":1.5,"text":"id 1152921504606846976"}',
    ),
  ).toEqual({
    id: '1152921504606846976',
    small: 3,
    decimal: 1.5,
    text: 'id 1152921504606846976',
  });
  expect(() => parseLegacyJson('{"id":12oops}')).toThrow();
});
test('restores high-bit group membership and native group settings without 32-bit truncation', () => {
  const converted = convertLegacyBackup({
    'bookGroup.json':
      '[{"groupId":-1,"groupName":"全部","show":false},{"groupId":1152921504606846976,"groupName":"高位","bookSort":5,"onlyUpdateRead":true,"cover":"https://example.test/cover.jpg"},{"groupId":1,"groupName":"一"}]',
    'bookshelf.json':
      '[{"bookUrl":"book","name":"A","group":1152921504606846977,"type":288}]',
  });
  const groups = JSON.parse(
    String(converted.payload.entries['bookshelf.groups.v1'].value),
  );
  expect(groups[0]).toMatchObject({ id: '-1', show: false });
  expect(groups[1]).toMatchObject({
    id: '1152921504606846976',
    bookSort: 5,
    onlyUpdateRead: true,
    cover: 'https://example.test/cover.jpg',
  });
  const book = JSON.parse(
    String(converted.payload.entries['library.v1'].value),
  )[0];
  expect(book).toMatchObject({
    groupIds: ['1152921504606846976', '1'],
    sourceType: 1,
    nativeType: 288,
  });
});
