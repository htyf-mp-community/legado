export async function activateKeepAwakeAsync(): Promise<void> {
  throw new Error('当前调试容器未提供屏幕常亮能力');
}
export async function deactivateKeepAwake(): Promise<void> {}
