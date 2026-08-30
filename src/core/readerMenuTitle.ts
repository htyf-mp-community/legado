export type ReaderMenuTitle = {
  primary: string;
  addition?: string;
};

export type ReaderMenuTitleDetails = {
  chapter?: string;
  sourceUrl?: string;
};

export function readerMenuTitleDetails(
  addition?: string,
): ReaderMenuTitleDetails {
  const lines = (addition ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const sourceUrl = lines.find(line => /^https?:\/\//i.test(line));
  const chapter = lines.find(line => line !== sourceUrl);
  return {
    ...(chapter ? { chapter } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
  };
}

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
