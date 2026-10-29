import { httpTtsPause, isSilentReadAloudParagraph } from './httpTts';

export type ReadAloudState = {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';
  paragraph: number;
  error?: string;
};
/** A foreground player must resolve speak() only after that paragraph ends. */
export type ReadAloudDriver = {
  speak: (
    text: string,
    index: number,
    signal: AbortSignal,
    started: () => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
};

/**
 * Single-owner paragraph state machine. Cancellation invalidates late network/player callbacks.
 * Time is milliseconds. The driver owns audio; this controller owns paragraph order and pauses.
 */
export class ReadAloudController {
  private generation = 0;
  private abort?: AbortController;
  private wake?: () => void;
  private state: ReadAloudState = { status: 'idle', paragraph: 0 };
  private paused = false;
  private audioReady = false;
  constructor(
    private driver: ReadAloudDriver,
    private changed: (state: ReadAloudState) => void,
  ) {}
  private emit(patch: Partial<ReadAloudState>) {
    this.state = { ...this.state, ...patch };
    this.changed(this.state);
  }
  private invalidate() {
    this.generation++;
    this.abort?.abort();
    this.wake?.();
    this.wake = undefined;
    this.paused = false;
    this.audioReady = false;
    return this.generation;
  }
  /** Stop active work and release pending waits. Safe during downloads and paragraph pauses. */
  async stop() {
    const generation = this.invalidate();
    await this.driver.stop();
    if (generation === this.generation)
      this.emit({ status: 'idle', error: undefined });
  }
  /** Pause audio immediately; loading work remains cancellable and cannot auto-resume it. */
  async pause() {
    this.paused = true;
    if (this.audioReady) await this.driver.pause();
    this.emit({ status: 'paused' });
  }
  /** Continue the same paragraph without refetching or restarting it. */
  async resume() {
    this.paused = false;
    if (this.audioReady) await this.driver.resume();
    this.wake?.();
    this.emit({ status: 'playing' });
  }
  /** Read paragraphs in order, skipping symbol-only text, and report only current-session errors. */
  async start(
    paragraphs: string[],
    startIndex: number,
    pauseMilliseconds: number,
  ) {
    const generation = this.invalidate(),
      abort = new AbortController();
    this.abort = abort;
    const current = () =>
      generation === this.generation && !abort.signal.aborted;
    const wait = (milliseconds: number) =>
      new Promise<void>(resolve => {
        const finish = () => {
          clearTimeout(timer);
          abort.signal.removeEventListener('abort', finish);
          resolve();
        };
        const timer = setTimeout(finish, milliseconds);
        abort.signal.addEventListener('abort', finish, { once: true });
      });
    try {
      await this.driver.stop();
      if (!current()) return;
      for (
        let index = Math.max(0, Math.trunc(startIndex));
        index < paragraphs.length && current();
        index++
      ) {
        if (this.paused)
          await new Promise<void>(resolve => {
            this.wake = resolve;
          });
        if (!current()) return;
        this.emit({ paragraph: index, status: 'loading', error: undefined });
        this.audioReady = false;
        if (!isSilentReadAloudParagraph(paragraphs[index])) {
          await this.driver.speak(
            paragraphs[index],
            index,
            abort.signal,
            () => {
              if (!current()) return;
              this.audioReady = true;
              if (this.paused) void this.driver.pause();
              this.emit({ status: this.paused ? 'paused' : 'playing' });
            },
          );
        }
        const pause = httpTtsPause(
          index,
          paragraphs.length - 1,
          pauseMilliseconds,
        );
        if (current() && pause) await wait(pause);
      }
      if (current()) this.emit({ status: 'ended' });
    } catch (error) {
      if (current())
        this.emit({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
    }
  }
}
