import { MnxStructure, isGrace, isTremolo, isTuplet, isTimedEvent } from '../types/mnx.ts';
import { durationValue, tremoloDuration, tupletDuration } from './spacing.ts';

/**
 * Semantic (musical) validation — problems the schema can't see but the user
 * can and should fix, e.g. a bar whose note durations don't add up to the time
 * signature. Runs as a pure pass over the document; both layout engines merge
 * the result into their per-measure diagnostic markers (styled differently
 * from renderer-gap diagnostics) and into `LayoutResult.diagnostics`.
 */

export interface ValidationIssue {
  measureIndex: number;
  message: string;
}

const EPSILON = 1e-6;

/** Trims float noise for display: 3.5 → "3.5", 4 → "4". */
function fmtBeats(beats: number): string {
  return String(Math.round(beats * 1000) / 1000);
}

export function validateDocument(mnx: MnxStructure): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const part = mnx.parts?.[0];
  if (!part) return issues;

  let time = { count: 4, unit: 4 };
  part.measures.forEach((partMeasure, i) => {
    const globalTime = mnx.global?.measures?.[i]?.time;
    if (globalTime) time = globalTime;
    const target = time.count / time.unit; // bar length as a whole-note fraction

    const voices = partMeasure.sequences ?? [];
    voices.forEach((seq, voiceIndex) => {
      const content = seq.content ?? [];
      if (content.length === 0) return;
      // Engraving convention: a voice holding a single rest is a full-measure
      // rest, valid in any meter regardless of its written duration.
      if (content.length === 1 && isTimedEvent(content[0]) && content[0].rest) return;

      let sum = 0;
      for (const item of content) {
        if (isGrace(item)) continue; // un-timed by definition
        if (isTremolo(item)) {
          sum += tremoloDuration(item);
          continue;
        }
        if (isTuplet(item)) {
          sum += tupletDuration(item);
          continue;
        }
        // An item the model can't time (tuplet, …) makes the bar's
        // arithmetic unknowable — don't raise a false alarm.
        if (!isTimedEvent(item)) return;
        sum += durationValue(item.duration);
      }
      if (Math.abs(sum - target) < EPSILON) return;

      const voice = voices.length > 1 ? `voice ${voiceIndex + 1} ` : '';
      const relation = sum < target ? 'underfills' : 'overfills';
      issues.push({
        measureIndex: i,
        message:
          `${voice}${relation} the ${time.count}/${time.unit} bar: ` +
          `notes sum to ${fmtBeats(sum * time.unit)} of ${time.count} beats`
      });
    });
  });
  return issues;
}
