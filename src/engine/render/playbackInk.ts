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

/** Air the stretched mask adds left of the digit, as a fraction of its height. */
const MASK_PAD = 0.2;

/** The colour slot a 1-based voice paints with. */
export function playbackVoiceSlot(voice: number): number {
  return ((Math.max(1, Math.floor(voice)) - 1) % PLAYBACK_VOICE_COLOURS) + 1;
}

/**
 * Paint `sounding` (DOM source id → 1-based voice) onto every inked node under
 * `root`. Ink outside the performed slice (`unperformed`) never lights.
 */
export function paintPlaybackInk(root: ParentNode, sounding: ReadonlyMap<string, number>): void {
  for (const ink of root.querySelectorAll<SVGElement>('[data-source-id]')) {
    const voice = ink.classList.contains('unperformed')
      ? undefined
      : sounding.get(ink.getAttribute('data-source-id') ?? '');
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
    const x0 = stashedX !== null ? Number(stashedX) : Number(rect.getAttribute('x'));
    const w0 = stashedX !== null ? Number(rect.getAttribute('data-mask-w')) : Number(rect.getAttribute('width'));
    if (stashedX === null) {
      rect.setAttribute('data-mask-x', String(x0));
      rect.setAttribute('data-mask-w', String(w0));
    }
    const pad = Number(rect.getAttribute('height')) * MASK_PAD;
    const x = x0 - pad;
    // Never narrower than the digit's own mask: a very short note keeps its
    // full digit legible even when its span ends before the digit does.
    const w = Math.max(w0 + pad, Number(end) - x);
    rect.setAttribute('x', String(x));
    rect.setAttribute('width', String(w));
  } else if (stashedX !== null) {
    rect.setAttribute('x', stashedX);
    rect.setAttribute('width', rect.getAttribute('data-mask-w') ?? '0');
    rect.removeAttribute('data-mask-x');
    rect.removeAttribute('data-mask-w');
  }
}
