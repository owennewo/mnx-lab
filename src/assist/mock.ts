// Offline fallback for the chat-to-edit loop: when no OpenRouter key is
// configured, a few regex-matched commands (transpose / "whole note ending" /
// "double octave") mutate the document locally so the UI stays demoable.
// Shared with the Worker, which uses it as the no-key degraded mode.
import type { SelectionContextPayload } from './protocol.ts';

/** Mutates `mnx` in place and returns the explanation string. */
export function handleMockCommand(
  prompt: string,
  mnx: any,
  context: SelectionContextPayload
): string {
  const lowercasePrompt = prompt.toLowerCase();

  if (lowercasePrompt.includes('transpose')) {
    let semitones = 2;
    if (lowercasePrompt.includes('octave')) {
      semitones = 12;
    }
    const up = !lowercasePrompt.includes('down');
    const factor = up ? 1 : -1;
    const finalShift = semitones * factor;

    let notesCount = 0;

    if (mnx.parts && mnx.parts[0]) {
      const part = mnx.parts[0];
      for (const measure of part.measures) {
        if (!measure.sequences) continue;
        for (const sequence of measure.sequences) {
          for (const event of sequence.content) {
            if (event.notes) {
              for (const note of event.notes) {
                if (context.selectedNoteIds && context.selectedNoteIds.length > 0) {
                  if (!context.selectedNoteIds.includes(note.id)) continue;
                }

                if (Math.abs(finalShift) >= 12) {
                  note.pitch.octave += finalShift / 12;
                } else {
                  if (up) {
                    if (note.pitch.alter === 0 || !note.pitch.alter) {
                      note.pitch.alter = 1;
                    } else if (note.pitch.alter === -1) {
                      note.pitch.alter = 0;
                    } else if (note.pitch.alter === 1) {
                      note.pitch.alter = 0;
                      note.pitch.octave += 1;
                    }
                  } else {
                    if (note.pitch.alter === 0 || !note.pitch.alter) {
                      note.pitch.alter = -1;
                    } else if (note.pitch.alter === 1) {
                      note.pitch.alter = 0;
                    } else if (note.pitch.alter === -1) {
                      note.pitch.alter = 0;
                      note.pitch.octave -= 1;
                    }
                  }
                }
                notesCount++;
              }
            }
          }
        }
      }
    }
    return `[Mock Mode] Transposed ${notesCount} note(s) ${up ? 'up' : 'down'} (shift amount: ${semitones} semitones).`;
  }

  if (lowercasePrompt.includes('ending') || lowercasePrompt.includes('whole note')) {
    if (mnx.parts && mnx.parts[0]) {
      const part = mnx.parts[0];
      const lastMeasure = part.measures[part.measures.length - 1];
      if (lastMeasure.sequences && lastMeasure.sequences[0]) {
        lastMeasure.sequences[0].content = [
          {
            duration: { base: 'whole' },
            notes: [{ id: 'n-end-e3', pitch: { step: 'E', octave: 3 } }]
          }
        ];
      }
    }
    return '[Mock Mode] Set final measure to a whole note E3 ending.';
  }

  if (lowercasePrompt.includes('double') || lowercasePrompt.includes('add octave')) {
    if (mnx.parts && mnx.parts[0]) {
      const part = mnx.parts[0];
      const measuresLength = part.measures.length;
      if (measuresLength === 8) {
        const extraMeasures = JSON.parse(JSON.stringify(part.measures));
        for (const m of extraMeasures) {
          if (m.sequences) {
            for (const seq of m.sequences) {
              for (const ev of seq.content) {
                if (ev.notes) {
                  for (const n of ev.notes) {
                    n.pitch.octave += 1;
                    n.id = n.id + '-oct2';
                  }
                }
              }
            }
          }
        }
        part.measures = [...part.measures, ...extraMeasures];
        mnx.global.measures = [
          ...mnx.global.measures,
          ...JSON.parse(JSON.stringify(mnx.global.measures))
        ];
      }
    }
    return '[Mock Mode] Appended a higher octave, doubling the scale length.';
  }

  return `[Mock Mode] Simulated instruction: "${prompt}" completed successfully.`;
}
