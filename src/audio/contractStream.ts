/**
 * The compiled performance as an mnx-sound/2 stream for the synth's instrument host
 * (roadmap/inprogress/core-campaign-synth.md, Phase 4). Pure: no DOM, importable from Node.
 *
 * The performance is already the player's intermediate form — sounding events per voice
 * with velocity, bend and vibrato curves, legato and timbre — and the transport plays it
 * through a sink that only knows attacks, releases and bends. The synth takes intent
 * instead, so this maps each sounding event to a contract note:
 *
 *  - times in seconds through the performance's tempo map (rate is the backend's);
 *  - velocity 0–127 → 0–1; the voice's string → the note's fingering;
 *  - bend curves → one `bend` (their sum, exact at every breakpoint); a vibrato that runs
 *    to the note's end → `vibrato` (no fade, phase-aligned to its start); anything else —
 *    a vibrato that stops early, several vibratos — is sampled into the bend;
 *  - `noReattack` → `legato` from the voice's previous event (hammer up, pull down);
 *  - palm mutes, dead notes and harmonics → `mute` and `harmonic`, UNDOING the compiler's
 *    lowering of them (shorter, quieter notes, see expression.ts) when the written note's
 *    technique can be read from the document; without the document the lowered note
 *    plays as compiled, with no technique (the synth would lower it a second time);
 *  - kit voices → kit pieces (General MIDI numbers, `pieceFromGm`);
 *  - tempo changes → session-wide `tempo` controls, so tempo-synced effects follow.
 */
import type { Control, Note, Technique } from '@mnx-lab/synth/contract';
import { pieceFromGm } from '@mnx-lab/synth/contract';
import type { MnxStructure, MnxTabTechnique } from '../model/mnx.ts';
import { forEachNoteAddress } from '../model/noteWalk.ts';
import type { Performance, SoundingEvent } from './performanceTypes.ts';
import { centsAt } from './transport.ts';
import { add, compare, createTempoMap, rational, type Rational } from './time.ts';

export interface StreamOptions {
  /** The contract part a voice plays on; a voice with none is left out. Default: `part<partIndex>`. */
  partOf?: (voice: Performance['voices'][number]) => string | undefined;
  /** The document the performance was compiled from: lets palm mutes, dead notes and
   *  harmonics travel as techniques rather than as the compiler's lowered notes. */
  document?: MnxStructure;
}
export interface ContractStream {
  notes: Note[];
  controls: Control[];
  /** Seconds from the start to the end of the last event. */
  seconds: number;
  /** Seconds at a performance position (the backend's clock origin). */
  secondsAt: (position: Rational) => number;
  /** Pitch curves that had to be sampled into a bend, by event id (no vibrato technique fitted). */
  sampledCurves: string[];
}

/** Contract bend points per note (validate.js: 1–256). */
const MAX_BEND_POINTS = 256;
const SAMPLES_PER_PERIOD = 16;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const endOf = (e: { position: Rational; duration: Rational }) => add(e.position, e.duration);
const voiceKey = (voice: string, p: Rational) => `${voice} ${p.num}/${p.den}`;

/** The written technique for each written-occurrence id, read off the document. */
function techniques(performance: Performance, document?: MnxStructure): Map<string, MnxTabTechnique> {
  const byKey = new Map<string, MnxTabTechnique>();
  if (!document) return byKey;
  forEachNoteAddress(document, address => {
    const note = address.event.notes?.[address.noteIndex];
    const technique = note?._x?.mnxLab?.tab?.technique;
    if (technique) byKey.set(address.key, technique);
  });
  const byWritten = new Map<string, MnxTabTechnique>();
  for (const w of performance.written) {
    const technique = byKey.get(w.noteKey);
    if (technique) byWritten.set(w.id, technique);
  }
  return byWritten;
}

export function performanceToStream(performance: Performance, options: StreamOptions = {}): ContractStream {
  const tempo = createTempoMap(performance.tempo);
  const secondsAt = (p: Rational) => tempo.secondsAt(p);
  const voices = new Map(performance.voices.map(v => [v.id, v]));
  const partOf = options.partOf ?? (v => `part${v.partIndex}`);
  const written = techniques(performance, options.document);
  // The event that ends where a legato continuation starts, on the same voice.
  const endingAt = new Map(performance.sounding.map(e => [voiceKey(e.voice, endOf(e)), e]));
  const notes: Note[] = [], sampledCurves: string[] = [];
  let seconds = 0;
  for (const e of performance.sounding) {
    const voice = voices.get(e.voice);
    const part = voice && partOf(voice);
    if (!voice || part === undefined) continue;
    const at = secondsAt(e.position), end = secondsAt(endOf(e));
    let duration = end - at, velocity = e.velocity;
    const techniqueList: Technique[] = [];
    const tech = e.writtenIds.map(id => written.get(id)).find(Boolean);
    // Undo the compiler's lowering where the intent is known (expression.ts: dead ×1/8 −20,
    // palm ×3/5 −15, harmonic −10); the synth renders the technique itself.
    if (e.damped && tech?.dead) { duration *= 8; velocity += 20; techniqueList.push({ type: 'mute', kind: 'dead' }); }
    else if (e.damped && tech?.palmMute) { duration *= 5 / 3; velocity += 15; techniqueList.push({ type: 'mute', kind: 'palm', amount: 0.6 }); }
    if (e.timbre?.includes('harmonic') && tech?.harmonic) {
      velocity += 10;
      const kind = tech.harmonic.type;
      techniqueList.push({ type: 'harmonic', kind: kind === 'artificial' || kind === 'pinch' || kind === 'tap' || kind === 'semi' || kind === 'feedback' ? kind : 'natural' });
    }
    techniqueList.push(...pitchTechniques(e, at, end - at, secondsAt, sampledCurves));
    if (e.noReattack) {
      const previous = endingAt.get(voiceKey(e.voice, e.position));
      if (previous && compare(previous.position, e.position) < 0)
        techniqueList.push({ type: 'legato', from: previous.id, via: e.midi < previous.midi ? 'pull' : 'hammer' });
    }
    const piece = voice.kit ? pieceFromGm(e.midi) : null;
    const note: Note = {
      id: e.id, part, at, duration: Math.max(duration, 1e-4), velocity: clamp01(velocity / 127),
      target: voice.kit ? { piece: piece ?? `gm-${e.midi}` } : { pitch: e.midi },
      ...(voice.string !== undefined && !voice.kit ? { fingering: { string: voice.string } } : {}),
      ...(techniqueList.length ? { techniques: techniqueList } : {}),
    };
    notes.push(note);
    seconds = Math.max(seconds, at + note.duration);
  }
  const controls: Control[] = performance.tempo.map((t, i) => ({
    id: `tempo-${i}`, at: secondsAt(t.position), type: 'tempo', bpm: Number(t.quarterBpm.num) / Number(t.quarterBpm.den),
  }));
  return { notes, controls, seconds, secondsAt, sampledCurves };
}

/** Bend and vibrato for one event, in note-relative fractions and seconds. */
function pitchTechniques(e: SoundingEvent, at: number, seconds: number, secondsAt: (p: Rational) => number, sampled: string[]): Technique[] {
  if (!e.curve.length || seconds <= 0) return [];
  const fraction = (offset: Rational) => clamp01((secondsAt(add(e.position, offset)) - at) / seconds);
  const bends = e.curve.filter(c => c.kind === 'bend');
  const vibratos = e.curve.filter(c => c.kind === 'vibrato');
  const out: Technique[] = [];
  // One vibrato running to the note's end is the contract's vibrato exactly.
  const fits = vibratos.length === 1 && compare(add(vibratos[0]!.offset, vibratos[0]!.duration), e.duration) >= 0;
  if (fits) {
    const v = vibratos[0]!;
    const onset = secondsAt(add(e.position, v.offset)) - at;
    const rateHz = 1 / (secondsAt(add(e.position, add(v.offset, v.period))) - secondsAt(add(e.position, v.offset)));
    out.push({ type: 'vibrato', depthCents: v.depthCents, rateHz, start: clamp01(onset / seconds), fadeSeconds: 0, phase: -2 * Math.PI * rateHz * onset });
  }
  if (!bends.length && (fits || !vibratos.length)) return out;
  // The bends' sum is piecewise linear on the union of their breakpoints: exact there.
  const offsets: Rational[] = [rational(0n), e.duration, ...bends.flatMap(b => b.points.map(p => p.offset))];
  if (!fits) {
    sampled.push(e.id);
    for (const v of vibratos) {
      const step = rational(v.period.num, v.period.den * BigInt(SAMPLES_PER_PERIOD));
      const stop = compare(add(v.offset, v.duration), e.duration) < 0 ? add(v.offset, v.duration) : e.duration;
      for (let p = v.offset; compare(p, stop) < 0; p = add(p, step)) offsets.push(p);
      offsets.push(stop);
    }
  }
  const unique = offsets.filter(p => compare(p, rational(0n)) >= 0 && compare(p, e.duration) <= 0).sort(compare)
    .filter((p, i, all) => i === 0 || compare(p, all[i - 1]!) !== 0);
  // Keep the first and last, thin the middle evenly to the contract's cap.
  const kept = unique.length <= MAX_BEND_POINTS ? unique
    : Array.from({ length: MAX_BEND_POINTS }, (_, i) => unique[Math.round((i * (unique.length - 1)) / (MAX_BEND_POINTS - 1))]!);
  // The vibrato, when it is its own technique, is not part of the bend.
  const bendOnly: SoundingEvent = fits ? { ...e, curve: bends } : e;
  // Offsets are sorted and seconds rise with position, so the fractions are already in order.
  out.push({ type: 'bend', points: kept.map(p => ({ at: fraction(p), cents: centsAt(bendOnly, p) })) });
  return out;
}

/** The performance's clock both ways (the tempo map the stream is timed by). */
export function streamClock(performance: Performance) {
  const tempo = createTempoMap(performance.tempo);
  return { secondsAt: (p: Rational) => tempo.secondsAt(p), positionAt: (s: number) => tempo.positionAt(s) };
}
