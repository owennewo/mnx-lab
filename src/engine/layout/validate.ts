import { MnxStructure, MnxPitch, isGrace, isTremolo, isTuplet, isTimedEvent } from '../../model/mnx.ts';
import { durationValue, tremoloDuration, tupletDuration } from './spacing.ts';
import { MAX_FRET, midiOfMnxPitch, tabPositionContext, PartTabSetups } from '../tab/guitarPositions.ts';

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
  /**
   * When the issue is attributable to ONE event, its address within the
   * measure — layouts that know the event's column draw the badge under that
   * column instead of stacking it in the bar corner.
   */
  at?: { voiceIndex: number; eventIndex: number };
}

const EPSILON = 1e-6;

/** Trims float noise for display: 3.5 → "3.5", 4 → "4". */
function fmtBeats(beats: number): string {
  return String(Math.round(beats * 1000) / 1000);
}

/**
 * `tabSetup` is the viewer's instrument override, when one is in effect: the
 * fingerboard checks must judge against the SAME strings the layout derived
 * with, or a note the override cannot reach would vanish from the tab staff
 * with no badge explaining why. Document-level checks (bar arithmetic) are
 * unaffected.
 */
export function validateDocument(mnx: MnxStructure, tabSetup?: PartTabSetups): ValidationIssue[] {
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

  validateTabPositions(part, issues, tabSetup);
  return issues;
}

/** One note's claim on the fingerboard at a given moment. */
interface PositionClaim {
  fret: number;
  voiceIndex: number;
}

/** "C#4" / "Bb2" — display form of an MNX pitch for diagnostics. */
function fmtPitch(pitch: MnxPitch): string {
  const alter = pitch.alter ?? 0;
  const accidental = alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter);
  return `${pitch.step}${accidental}${pitch.octave}`;
}

/** "E2–D6" — the reachable sounding range, MIDI → spelled without alteration bias. */
function fmtRange(lowMidi: number, highMidi: number): string {
  const name = (midi: number): string => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  };
  return `${name(lowMidi)}–${name(highMidi)}`;
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
 * Since v5 the string is authoritative and the fret is DERIVED (string + pitch
 * + tuning + capo — roadmap/complete/core-derived-positions.md), so this pass also
 * checks the derivation itself:
 *
 *   - an annotated string the part never declared     → error
 *   - a derived fret outside [0, MAX_FRET]            → error (the layout
 *     draws nothing for that note; this badge is its only trace)
 *   - a stored fret disagreeing with the derived one  → error (the stored
 *     fret's whole v5 job is this tripwire — it typically means a broken
 *     importer, and the derived fret is what renders)
 *   - on a declared tab part, a bare note no string can reach → error
 *
 * Conflict claims use the DERIVED fret. Silent for documents with no tab
 * declaration and no `_x.mnxLab.string` — there is nothing to check.
 */
function validateTabPositions(
  part: NonNullable<MnxStructure['parts']>[number],
  issues: ValidationIssue[],
  tabSetup?: PartTabSetups
): void {
  const lab = part._x?.mnxLab;
  const ctx = tabPositionContext(part, tabSetup);
  if (!ctx) {
    // No declared strings: no fingerboard exists, so there is nothing to
    // derive or conflict — but a document that ASKS for a tab view without
    // declaring an instrument is a user-fixable inconsistency.
    const kind = lab?.tab?.staffKind;
    if (kind === 'tab' || kind === 'both') {
      issues.push({
        measureIndex: 0,
        severity: 'error',
        scope: 'tab',
        message:
          'the part asks for a tab view (staffKind) but declares no strings — ' +
          'add _x.mnxLab.strings, or supply an instrument from the viewer'
      });
    }
    return;
  }
  const opens = [...ctx.openMidi.values()];
  const lowestReach = Math.min(...opens);
  const highestReach = Math.max(...opens) + MAX_FRET;

  const error = (
    measureIndex: number,
    message: string,
    at?: { voiceIndex: number; eventIndex: number }
  ) => issues.push({ measureIndex, severity: 'error', scope: 'tab', message, ...(at ? { at } : {}) });

  part.measures.forEach((partMeasure, measureIndex) => {
    // onset (whole-note fraction) → string number → claims
    const claims = new Map<number, Map<number, PositionClaim[]>>();

    (partMeasure.sequences ?? []).forEach((seq, voiceIndex) => {
      let onset = 0;
      for (const [eventIndex, item] of (seq.content ?? []).entries()) {
        // Un-timed containers make every later onset in this voice unknowable;
        // stop rather than report conflicts against invented times.
        if (!isTimedEvent(item)) return;
        const at = { voiceIndex, eventIndex };

        for (const note of item.notes ?? []) {
          const x = note._x?.mnxLab;
          if (x?.string === undefined) {
            // Bare note: strings are declared (ctx exists), so flag a pitch
            // no string can reach — the assignment is presentation, but an
            // unreachable pitch is a content problem the user should see.
            const midi = midiOfMnxPitch(note.pitch);
            if (midi < lowestReach || midi > highestReach) {
              error(
                measureIndex,
                `${fmtPitch(note.pitch)} is not playable on the declared strings` +
                  ` (reachable range ${fmtRange(lowestReach, highestReach)})`,
                at
              );
            }
            continue;
          }

          const open = ctx.openMidi.get(x.string);
          if (open === undefined) {
            error(
              measureIndex,
              `string ${x.string} is not declared in the part's strings`,
              at
            );
            continue;
          }
          const derived = midiOfMnxPitch(note.pitch) - open;
          if (derived < 0 || derived > MAX_FRET) {
            error(
              measureIndex,
              `${fmtPitch(note.pitch)} is not playable on string ${x.string}` +
                ` (derived fret ${derived} is outside 0–${MAX_FRET})`,
              at
            );
            continue;
          }
          if (x.fret !== undefined && x.fret !== derived) {
            error(
              measureIndex,
              `stored fret ${x.fret} disagrees with the derived fret ${derived}` +
                ` on string ${x.string} — the pitch, the tuning or the` +
                ` annotation is wrong (the derived fret is rendered)`,
              at
            );
          }

          const key = Math.round(onset * 1e6) / 1e6;
          const byString = claims.get(key) ?? new Map<number, PositionClaim[]>();
          const list = byString.get(x.string) ?? [];
          list.push({ fret: derived, voiceIndex });
          byString.set(x.string, list);
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
