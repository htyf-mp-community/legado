const mockPick = jest.fn(), mockKeepLocalCopy = jest.fn(), mockReadFile = jest.fn(), mockUnlink = jest.fn();
jest.mock('@react-native-documents/picker', () => ({ pick: (...args: unknown[]) => mockPick(...args), keepLocalCopy: (...args: unknown[]) => mockKeepLocalCopy(...args), types: { json: 'application/json', plainText: 'text/plain' } }));
jest.mock('@dr.pogodin/react-native-fs', () => ({ readFile: (...args: unknown[]) => mockReadFile(...args), unlink: (...args: unknown[]) => mockUnlink(...args) }));
jest.mock('../src/data/storage', () => ({ appStorage: { getString: () => undefined, set: () => undefined } }));
import { pickBookSourcesInput } from '../src/core/sourceImportFile';

beforeEach(() => { jest.clearAllMocks(); mockUnlink.mockResolvedValue(undefined); });
test('copies a picked source file, parses it, and removes the temporary copy', async () => {
  mockPick.mockResolvedValue([{ uri: 'content://source', name: 'sources.json' }]);
  mockKeepLocalCopy.mockResolvedValue([{ status: 'success', localUri: 'file:///tmp/sources.json' }]);
  mockReadFile.mockResolvedValue(JSON.stringify([{ bookSourceName: 'A', bookSourceUrl: 'https://a' }]));
  await expect(pickBookSourcesInput()).resolves.toEqual([expect.objectContaining({ bookSourceName: 'A', enabled: true })]);
  expect(mockReadFile).toHaveBeenCalledWith('/tmp/sources.json', 'utf8');
  expect(mockUnlink).toHaveBeenCalledWith('/tmp/sources.json');
});
test('reports local-copy errors without reading an invalid path', async () => {
  mockPick.mockResolvedValue([{ uri: 'content://source', name: null }]);
  mockKeepLocalCopy.mockResolvedValue([{ status: 'error', copyError: 'copy failed' }]);
  await expect(pickBookSourcesInput()).rejects.toThrow('copy failed');
  expect(mockReadFile).not.toHaveBeenCalled();
});
