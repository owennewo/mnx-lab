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
  /** Sound the note the cursor landed on, on that visit — the player decides whether it can
   *  (roadmap: core-note-audition). `edited`: an edit just made or changed it, so the sound
   *  waits for the performance that edit produces. Optional: a player without one stays silent. */
  audition?(note: { noteKey: string; ordinal: number; edited?: boolean }): void;
  /** Where the cursor stands, for the player's readout to name while it is not playing — an
   *  exact place in the score, where the playhead read back from a recording's clock is only
   *  near it. Null when there is no cursor to name (playing, hidden, unbound). Optional. */
  place?(position: PerformedPosition | null): void;
  /** The performed bars the selection covers, first and last — what the player's Loop button
   *  loops (roadmap/inprogress/studio-player-practice.md). Null when there is none. Optional. */
  range?(bars: { first: number; last: number } | null): void;
  /** A press on the score landed the cursor on this performed bar: a loop it is outside moves to
   *  start there. Comes before the seek the press makes; a key's move does not call it. Optional. */
  pressed?(ordinal: number): void;
}
