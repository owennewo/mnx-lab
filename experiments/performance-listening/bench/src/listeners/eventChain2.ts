/** event-chain@2: three-window live commitment, unchanged two-window offline tokens.
 * 027 changes only the causal confirmation policy; @1 remains frozen. */
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { scorePositionAt } from '../../../../../src/audio/scorePosition.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import type { Delivery, Emission, Handoff, Listener, ScorePosition } from '../../../listen/contract.ts';
import { samePosition, topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import type { AssessmentReport2 } from '../events/assessment2.ts';

import { alignPitches, sinePitch } from './eventChain1.ts';
export const EVENT_CHAIN_2 = 'event-chain@2';
type Event = { at: ScorePosition; quarter: number; midi: number; key: string };
type Token = { midi: number; onset: number; end: number };

export class EventChain2 implements Listener {
  private events: Event[] = [];
  private tokens: Token[] = [];
  private sampleRate = 48000;
  private buffer = new Float32Array(960);
  private buffered = 0;
  private clock = 0;
  private serial = 0;
  private pendingMidi: number | null = null;
  private agreeing = 0;
  private pendingAt = 0;
  private lastMidi: number | null = null;
  private lastLiveMidi: number | null = null;
  private costs: number[] = [];
  private acquired = false;
  private lastSupported = 0;
  private shown: number | 'unsupported' | null = null;
  private report: AssessmentReport2 | null = null;

  start(score: MnxStructure, handoff: Handoff, delivery: Delivery) {
    if (delivery.sampleRate !== 48000 || delivery.chunkSamples !== 480) return { ok: false as const, refused: 'event-chain@2 requires 48 kHz / 480' };
    const compiled = compilePerformance(score);
    if (!compiled.ok || compiled.performance.diagnostics.length) return { ok: false as const, refused: 'Score does not compile cleanly' };
    const p = compiled.performance;
    if (!samePosition(handoff.from, topOfScore(p)) || [...handoff.parts].sort().join('|') !== partIds(score).sort().join('|')) {
      return { ok: false as const, refused: 'event-chain@2 supports the top and all parts only' };
    }
    const groups = new Map<number, typeof p.sounding>();
    for (const note of p.sounding) {
      const q = 4 * Number(note.position.num) / Number(note.position.den);
      const g = groups.get(q) ?? []; g.push(note); groups.set(q, g);
    }
    if (!groups.size || [...groups.values()].some(g => g.length !== 1) || JSON.stringify(score).includes('"dead":true')) return { ok: false as const, refused: 'event-chain@2 supports pitched monophonic scores only' };
    const events: Event[] = [...groups.entries()].sort((a,b) => a[0]-b[0]).map(([quarter,g]) => {
      const n = g[0]!, at = scorePositionAt(p, n.position), written = p.written.find(w => n.writtenIds.includes(w.id));
      if (!at.ok || !written) throw new Error('Compiled note has no score address');
      return { at: at.value, quarter, midi: n.midi, key: written.noteKey };
    });
    if (events.some((e,i) => i > 0 && events[i-1]!.midi === e.midi)) return { ok: false as const, refused: 'event-chain@2 cannot distinguish identical adjacent pitches' };
    this.events = events; this.tokens = []; this.sampleRate = delivery.sampleRate;
    this.buffer = new Float32Array(960); this.buffered = 0; this.clock = 0; this.serial = 0;
    this.pendingMidi = null; this.agreeing = 0; this.pendingAt = 0; this.lastMidi = null; this.lastLiveMidi = null;
    this.costs = events.map(() => Infinity); this.acquired = false; this.lastSupported = 0; this.shown = null; this.report = null;
    return { ok: true as const };
  }

  feed(chunk: Float32Array, clock: number): Emission[] {
    this.clock = clock;
    this.buffer.copyWithin(0, chunk.length); this.buffer.set(chunk, this.buffer.length - chunk.length);
    this.buffered += chunk.length;
    let silent = true;
    if (this.buffered >= this.buffer.length) {
      const pitch = sinePitch(this.buffer, this.sampleRate); silent = pitch.silent;
      if (pitch.midi === null) { this.pendingMidi = null; this.agreeing = 0; }
      else {
        if (pitch.midi !== this.pendingMidi) { this.pendingMidi = pitch.midi; this.agreeing = 1; this.pendingAt = clock; }
        else this.agreeing++;
        if (this.agreeing >= 2 && pitch.midi !== this.lastMidi) {
          const onset = Math.max(0, this.pendingAt - 0.02);
          if (this.tokens.length) this.tokens.at(-1)!.end = onset;
          this.tokens.push({ midi: pitch.midi, onset, end: clock }); this.lastMidi = pitch.midi;
        }
        // Offline tokens retain two-window confirmation. Only live state waits another hop.
        if (this.agreeing >= 3 && pitch.midi !== this.lastLiveMidi) {
          this.lastLiveMidi = pitch.midi;
          const next = this.events.map((e,k) => {
            if (e.midi !== pitch.midi) return Infinity;
            if (!this.acquired) return k <= 2 ? k * 1.5 : Infinity;
            const choices = [this.costs[k]!];
            for (let back = 1; back <= 3 && k >= back; back++) choices.push(this.costs[k-back]! + (back === 1 ? 0.1 : 0.1 + (back-1)*1.5));
            return Math.min(...choices);
          });
          if (next.some(Number.isFinite)) { this.costs = next; this.acquired = true; }
        }
        if (this.agreeing >= 2 && this.events.some((e,k) => e.midi === pitch.midi && Number.isFinite(this.costs[k]))) this.lastSupported = clock;
      }
    }
    let target: number | 'unsupported' = 'unsupported';
    if (this.acquired && (silent || clock - this.lastSupported < 0.1)) {
      target = this.costs.indexOf(Math.min(...this.costs));
    }
    if (target === this.shown) return [];
    this.shown = target;
    return target === 'unsupported' ? [{ id: `live-${this.serial++}`, kind: 'unsupported', refersTo: clock }]
      : [{ id: `live-${this.serial++}`, kind: 'position', refersTo: clock, candidates: [{ at: this.events[target]!.at, weight: 1 }], confidence: 1 }];
  }

  finish(): Emission[] {
    if (this.tokens.length) this.tokens.at(-1)!.end = this.clock;
    const matches = alignPitches(this.events.map(e => e.midi), this.tokens.map(t => t.midi));
    const sounded = [...matches.keys()].sort((a,b) => a-b);
    const intervals = sounded.slice(1).map((to,k) => {
      const from = sounded[k]!, seconds = this.tokens[matches.get(to)!]!.onset - this.tokens[matches.get(from)!]!.onset;
      return { from, to, seconds, quarters: this.events[to]!.quarter - this.events[from]!.quarter };
    });
    const overall = intervals.length ? 60 * intervals.reduce((s,i) => s+i.quarters,0) / intervals.reduce((s,i) => s+i.seconds,0) : null;
    const sorted = intervals.map(i => ({ tempo: 60*i.quarters/i.seconds, weight: i.quarters })).sort((a,b) => a.tempo-b.tempo);
    const half = sorted.reduce((s,i) => s+i.weight,0)/2; let total = 0, typical: number | null = null;
    for (let k=0;k<sorted.length;k++) { total += sorted[k]!.weight;
      if (Math.abs(total-half) <= 1e-9) { typical = (sorted[k]!.tempo + sorted[k+1]!.tempo)/2; break; }
      if (total > half) { typical=sorted[k]!.tempo; break; }
    }
    const flags: AssessmentReport2['tempo']['flags'] = [];
    for (const ordinal of new Set(this.events.map(e => e.at.ordinal))) {
      const bar = intervals.filter(i => this.events[i.to]!.at.ordinal === ordinal);
      if (!bar.length || typical === null) continue;
      const tempo = 60*bar.reduce((s,i) => s+i.quarters,0)/bar.reduce((s,i) => s+i.seconds,0), ratio=tempo/typical;
      if (ratio <= 0.9 || ratio >= 1.1) flags.push({ ordinal, direction: ratio <= 0.9 ? 'slow' : 'fast' });
    }
    const emitted: Emission[] = this.events.map((e,k) => {
      const token = matches.has(k) ? this.tokens[matches.get(k)!]! : null;
      return { id: `note-${this.serial++}`, kind: 'note', refersTo: token?.onset ?? this.clock, verdict: token ? 'match' : 'missing',
        at: e.at, noteKey: e.key, observed: token ? { onset: token.onset, end: token.end, midi: token.midi, string: null } : null,
        timingErrorSeconds: null, durationErrorSeconds: null, confidence: 1 };
    });
    this.report = { format: 'assessment-report@2', tempo: { overall, intervals: intervals.map(i => ({ from: this.events[i.from]!.at, to: this.events[i.to]!.at, seconds:i.seconds })), flags },
      notes: emitted.map(e => ({ ...e, madeAt: this.clock })) };
    return emitted;
  }
  assessment(): AssessmentReport2 { if (!this.report) throw new Error('Finish before assessment'); return structuredClone(this.report); }
}
