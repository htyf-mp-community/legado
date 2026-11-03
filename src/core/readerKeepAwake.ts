export type ScreenTimeoutSeconds = -1 | 0 | 60 | 300 | 600;
type WakeLock = {activate: (tag: string) => Promise<void>; deactivate: (tag: string) => Promise<void>};

/** Owns only its tag and serializes native calls across focus/lifecycle changes. */
export class ReaderKeepAwakeController {
  private focused = false;
  private foreground = false;
  private seconds: ScreenTimeoutSeconds = 0;
  private desired = false;
  private applied = false;
  private revision = 0;
  private disposed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private queue = Promise.resolve();
  constructor(private lock: WakeLock, private tag: string, private onError: (error: unknown) => void = () => {}) {}

  configure(focused: boolean, foreground: boolean, seconds: ScreenTimeoutSeconds) {
    if (this.disposed) return;
    if (this.focused === focused && this.foreground === foreground && this.seconds === seconds) return;
    this.focused = focused; this.foreground = foreground; this.seconds = seconds;
    this.interact();
  }

  interact() {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const enabled = this.focused && this.foreground && this.seconds !== 0;
    this.setDesired(enabled);
    if (enabled && this.seconds > 0) {
      this.timer = setTimeout(() => {this.timer = undefined; this.setDesired(false);}, this.seconds * 1000);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.setDesired(false);
  }

  settled() {return this.queue;}

  private setDesired(value: boolean) {
    if (this.desired === value && this.applied === value) return;
    if (this.desired !== value) this.revision++;
    this.desired = value;
    this.queue = this.queue.then(async () => {
      if (this.desired === this.applied) return;
      if (this.desired) {
        const revision = this.revision;
        try {await this.lock.activate(this.tag); this.applied = true;}
        catch (error) {
          // Activation may have reached native code before rejecting.
          try {await this.lock.deactivate(this.tag);}
          catch (_) {this.applied = true;}
          if (revision === this.revision) this.desired = false;
          this.onError(error);
        }
      } else {
        try {await this.lock.deactivate(this.tag); this.applied = false;}
        catch (error) {this.onError(error);}
      }
    });
  }
}
