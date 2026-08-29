export function shouldBlockReaderHardwareBack(
  disabled: boolean,
  menuVisible: boolean,
) {
  return disabled && !menuVisible;
}
