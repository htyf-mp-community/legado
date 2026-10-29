export function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) {
    const cause = new Error('Operation cancelled');
    cause.name = 'AbortError';
    throw cause;
  }
}
export async function abortableDelay(
  milliseconds: number,
  signal: AbortSignal,
) {
  checkCancelled(signal);
  if (milliseconds <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
        signal.removeEventListener('abort', cancel);
        resolve();
      },
      timer = setTimeout(finish, milliseconds),
      cancel = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
        try {
          checkCancelled(signal);
        } catch (cause) {
          reject(cause);
        }
      };
    signal.addEventListener('abort', cancel);
    if (signal.aborted) cancel();
  });
}
