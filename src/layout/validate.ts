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
  /**
   * `error` — the document says something impossible; the user should fix it.
   * `warning` — legal, quite possibly intentional, but ambiguous enough that
   * consumers disagree about how to render it. Defaults to `error`.
   */
  severity?: 'error' | 'warning';
  /**
   * `tab` — only meaningful on a tablature staff (a fingerboard constraint,
   * not a musical one). The notation renderer drops these: the bar engraves
   * perfectly there, so a badge would be noise.
   */
  scope?: 'tab';
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

  validateTabPositions(part, issues);
  return issues;
}

/** One note's claim on the fingerboard at a given moment. */
interface PositionClaim {
  fret: number;
  voiceIndex: number;
}

/**
 * Fingerboard conflicts: two notes claiming the same string at the same instant.
 * A string is one physical object, so it can sound one pitch at a time — a
 * constraint of the instrument, not of the music, which is why these are
 * `scope: 'tab'` and invisible to the notation renderer.
 *
 * Two very different situations, deliberately given different severities:
 *
 *   - Different frets on one string  → unplayable however it is rendered.
 *   - The SAME fret, from two voices → one note written twice. Standard
 *     fingerstyle engraving (a note shared between a bass line and the melody),
 *     so NOT an error — but tab has no way to show it, and consumers disagree:
 *     Guitar Pro re-frets the duplicate somewhere else (inventing a note nobody
 *     plays), TuxGuitar and this renderer draw them on top of each other.
 *
 * Silent for documents without `_x.mnxLab.tab.position` — there is nothing to conflict.
 */
function validateTabPositions(
  part: NonNullable<MnxStructure['parts']>[number],
  issues: ValidationIssue[]
): void {
  part.measures.forEach((partMeasure, measureIndex) => {
    // onset (whole-note fraction) → string number → claims
    const claims = new Map<number, Map<number, PositionClaim[]>>();

    (partMeasure.sequences ?? []).forEach((seq, voiceIndex) => {
      let onset = 0;
      for (const item of seq.content ?? []) {
        // Un-timed containers make every later onset in this voice unknowable;
        // stop rather than report conflicts against invented times.
        if (!isTimedEvent(item)) return;

        for (const note of item.notes ?? []) {
          const position = note._x?.mnxLab?.tab?.position;
          if (!position) continue;
          const key = Math.round(onset * 1e6) / 1e6;
          const byString = claims.get(key) ?? new Map<number, PositionClaim[]>();
          const list = byString.get(position.string) ?? [];
          list.push({ fret: position.fret, voiceIndex });
          byString.set(position.string, list);
          claims.set(key, byString);
        }
        onset += durationValue(item.duration);
      }
    });

    for (const byString of claims.values()) {
      for (const [stringNumber, list] of byString) {
        if (list.length < 2) continue;

        const frets = [...new Set(list.map(c => c.fret))];
        if (frets.length > 1) {
          issues.push({
            measureIndex,
            severity: 'error',
            scope: 'tab',
            message:
              `string ${stringNumber} is fretted at ${frets.sort((a, b) => a - b).join(' and ')} ` +
              `at the same time — a string can only sound one pitch`
          });
          continue;
        }

        // Same fret: one note, written in more than one voice.
        const voices = [...new Set(list.map(c => c.voiceIndex))];
        if (voices.length < 2) continue; // a true duplicate within one voice
        issues.push({
          measureIndex,
          severity: 'warning',
          scope: 'tab',
          message:
            `string ${stringNumber} fret ${frets[0]} is written in ` +
            `voices ${voices.map(v => v + 1).join(' and ')} at the same time — ` +
            `it is played once, but tab renderers disagree (Guitar Pro re-frets ` +
            `the duplicate elsewhere)`
        });
      }
    }
  });
}
