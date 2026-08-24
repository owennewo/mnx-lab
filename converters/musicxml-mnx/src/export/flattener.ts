import {
  MnxSequence,
  MnxEvent,
  MnxGrace,
  MnxNote,
  MnxTuplet,
  isGrace,
  isTimedEvent,
  isTuplet
} from '../common/types.js';
import { calculateXmlDuration, tupletUnits } from '../common/utils.js';

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
  /**
   * Set on notes inside an MNX `grace` container. MusicXML says the same thing
   * with a `<grace>` element and NO `<duration>` — an un-timed note is one the
   * measure's arithmetic must not see, so `duration` stays 0 here too.
   */
  grace?: { slash: boolean; graceType?: MnxGrace['graceType'] };
  /**
   * Set on notes inside an MNX `tuplet` container: the `<time-modification>`
   * to write, and whether this note opens or closes the `<tuplet>` bracket in
   * `<notations>`. MusicXML flags every member of the group, the way Guitar
   * Pro does — the container is ours to expand.
   */
  tuplet?: {
    actualNotes: number;
    normalNotes: number;
    normalType: string;
    start: boolean;
    stop: boolean;
  };
}

/**
 * Flattens parallel MNX sequences in a measure into a single linear sequence
 * of MusicXML nodes separated by backups and forwards.
 */
/** One event placed on a voice's timeline, with whatever container it came
 *  out of still attached to it. */
interface TimedEvent {
  onset: number;
  /** Divisions consumed — 0 for a grace, the PERFORMED value in a tuplet. */
  duration: number;
  event: MnxEvent;
  grace?: FlatXmlNode['grace'];
  tuplet?: FlatXmlNode['tuplet'];
}

export function flattenSequences(
  sequences: MnxSequence[],
  divisions: number
): FlatXmlNode[] {
  const result: FlatXmlNode[] = [];
  if (sequences.length === 0) return result;

  // 1. Group events into timed voices
  const voiceTracks = new Map<string, Array<TimedEvent>>();

  for (const seq of sequences) {
    const rawVoice = seq.voice || '1';
    // Clean up voice name to just digits if possible (e.g. 'v1' -> '1')
    const voiceName = rawVoice.replace(/^v/, '');
    
    if (!voiceTracks.has(voiceName)) {
      voiceTracks.set(voiceName, []);
    }
    const track = voiceTracks.get(voiceName)!;

    let cursor = 0;
    for (const item of seq.content) {
      if (isGrace(item)) {
        // Un-timed: every inner note sits at the cursor and none of them move
        // it, so the container's principal still lands where the measure says.
        // Document order is what puts them ahead of (or after) it — the same
        // thing MusicXML relies on, since a `<grace>` note has no `<duration>`
        // to place it with.
        const grace = { slash: item.slash !== false, graceType: item.graceType };
        for (const inner of item.content) {
          track.push({ onset: cursor, duration: 0, event: inner, grace });
        }
        continue;
      }

      if (isTuplet(item)) {
        const units = tupletUnits(item);
        for (const [index, inner] of item.content.entries()) {
          const written = calculateXmlDuration(
            inner.duration.base,
            inner.duration.dots || 0,
            divisions
          );
          // The PERFORMED length. `<duration>` is real time and `<type>` is the
          // written symbol; a triplet is precisely the case where they differ,
          // and writing the written value into `<duration>` is the classic way
          // to make a bar overflow by a third.
          const performed = units
            ? Math.round((written * units.outerTicks) / units.innerTicks)
            : written;
          track.push({
            onset: cursor,
            duration: performed,
            event: inner,
            ...(units
              ? {
                  tuplet: {
                    actualNotes: units.actualNotes,
                    normalNotes: units.normalNotes,
                    normalType: units.normalType,
                    start: index === 0,
                    stop: index === item.content.length - 1
                  }
                }
              : {})
          });
          cursor += performed;
        }
        continue;
      }

      if (!isTimedEvent(item)) continue;
      const durDivs = calculateXmlDuration(item.duration.base, item.duration.dots || 0, divisions);
      track.push({
        onset: cursor,
        duration: durDivs,
        event: item
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

      // Whatever container the event came out of travels with every node it
      // produces: MusicXML flags each `<note>`, so a chord inside a tuplet
      // needs the `<time-modification>` on all of its members.
      const container = {
        ...(item.grace ? { grace: item.grace } : {}),
        ...(item.tuplet ? { tuplet: item.tuplet } : {})
      };

      if (item.event.rest) {
        result.push({
          type: 'rest',
          duration: item.duration,
          voice: voiceName,
          base,
          dots,
          ...container,
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
            ...container,
            // The `<tuplet>` bracket opens and closes ONCE per group, on its
            // principal note — repeating it on every member of a chord would
            // open three brackets and close three.
            ...(isChord && item.tuplet
              ? { tuplet: { ...item.tuplet, start: false, stop: false } }
              : {}),
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
