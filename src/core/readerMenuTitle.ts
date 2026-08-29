export type ReaderMenuTitle = {
  primary: string;
  addition?: string;
};

export function readerMenuTitle(
  bookName: string,
  chapterTitle: string,
  chapterUrl: string | undefined,
  showAddition: boolean,
  chapterNameOnly: boolean,
): ReaderMenuTitle {
  const primary = bookName.trim(),
    chapter = chapterTitle.trim(),
    remoteUrl = /^https?:\/\//i.test(chapterUrl?.trim() ?? '')
      ? chapterUrl!.trim()
      : '';
  if (!showAddition || (!chapter && !remoteUrl)) return { primary };
  return {
    primary,
    addition:
      chapterNameOnly || !remoteUrl
        ? chapter
        : chapter
          ? `${chapter}\n${remoteUrl}`
          : remoteUrl,
  };
}
