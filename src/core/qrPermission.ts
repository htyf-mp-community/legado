export type QrPermissionAction = 'settings' | 'request' | 'none';

export function qrPermissionAction(permission: string): QrPermissionAction {
  if (permission === 'blocked') return 'settings';
  if (permission === 'denied') return 'request';
  return 'none';
}

export function shouldRequestCameraOnContinue(permission: string) {
  return permission === 'checking';
}
