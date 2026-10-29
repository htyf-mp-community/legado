export const backupArchiveFileName = (
  onlyLatest: boolean,
  deviceName: string,
  now = Date.now(),
) =>
  onlyLatest
    ? 'backup-htyf.zip'
    : `backup${new Date(now).toISOString().slice(0, 10)}-${deviceName}.zip`;
