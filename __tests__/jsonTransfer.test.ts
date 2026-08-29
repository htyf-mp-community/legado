jest.mock('@react-native-documents/picker', () => ({
  saveDocuments: jest.fn(),
}));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));
jest.mock('react-native', () => ({ Share: { share: jest.fn() } }));

import { saveDocuments } from '@react-native-documents/picker';
import { unlink, writeFile } from '@dr.pogodin/react-native-fs';
import { Share } from 'react-native';
import { saveJsonDocument, shareJsonText } from '../src/core/jsonTransfer';

const save = saveDocuments as jest.Mock,
  write = writeFile as jest.Mock,
  remove = unlink as jest.Mock,
  share = Share.share as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  write.mockResolvedValue(undefined);
  remove.mockResolvedValue(undefined);
});

test('writes JSON, opens the document saver and removes its temporary file', async () => {
  save.mockResolvedValue([{ uri: 'content://saved', error: null }]);
  await expect(saveJsonDocument('[{"name":"A"}]', 'bookSource.json')).resolves.toEqual(
    expect.objectContaining({ uri: 'content://saved' }),
  );
  expect(write).toHaveBeenCalledWith(
    expect.stringMatching(/^\/tmp\/\d+-bookSource\.json$/),
    '[{"name":"A"}]',
    'utf8',
  );
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      mimeType: 'application/json',
      fileName: 'bookSource.json',
      copy: true,
    }),
  );
  expect(remove).toHaveBeenCalled();
});

test('cleans its temporary file when the document saver reports an error', async () => {
  save.mockResolvedValue([{ uri: '', error: 'denied' }]);
  await expect(saveJsonDocument('{}', 'rules')).rejects.toThrow('denied');
  expect(remove).toHaveBeenCalled();
});

test('shares exported JSON through React Native system share', async () => {
  share.mockResolvedValue({ action: 'sharedAction' });
  await shareJsonText('{}', 'Book sources');
  expect(share).toHaveBeenCalledWith({ message: '{}', title: 'Book sources' });
});
