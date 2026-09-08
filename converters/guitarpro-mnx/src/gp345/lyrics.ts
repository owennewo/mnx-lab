/** Legacy lyric text → per-note chunks consumed by the shared lyric mapper.
 * Hyphens split syllables and remain on the previous chunk; '+' survives as
 * the shared mapper's intra-syllable space escape. Empty chunks skip a note.
 */
export function splitBinaryLyrics(text: string): string[] {
  const visible = text.replace(/\[[^\]]*\]/g, '').replace(/\r\n?/g, '\n');
  const chunks: string[] = [];
  let current = '';
  let afterHyphen = false;
  for (const character of visible) {
    if (character === '-') {
      current += character;
      chunks.push(current);
      current = '';
      afterHyphen = true;
    } else if (/\s/.test(character)) {
      if (!afterHyphen) chunks.push(current);
      current = '';
      afterHyphen = false;
    } else {
      current += character;
      afterHyphen = false;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
