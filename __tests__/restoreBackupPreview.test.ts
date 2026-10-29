jest.mock('../src/data/storage', () => ({
  appStorage: { getString: () => undefined, set: jest.fn() },
}));
jest.mock('../src/data/backup', () => ({ restoreBackup: jest.fn() }));
jest.mock('../src/core/legacyBackupArchive', () => ({
  activateLegacyMedia: jest.fn(),
  commitLegacyMedia: jest.fn(async plan => {
    plan.committed = true;
  }),
  discardLegacyMedia: jest.fn(),
}));
import { restoreBackup } from '../src/data/backup';
import {
  activateLegacyMedia,
  commitLegacyMedia,
  discardLegacyMedia,
} from '../src/core/legacyBackupArchive';
import {
  restoreBackupPreview,
  type BackupPreview,
} from '../src/core/restoreBackupPreview';
const preview = (): BackupPreview => ({
  raw: 'backup',
  payload: {} as BackupPreview['payload'],
  mediaPlan: {
    workingDirectory: '/stage',
    targetDirectory: '/new',
    directories: ['covers'],
  },
});
beforeEach(() => jest.resetAllMocks());
test('copies media before replacing storage and commits staging only after storage succeeds', async () => {
  const order: string[] = [],
    value = preview();
  (activateLegacyMedia as jest.Mock).mockImplementation(async () => {
    order.push('files');
  });
  (restoreBackup as jest.Mock).mockImplementation(() => {
    order.push('storage');
  });
  (commitLegacyMedia as jest.Mock).mockImplementation(async plan => {
    order.push('commit');
    plan.committed = true;
  });
  await restoreBackupPreview(value);
  expect(order).toEqual(['files', 'storage', 'commit']);
  expect(discardLegacyMedia).not.toHaveBeenCalled();
  await expect(restoreBackupPreview(value)).rejects.toThrow('会话已结束');
});
test.each(['copy', 'storage'])(
  '%s failure rolls back the new files and leaves previous files owned by the old library',
  async stage => {
    const value = preview();
    (stage === 'copy'
      ? (activateLegacyMedia as jest.Mock)
      : (restoreBackup as jest.Mock)
    ).mockImplementation(() => {
      throw new Error('failure');
    });
    await expect(restoreBackupPreview(value)).rejects.toThrow('failure');
    expect(commitLegacyMedia).not.toHaveBeenCalled();
    expect(discardLegacyMedia).toHaveBeenCalledWith(
      expect.objectContaining({ restoring: false }),
    );
    if (stage === 'copy') expect(restoreBackup).not.toHaveBeenCalled();
  },
);
test('an in-flight restore has one owner even if confirmation is pressed twice', async () => {
  const value = preview();
  let finish!: () => void;
  (activateLegacyMedia as jest.Mock).mockImplementation(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      }),
  );
  const pending = restoreBackupPreview(value);
  await expect(restoreBackupPreview(value)).rejects.toThrow('正在进行');
  finish();
  await pending;
  expect(restoreBackup).toHaveBeenCalledTimes(1);
});

test('passes ignore policy to storage and excludes backgrounds from media activation', async () => {
  const value = preview();
  value.mediaPlan!.directories = ['covers', 'bg'];
  await restoreBackupPreview(value, { readConfig: true, localBook: true });
  expect(activateLegacyMedia).toHaveBeenCalledWith(value.mediaPlan, ['bg']);
  expect(restoreBackup).toHaveBeenCalledWith('backup', undefined, undefined, {
    readConfig: true,
    localBook: true,
  });
});
