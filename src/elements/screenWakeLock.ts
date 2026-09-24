/**
 * Holds the screen awake while something is playing.
 *
 * A tablet on a music stand is the case this exists for: the reader's hands
 * are on the instrument, so nothing touches the screen for the length of a
 * song and the device dims and locks in the middle of it.
 *
 * Three facts about the API shape everything here:
 *
 * - The browser releases the lock by itself whenever the page stops being
 *   visible, and does NOT give it back on return. So a visibility listener,
 *   not a one-shot request, is the minimum correct implementation.
 * - `request` rejects rather than resolves when the document is hidden, and
 *   inside an iframe without the `screen-wake-lock` permission policy — which
 *   the embed face is. Every path is therefore allowed to fail quietly; a
 *   score that plays without holding the screen is the old behaviour, not a
 *   broken one.
 * - Safari and older browsers have no `navigator.wakeLock` at all.
 *
 * DOM-only, so it lives in elements/ beside the bindings rather than in audio/,
 * which stays importable from Node.
 */
export interface ScreenWakeLock {
  /** Whether playback wants the screen held. Idempotent; call it freely. */
  want(on: boolean): void;
  /** Release and stop listening. */
  dispose(): void;
}

export function screenWakeLock(): ScreenWakeLock {
  let wanted = false;
  let sentinel: WakeLockSentinel | null = null;
  let acquiring = false;
  let disposed = false;

  const acquire = () => {
    if (disposed || !wanted || sentinel || acquiring) return;
    if (document.visibilityState !== 'visible') return; // would reject
    const api = navigator.wakeLock;
    if (!api) return;
    acquiring = true;
    api.request('screen').then(
      (held) => {
        acquiring = false;
        // `want(false)` or dispose() may have landed while the request was in
        // flight: the lock is no longer wanted, so let it go immediately.
        if (!wanted || disposed) {
          void held.release().catch(() => {});
          return;
        }
        sentinel = held;
        held.addEventListener('release', () => {
          if (sentinel === held) sentinel = null;
        });
      },
      () => {
        acquiring = false;
      },
    );
  };

  const release = () => {
    const held = sentinel;
    sentinel = null;
    if (held) void held.release().catch(() => {});
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') acquire();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    want(on: boolean) {
      if (disposed || on === wanted) return;
      wanted = on;
      if (on) acquire();
      else release();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      wanted = false;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    },
  };
}
