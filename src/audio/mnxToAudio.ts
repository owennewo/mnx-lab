import { MnxStructure, isTimedEvent } from '../model/mnx.ts';
import { durationValue } from '../model/durations.ts';

export interface PlayableAudioEvent {
  beatTime: number; // offset in beats from start
  beatDuration: number; // duration in beats
  pitches: string[]; // Tone.js friendly format e.g. ["E3", "G#3"]
  noteIds: string[]; // corresponding note IDs for visual tracking
}

export function mnxToAudioEvents(mnx: MnxStructure): PlayableAudioEvent[] {
  const events: PlayableAudioEvent[] = [];

  if (!mnx.parts || mnx.parts.length === 0) return events;

  for (const part of mnx.parts) {
    const voiceBeatPositions: number[] = [];

    for (let measureIdx = 0; measureIdx < part.measures.length; measureIdx++) {
      const measure = part.measures[measureIdx];
      if (!measure.sequences) continue;

      for (let seqIdx = 0; seqIdx < measure.sequences.length; seqIdx++) {
        const sequence = measure.sequences[seqIdx];
        
        if (voiceBeatPositions[seqIdx] === undefined) {
          voiceBeatPositions[seqIdx] = 0;
        }

        let currentBeat = voiceBeatPositions[seqIdx];

        for (const ev of sequence.content) {
          // Grace containers are un-timed and unknown item kinds (tuplet,
          // tremolo, …) aren't modelled; playback skips both for now.
          if (!isTimedEvent(ev)) continue;
          // The one duration table (model/durations.ts) — whole-note
          // fractions; ×4 turns them into quarter-note beats. This used to be
          // a six-entry local copy that played a 64th (or a breve) as a
          // quarter without a word.
          const durationBeats = durationValue(ev.duration) * 4;

          if (ev.notes && ev.notes.length > 0) {
            const pitches: string[] = [];
            const noteIds: string[] = [];

            for (const note of ev.notes) {
              const step = note.pitch.step;
              const alter = note.pitch.alter;
              const octave = note.pitch.octave;
              const accidental = alter === 1 ? '#' : alter === -1 ? 'b' : '';
              pitches.push(`${step}${accidental}${octave}`);
              if (note.id) {
                noteIds.push(note.id);
              }
            }

            events.push({
              beatTime: currentBeat,
              beatDuration: durationBeats,
              pitches,
              noteIds
            });
          }

          currentBeat += durationBeats;
        }

        voiceBeatPositions[seqIdx] = currentBeat;
      }
    }
  }

  return events.sort((a, b) => a.beatTime - b.beatTime);
}
