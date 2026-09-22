/**
 * The seam between the editor's cursor and a player — roadmap/proposed/
 * core-single-cursor.md. The cursor IS the playhead: paused, every settled
 * cursor move seeks the player; playing, the player's clock is the truth and
 * a pause parks the cursor where the music stopped.
 *
 * `bindEditor` takes one of these; whoever owns the player makes it —
 * `bindPlayback` for studio, the scenario page for the workbench. It lives on
 * its own so that neither side imports the other: the playback binding knows
 * nothing about `edit/`, and the editor binding nothing about how a shell
 * holds its player.
 */
import type { Rational } from '../model/time.ts';

/** A performed place as the player addresses it: a visit of the pass model and an offset into its bar, in whole notes. */
export interface PerformedPosition {
  ordinal: number;
  offset: Rational;
}

export interface CursorPlayback {
  /** Is the player playing (or asked to be)? */
  readonly playing: boolean;
  /** Where the playhead is, or null before anything is loaded. */
  readonly playhead: PerformedPosition | null;
  /** Put the playhead here. */
  seek(position: PerformedPosition): void;
  /** Every playback-state change — playing, pausing, the playhead moving. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /**
   * An editor cursor now owns the press-to-seek: a click places the cursor and
   * the cursor seeks, so the player's own click handling stands down rather
   * than seeking a second time. Returns the release.
   */
  couple(): () => void;
}
