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

export function isSyntheticNoteKey(key: string): boolean {
  return key.startsWith('@m');
}
