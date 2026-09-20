/**
 * The playback paint: which drawn ink is SOUNDING right now, applied as
 * classes and attributes on the finished SVG — never a relayout
 * (docs/player-element.md). Two things ride on it:
 *
 * - `data-playback-voice`: the note's voice, 1-based and cycled through
 *   `PLAYBACK_VOICE_COLOURS`, so the viewer's stylesheet can give each voice
 *   its own colour. A bass line held under a moving melody reads as two
 *   colours, not one blue smear.
 * - A fret mask stretched to the note's release: the tab layout records
 *   where each mask's note ends (`RectPrim.spanEndX`, emitted as
 *   `data-span-end` in px) and this paint widens the rect to it while the
 *   note sounds, restoring the original geometry when it stops. Each string
 *   of a chord shows its own length.
 *
 * DOM-only functions; nothing runs at module load, so `engine/` stays
 * importable from Node.
 */

/** Voices beyond this count wrap back to the first colour. */
export const PLAYBACK_VOICE_COLOURS = 4;

/**
 * Air the stretched mask adds around the digit, as fractions of its height:
 * generous on the left, where the digit's own mask ends flush with the
 * glyph, and a sliver above and below. The vertical pad is deliberately
 * over the limit at which two masks on ADJACENT strings touch — the layout
 * caps the mask just short of the string spacing (`FRET_BG_HEIGHT_SP`), so
 * any pad at all makes a chord's masks meet. Reviewed and accepted
 * 2026-09-13: a chord reading as one block beats a mask that vanishes into
 * the string line it sits on.
 */
const MASK_PAD_LEFT = 0.3;
const MASK_PAD_VERTICAL = 0.1;

/** The colour slot a 1-based voice paints with. */
export function playbackVoiceSlot(voice: number): number {
  return ((Math.max(1, Math.floor(voice)) - 1) % PLAYBACK_VOICE_COLOURS) + 1;
}

/**
 * Paint `sounding` (DOM id → 1-based voice) onto every inked node under
 * `root`. Ink outside the performed slice (`unperformed`) never lights.
 *
 * Two names are read, not one. `data-source-id` is the score's shared
 * vocabulary — the selection, the hit test and this paint all speak it.
 * `data-playback-id` belongs to ink that exists for the playhead ALONE: the
 * tab staff's rest pill, which must light like any other mark and must not
 * join a selection or answer a click (`layout/tabStaff.ts`). A node carrying
 * either one is lit the same way.
 */
export function paintPlaybackInk(root: ParentNode, sounding: ReadonlyMap<string, number>): void {
  for (const ink of root.querySelectorAll<SVGElement>('[data-source-id], [data-playback-id]')) {
    const key = ink.getAttribute('data-source-id') ?? ink.getAttribute('data-playback-id') ?? '';
    const voice = ink.classList.contains('unperformed')
      ? undefined
      : sounding.get(key);
    ink.classList.toggle('playback-ink', voice !== undefined);
    if (voice === undefined) ink.removeAttribute('data-playback-voice');
    else ink.setAttribute('data-playback-voice', String(playbackVoiceSlot(voice)));
    if (ink.classList.contains('fret-bg')) stretchMask(ink, voice !== undefined);
  }
}

/**
 * Widen a fret mask to its recorded duration end while it sounds, and put it
 * back afterwards. The original geometry is stashed on the element itself, so
 * a repaint that no longer lights the note restores exactly what the emitter
 * drew — the paint owns no state the SVG does not carry.
 */
export function stretchMask(rect: Element, on: boolean): void {
  const end = rect.getAttribute('data-span-end');
  const stashedX = rect.getAttribute('data-mask-x');
  if (on && end !== null) {
    const read = (stash: string, live: string) =>
      Number(stashedX !== null ? rect.getAttribute(stash) : rect.getAttribute(live));
    const x0 = read('data-mask-x', 'x'), w0 = read('data-mask-w', 'width');
    const y0 = read('data-mask-y', 'y'), h0 = read('data-mask-h', 'height');
    if (stashedX === null) {
      rect.setAttribute('data-mask-x', String(x0));
      rect.setAttribute('data-mask-w', String(w0));
      rect.setAttribute('data-mask-y', String(y0));
      rect.setAttribute('data-mask-h', String(h0));
    }
    const padLeft = h0 * MASK_PAD_LEFT, padV = h0 * MASK_PAD_VERTICAL;
    const x = x0 - padLeft;
    // Never narrower than the digit's own mask: a very short note keeps its
    // full digit legible even when its span ends before the digit does.
    const w = Math.max(w0 + padLeft, Number(end) - x);
    rect.setAttribute('x', String(x));
    rect.setAttribute('width', String(w));
    rect.setAttribute('y', String(y0 - padV));
    rect.setAttribute('height', String(h0 + 2 * padV));
  } else if (stashedX !== null) {
    rect.setAttribute('x', stashedX);
    rect.setAttribute('width', rect.getAttribute('data-mask-w') ?? '0');
    rect.setAttribute('y', rect.getAttribute('data-mask-y') ?? '0');
    rect.setAttribute('height', rect.getAttribute('data-mask-h') ?? '0');
    for (const stash of ['data-mask-x', 'data-mask-w', 'data-mask-y', 'data-mask-h']) rect.removeAttribute(stash);
  }
}
