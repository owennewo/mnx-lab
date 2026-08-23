import { MAX_ENTRY_FRET } from './intents.ts';

export const ENTRY_DIGIT_WINDOW_MS = 500;

export interface TabDigitClock {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

const browserClock: TabDigitClock = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: handle => clearTimeout(handle)
};

/** Pure stage-1 state machine; the workbench mount owns its real clock and lifecycle. */
export class TabDigitResolver {
  private candidate: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly commit: (fret: number) => void,
    private readonly pendingChanged: (candidate: number | null) => void,
    private readonly clock: TabDigitClock = browserClock,
    private readonly windowMs = ENTRY_DIGIT_WINDOW_MS
  ) {}

  get pending(): number | null {
    return this.candidate;
  }

  push(digit: number): void {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      throw new RangeError(`tab digit must be an integer from 0 to 9; got ${digit}`);
    }
    if (this.candidate === null) {
      this.begin(digit);
      return;
    }

    const combined = this.candidate * 10 + digit;
    if (combined >= 10 && combined <= MAX_ENTRY_FRET) {
      this.clearCandidate();
      this.commit(combined);
      return;
    }

    // The new digit cannot extend the first. Commit the first, then start a
    // new candidate against the cursor resulting from that edit.
    this.flush();
    this.begin(digit);
  }

  /** Commit a pending digit before a non-digit action or lifecycle edge. */
  flush(): boolean {
    if (this.candidate === null) return false;
    const fret = this.candidate;
    this.clearCandidate();
    this.commit(fret);
    return true;
  }

  /** Drop transient input without touching the document. Used only by tests. */
  cancel(): boolean {
    if (this.candidate === null) return false;
    this.clearCandidate();
    return true;
  }

  private begin(digit: number): void {
    this.candidate = digit;
    this.pendingChanged(digit);
    this.timer = this.clock.setTimeout(() => this.flush(), this.windowMs);
  }

  private clearCandidate(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
    this.candidate = null;
    this.pendingChanged(null);
  }
}
