function itemId(item: unknown) {
  return item && typeof item === 'object' && 'id' in item
    ? (item as { id?: unknown }).id
    : undefined;
}

function chapterIdentity(item: unknown) {
  const parts = String(itemId(item) ?? '').split(':');
  return parts.length >= 3 ? `${parts[0]}:${parts[1]}` : '';
}

/** Resolve Legado's media-button policy without depending on the native player. */
export function resolveRemoteQueueIndex(
  queue: readonly unknown[],
  activeIndex: number,
  direction: -1 | 1,
  perSegment: boolean,
) {
  if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= queue.length)
    return undefined;
  if (perSegment) {
    const target = activeIndex + direction;
    return target >= 0 && target < queue.length ? target : undefined;
  }
  const currentChapter = chapterIdentity(queue[activeIndex]);
  if (!currentChapter) return undefined;
  if (direction > 0) {
    for (let index = activeIndex + 1; index < queue.length; index += 1)
      if (chapterIdentity(queue[index]) !== currentChapter) return index;
    return undefined;
  }
  let previousChapter = '';
  for (let index = activeIndex - 1; index >= 0; index -= 1) {
    const chapter = chapterIdentity(queue[index]);
    if (chapter && chapter !== currentChapter) {
      previousChapter = chapter;
      break;
    }
  }
  if (!previousChapter) return undefined;
  return queue.findIndex(item => chapterIdentity(item) === previousChapter);
}
export const AUDIO_REMOTE_CHAPTER_EVENT = 'legado.audio.remoteChapter';
