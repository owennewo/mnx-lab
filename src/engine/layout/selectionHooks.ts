/**
 * The selection as a PAINT, not a layout input (2026-10-19).
 *
 * The layouts colour selected ink themselves: a notehead by its own note, a
 * stem, ledger line, flag, dot or articulation by any note of its chord, a
 * rest by its event, a fret by its note. That is right for a still engraving
 * and a golden, but it makes a cursor move cost a whole layout of the score.
 *
 * A host that repaints the selection itself (the viewer) passes these two
 * tokens as its selection instead. Every place that WOULD colour for the
 * selection then marks the primitive with the ids that select it, in the very
 * colour slot it would have filled; the SVG emitter turns the mark into
 * `data-selects` (and leaves the colour unset); and the host lights the drawn
 * ink by matching its own selection against those ids — the same rule, read
 * off the drawing (`elements/selectionPaint.ts`). Without the tokens nothing
 * here runs, so a still render and every golden are untouched.
 *
 * Ids are namespaced by the list that selects them: `n:` for a note
 * (`selectedNoteIds`), `e:` for an event (`selectedEventIds`).
 */
export const SELECT_NOTES_HOOK = '\u0000select-notes';
export const SELECT_EVENTS_HOOK = '\u0000select-events';

const MARK = '\u0000selects ';

/**
 * Where the selection would also add the `selected` class, a class token says
 * so: not all selected ink takes it (a ledger line, a dot and an arpeggio are
 * coloured and keep their class), and the enclosure reads `.selected`, so the
 * paint must add it exactly where the layout would have.
 */
export const SELECTED_CLASS_MARK = ' \u0000selected';

/** `className` without the class token, and whether it carried one. */
export function readClassMark(className: string | undefined): { className: string | undefined; marked: boolean } {
  if (className === undefined || !className.includes(SELECTED_CLASS_MARK)) return { className, marked: false };
  const rest = className.split(SELECTED_CLASS_MARK).join('');
  return { className: rest === '' ? undefined : rest, marked: true };
}

/** Whether this selection list asks for marks rather than colour. */
export function selectionHooked(ids: readonly string[] | undefined): boolean {
  return !!ids && (ids.includes(SELECT_NOTES_HOOK) || ids.includes(SELECT_EVENTS_HOOK));
}

/** The namespaces a (possibly combined) hooked list stands for. */
export function hookedNamespaces(ids: readonly string[]): ('n' | 'e')[] {
  return [
    ...(ids.includes(SELECT_NOTES_HOOK) ? ['n' as const] : []),
    ...(ids.includes(SELECT_EVENTS_HOOK) ? ['e' as const] : [])
  ];
}

/** A colour-slot mark: lit by any of `ids` in namespace `ns`. Undefined when there is none. */
export function selectionMark(ns: 'n' | 'e', ids: readonly (string | undefined)[]): string | undefined {
  const keys = ids.filter((id): id is string => id !== undefined).map(id => `${ns}:${id}`);
  return keys.length > 0 ? MARK + JSON.stringify(keys) : undefined;
}

/** The ids a colour value marks, or null when it is an ordinary colour. */
export function readSelectionMark(value: string | undefined): string[] | null {
  return value !== undefined && value.startsWith(MARK) ? (JSON.parse(value.slice(MARK.length)) as string[]) : null;
}

/** `value` with more ids — an ordinary colour (or none) is replaced, as the colour would have been. */
export function extendSelectionMark(value: string | undefined, keys: readonly string[]): string {
  const merged = [...new Set([...(readSelectionMark(value) ?? []), ...keys])];
  return MARK + JSON.stringify(merged);
}
