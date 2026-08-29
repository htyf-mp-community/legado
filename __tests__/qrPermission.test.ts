import { qrPermissionAction, shouldRequestCameraOnContinue } from '../src/core/qrPermission';

test.each([
  ['blocked', 'settings'],
  ['denied', 'request'],
  ['unavailable', 'none'],
  ['granted', 'none'],
  ['limited', 'none'],
] as const)('maps %s camera permission to %s recovery', (permission, action) => {
  expect(qrPermissionAction(permission)).toBe(action);
});

test('requests camera when leaving an initial QR result before permission was checked', () => {
  expect(shouldRequestCameraOnContinue('checking')).toBe(true);
  expect(shouldRequestCameraOnContinue('granted')).toBe(false);
});
