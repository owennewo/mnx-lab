/**
 * A storage loss in a musician's words (the owner, 2026-11-08: "surely the
 * message should explain what is stopping the save"). The storage check
 * (`storageCheckCore.ts`) reports each loss as a document path and the JSON
 * that was there — `parts/0/measures/14/sequences/1/content/-1` and
 * `{"type":"tuplet",…}` — which says exactly what went, to a program. This
 * says it to a person: **Bar 15, voice 2 — a triplet (3:2), dropped.**
 *
 * DOM-free and converter-free, so the shell imports it on the main thread and
 * the harness tests it. The document, when given, names voices and parts as the
 * score does; without it the path's own indices are used.
 */
import type { MnxStructure } from '../model/mnx.ts';
import type { StorageLoss } from './storageCheckCore.ts';

export interface LossWords {
  /** Where: `Bar 15, voice 2`, `Part “Guitar”`, `The score`. */
  where: string;
  /** What: `a triplet (3:2)`, `a chord`, `lyrics`, `the fingering`. */
  what: string;
  /** `dropped` or `changed`. */
  how: string;
}

const FIELD_WORDS: Record<string, string> = {
  lyrics: 'lyrics', fingering: 'the fingering', string: 'the string choice', fret: 'the fret',
  technique: 'a technique', tab: 'tab settings', markings: 'a marking', ties: 'a tie', slurs: 'a slur',
  beams: 'beaming', clefs: 'a clef', dynamics: 'a dynamic', tempos: 'a tempo', harmonies: 'a chord symbol',
  accidentalDisplay: 'how an accidental is shown', capo: 'the capo', strings: 'the tuning', name: 'the name',
  transposition: 'the transposition', work: 'the piece’s details', encoding: 'the file’s details'
};

/** What the `was` JSON held — read by pattern, since it may be cut short. */
function thingOf(was: string, path: readonly string[]): string {
  const tuplet = /"type":"tuplet"/.test(was);
  if (tuplet) {
    const inner = /"inner":\{[^}]*?"multiple":(\d+)/.exec(was)?.[1] ?? /"multiple":(\d+)/.exec(was)?.[1];
    const outer = /"outer":\{[^}]*?"multiple":(\d+)/.exec(was)?.[1];
    if (inner === '3' && (outer === '2' || outer === undefined)) return 'a triplet (3:2)';
    return inner && outer ? `a ${inner}:${outer} tuplet` : 'a tuplet';
  }
  if (/"type":"grace"/.test(was)) return 'grace notes';
  if (/"type":"tremolo"/.test(was)) return 'a tremolo';
  if (/"type":"space"/.test(was)) return 'a space';
  if (/"rest":/.test(was) && !/"notes":/.test(was)) return 'a rest';
  if (/"notes":\[/.test(was)) return (was.match(/"pitch":/g)?.length ?? 0) > 1 ? 'a chord' : 'a note';
  // A field: the last named segment of the path, in words where we have them.
  const named = [...path].reverse().find(segment => !/^-?\d+$/.test(segment) && segment !== '_x' && segment !== 'mnxLab');
  if (named === 'notes') return 'a note';
  if (named === 'content') return 'an event';
  return named ? FIELD_WORDS[named] ?? named.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() : 'something';
}

export function describeLoss(loss: StorageLoss, doc?: MnxStructure | null): LossWords {
  const path = loss.path.split('/');
  const index = (key: string) => {
    const at = path.indexOf(key);
    const value = at >= 0 ? Number(path[at + 1]) : NaN;
    return Number.isInteger(value) && value >= 0 ? value : null;
  };
  const part = index('parts'), measure = index('measures'), sequence = index('sequences');
  const where: string[] = [];
  if (part !== null && (doc?.parts?.length ?? 1) > 1) {
    const name = doc?.parts?.[part]?.name;
    where.push(name ? `Part “${name}”` : `Part ${part + 1}`);
  }
  if (measure !== null) where.push(`bar ${measure + 1}`);
  else if (index('measures') === null && path.includes('measures')) where.push('a bar');
  if (sequence !== null && measure !== null) {
    // Voices are counted on their staff, as the editor numbers them.
    const sequences = doc?.parts?.[part ?? 0]?.measures?.[measure]?.sequences;
    const staff = sequences?.[sequence]?.staff ?? 1;
    const voice = sequences ? sequences.slice(0, sequence + 1).filter(s => (s.staff ?? 1) === staff).length : sequence + 1;
    where.push(`voice ${voice}`);
  }
  const place = where.length ? where.join(', ') : part !== null ? 'The part' : 'The score';
  return {
    where: place.charAt(0).toUpperCase() + place.slice(1),
    what: thingOf(loss.was, path),
    how: loss.kind === 'changed' ? 'changed' : 'dropped'
  };
}
