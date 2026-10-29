jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn() },
}));
jest.mock('../src/data/backup', () => ({ parseBackup: jest.fn() }));
jest.mock('react-native-quick-base64', () => ({ fromByteArray: jest.fn() }));
import { localMediaPath } from '../src/core/backupMediaPaths';
import { parseWebDavBackupList } from '../src/data/remoteBackup';
const { withRuntimeURL } = jest.requireActual('../scripts/test-support/rnUrl');
test('decodes file URIs with the actual pinned RN URL implementation installed', () =>
  withRuntimeURL(() => {
    expect(new URL('file:///docs/reading%20paper.png').pathname).toBe('/'); // Runtime regression trigger.
    expect(localMediaPath('file:///docs/reading%20paper.png')).toBe(
      '/docs/reading paper.png',
    );
    expect(localMediaPath('file://localhost/docs/a%23b.png')).toBe(
      '/docs/a#b.png',
    );
    expect(localMediaPath('file://other-host/docs/a.png')).toBeUndefined();
  }));
test('resolves absolute, root-relative and relative DAV hrefs without repeating directory segments on RN', () =>
  withRuntimeURL(() => {
    const root = 'http://127.0.0.1:18201/legado/';
    for (const href of [
      'http://127.0.0.1:18201/legado/backup.zip',
      '/legado/backup.zip',
      'backup.zip',
      './backup.zip',
      '../legado/backup.zip',
    ]) {
      const xml = `<d:multistatus><d:response><d:href>${href}</d:href><d:displayname>backup.zip</d:displayname></d:response></d:multistatus>`;
      expect(parseWebDavBackupList(xml, root)[0].url).toBe(root + 'backup.zip');
    }
  }));
test('rejects DAV parent escapes with the same RN implementation', () =>
  withRuntimeURL(() => {
    for (const href of [
      '../outside/backup.zip',
      '/legado/%2e%2e/outside/backup.zip',
      '//other.test/legado/backup.zip',
    ]) {
      const xml = `<d:multistatus><d:response><d:href>${href}</d:href><d:displayname>backup.zip</d:displayname></d:response></d:multistatus>`;
      expect(
        parseWebDavBackupList(xml, 'http://127.0.0.1:18201/legado/'),
      ).toEqual([]);
    }
  }));
