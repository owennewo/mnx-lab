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

/** Could this digit be the TENS of a fret this instrument can reach? `0` never
 *  can — `0x` is just `x` — and above the ceiling's tens digit neither can
 *  anything else, so the pair is the exception rather than the rule. */
function opensPair(digit: number): boolean {
  return digit >= 1 && digit * 10 <= MAX_ENTRY_FRET;
}

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
    if (this.candidate !== null) {
      const combined = this.candidate * 10 + digit;
      if (combined >= 10 && combined <= MAX_ENTRY_FRET) {
        this.clearCandidate();
        this.commit(combined);
        return;
      }
      // The new digit cannot extend the first. Commit the first, then resolve
      // the new one against the cursor resulting from that edit.
      this.flush();
    }
    // ONLY AN AMBIGUOUS DIGIT IS WORTH WAITING FOR. The window exists to let a
    // second digit arrive, and only a digit that could be the TENS of a legal
    // fret has one to wait for — `1` and `2` against a 24-fret ceiling. Every
    // other digit is already the whole answer, so holding it bought nothing
    // but half a second of a paint the reader had to watch settle.
    if (opensPair(digit)) this.begin(digit);
    else this.commit(digit);
  }

  /** Commit a pending digit before a non-digit action or lifecycle edge. */
  flush(): boolean {
    if (this.candidate === null) return false;
    const fret = this.candidate;
    this.clearCandidate();
    this.commit(fret);
    return true;
  }

  /** Drop transient input without touching the document — Escape's, via the
   *  mount's pending cascade (core-rung-addressing.md 6). Until then this had
   *  no key at all, and Escape mid-entry went through the blanket flush and
   *  WROTE the fret it was meant to abandon. */
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
