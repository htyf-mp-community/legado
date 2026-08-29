export function readerChromeColors(
  followsPage: boolean,
  page: { background: string; foreground: string },
  app: { background: string; foreground: string },
) {
  return followsPage ? page : app;
}
