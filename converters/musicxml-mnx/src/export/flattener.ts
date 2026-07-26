import { MnxSequence, MnxEvent, MnxNote } from '../common/types.js';
import { calculateXmlDuration } from '../common/utils.js';

export interface FlatXmlNode {
  type: 'note' | 'rest' | 'backup' | 'forward';
  duration: number; // in divisions
  voice?: string;
  note?: MnxNote;
  isChord?: boolean;
  /**
   * The MNX duration base/dots this node came from. `<duration>` alone is not
   * enough to write MusicXML: `<type>`/`<dot>` carry the *notated* symbol
   * (note head + flag + beaming), so they must be derived from the MNX
   * duration rather than guessed.
   */
  base?: string;
  dots?: number;
  /** Lyrics from the event this node came from (MusicXML hangs them off the
   *  note, MNX off the event). Written on the principal note only. */
  lyrics?: import('../common/types.js').MnxEventLyrics;
}

/**
 * Flattens parallel MNX sequences in a measure into a single linear sequence
 * of MusicXML nodes separated by backups and forwards.
 */
export function flattenSequences(
  sequences: MnxSequence[],
  divisions: number
): FlatXmlNode[] {
  const result: FlatXmlNode[] = [];
  if (sequences.length === 0) return result;

  // 1. Group events into timed voices
  const voiceTracks = new Map<string, Array<{ onset: number; duration: number; event: MnxEvent }>>();

  for (const seq of sequences) {
    const rawVoice = seq.voice || '1';
    // Clean up voice name to just digits if possible (e.g. 'v1' -> '1')
    const voiceName = rawVoice.replace(/^v/, '');
    
    if (!voiceTracks.has(voiceName)) {
      voiceTracks.set(voiceName, []);
    }
    const track = voiceTracks.get(voiceName)!;

    let cursor = 0;
    for (const event of seq.content) {
      const durDivs = calculateXmlDuration(event.duration.base, event.duration.dots || 0, divisions);
      track.push({
        onset: cursor,
        duration: durDivs,
        event
      });
      cursor += durDivs;
    }
  }

  // 2. Sort voice names to ensure consistent order (e.g. voice 1, then voice 2)
  const sortedVoices = Array.from(voiceTracks.keys()).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  let measureCursor = 0;

  for (let vIdx = 0; vIdx < sortedVoices.length; vIdx++) {
    const voiceName = sortedVoices[vIdx];
    const track = voiceTracks.get(voiceName)!;

    // Sort events in this track by onset
    track.sort((a, b) => a.onset - b.onset);

    // If this is not the first voice, we must backup to the start of the measure (0)
    if (vIdx > 0 && measureCursor > 0) {
      result.push({
        type: 'backup',
        duration: measureCursor
      });
      measureCursor = 0;
    }

    for (const item of track) {
      // If there is a gap between the current cursor and the event's onset, move forward
      if (item.onset > measureCursor) {
        const gap = item.onset - measureCursor;
        result.push({
          type: 'forward',
          duration: gap
        });
        measureCursor = item.onset;
      }

      const base = item.event.duration.base;
      const dots = item.event.duration.dots || 0;

      if (item.event.rest) {
        result.push({
          type: 'rest',
          duration: item.duration,
          voice: voiceName,
          base,
          dots,
          // Rests carry lyrics too — MusicXML allows `<lyric>` on any `<note>`,
          // and most of Sun-did-glide's syllables sit on rests.
          ...(item.event.lyrics ? { lyrics: item.event.lyrics } : {})
        });
        measureCursor += item.duration;
      } else if (item.event.notes && item.event.notes.length > 0) {
        const notes = item.event.notes;
        for (let nIdx = 0; nIdx < notes.length; nIdx++) {
          const note = notes[nIdx];
          const isChord = nIdx > 0;
          result.push({
            type: 'note',
            duration: item.duration,
            voice: voiceName,
            note,
            isChord,
            base,
            dots,
            // MusicXML puts the lyric on the chord's principal note only.
            ...(!isChord && item.event.lyrics ? { lyrics: item.event.lyrics } : {})
          });
        }
        measureCursor += item.duration;
      }
    }
  }

  return result;
}
