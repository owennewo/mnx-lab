/**
 * Stable per-note selection keys shared by the layout engines and the
 * document (JSON) pane. A note's own `id` is always preferred; when a
 * document carries no ids (most spec/ mirrors), a positional key is
 * synthesized so selection and note↔document cross-location still work.
 *
 * The positional key encodes the layout engines' traversal of `parts[0]`:
 * measure index, voice index *within the staff-1 sequences* (sequences with
 * `staff` 1 or undefined — both layouts filter the same way), event index in
 * `content`, and note index in `notes`. src/utils/jsonView.ts mirrors this
 * traversal when it anchors document lines.
 */
export function syntheticNoteKey(
  measureIndex: number,
  voiceIndex: number,
  eventIndex: number,
  noteIndex: number
): string {
  return `@m${measureIndex}.v${voiceIndex}.e${eventIndex}.n${noteIndex}`;
}

/**
 * The general positional key. Every segment is OPTIONAL except the ones the
 * original form always carried, so keys written before parts and staves became
 * addressable are byte-identical under the new grammar:
 *
 *   `@[p<part>.]m<measure>[.s<staff>].v<voice>.e<event>[.c<container>].n<note>`
 *
 * Part 0 and staff 1 stay silent because they were the whole world when the
 * scheme was written (campaign item 13b) — and because a key that changed shape
 * would move every golden that embeds it.
 */
export function positionalNoteKey(coords: {
  partIndex: number;
  measureIndex: number;
  staffIndex: number;
  voiceIndex: number;
  eventIndex: number;
  containerIndex?: number;
  noteIndex: number;
}): string {
  const part = coords.partIndex > 0 ? `p${coords.partIndex}.` : '';
  const staff = coords.staffIndex > 1 ? `.s${coords.staffIndex}` : '';
  const container = coords.containerIndex === undefined ? '' : `.c${coords.containerIndex}`;
  return `@${part}m${coords.measureIndex}${staff}.v${coords.voiceIndex}.e${coords.eventIndex}${container}.n${coords.noteIndex}`;
}

/** A percussion kit note's key: same coordinates, `k` instead of `n`, because
 *  it is a different list on the event (`kitNotes`, not `notes`). */
export function kitNoteKey(
  measureIndex: number,
  voiceIndex: number,
  eventIndex: number,
  kitIndex: number,
  partIndex = 0
): string {
  const part = partIndex > 0 ? `p${partIndex}.` : '';
  return `@${part}m${measureIndex}.v${voiceIndex}.e${eventIndex}.k${kitIndex}`;
}

/**
 * An EVENT's own key — the same coordinates with no note segment at all:
 *
 *   `@[p<part>.]m<measure>[.s<staff>].v<voice>.e<event>[.c<container>]`
 *
 * A rest has no notes, so it had no name, so nothing could point at it: the
 * selection enclosure fell back to interpolating a metric fraction across the
 * bar and drew the box on the wrong beat
 * (roadmap/complete/core-rung-insert.md). An event is a thing you can
 * select, so it needs an identity like every other thing you can select.
 *
 * It cannot collide with a note key: those always end in `.n<i>` or `.k<i>`,
 * and this one always ends at the event (or its container slot).
 */
export function syntheticEventKey(coords: {
  partIndex?: number;
  measureIndex: number;
  staffIndex?: number;
  voiceIndex: number;
  eventIndex: number;
  containerIndex?: number;
}): string {
  const part = (coords.partIndex ?? 0) > 0 ? `p${coords.partIndex}.` : '';
  const staff = (coords.staffIndex ?? 1) > 1 ? `.s${coords.staffIndex}` : '';
  const container = coords.containerIndex === undefined ? '' : `.c${coords.containerIndex}`;
  return `@${part}m${coords.measureIndex}${staff}.v${coords.voiceIndex}.e${coords.eventIndex}${container}`;
}
