// SMF type 1; musical time stays exact until quantizeTick. See docs/player-performance.md.
import { add, subtract, multiply, divide, compare, rational, ZERO, type Rational } from './time.ts';
import type { Performance, SoundingEvent } from './performanceTypes.ts';
export const MIDI_PPQ = 960;
export interface MidiDiagnostic {
  code: string;
  message: string;
  soundingId?: string;
  partIndex?: number;
}
export interface MidiAllocation {
  partIndex: number;
  channels: number[];
  independent: boolean;
}
export type MidiResult =
  | {
      ok: true;
      bytes: Uint8Array;
      diagnostics: MidiDiagnostic[];
      allocation: MidiAllocation[];
    }
  | { ok: false; diagnostics: MidiDiagnostic[] };
export function quantizeTick(time: Rational): number {
  if (time.num < 0n) throw new RangeError('MIDI positions must be nonnegative.');
  const scaled = multiply(time, rational(BigInt(MIDI_PPQ * 4)));
  const tick = (scaled.num * 2n + scaled.den) / (2n * scaled.den);
  if (tick > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError('MIDI position exceeds the safe tick range.');
  return Number(tick);
}
const finish = (s: SoundingEvent) => add(s.position, s.duration);
const vlq = (value: number): number[] => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0x0fffffff)
    throw new RangeError('MIDI delta exceeds the four-byte VLQ limit.');
  const bytes = [value & 127];
  while ((value = Math.floor(value / 128)) > 0) bytes.unshift((value & 127) | 128);
  return bytes;
};
const textBytes = (s: string) => [...new TextEncoder().encode(s)];
const meta = (type: number, data: number[]) => [255, type, ...vlq(data.length), ...data];
const u32 = (n: number) => [
  Math.floor(n / 0x1000000) & 255,
  (n >>> 16) & 255,
  (n >>> 8) & 255,
  n & 255,
];
const chunk = (name: string, data: number[]) => [...textBytes(name), ...u32(data.length), ...data];
interface Event {
  tick: number;
  priority: number;
  data: number[];
  order: number;
}
function track(events: Event[]): number[] {
  events.sort((a, b) => a.tick - b.tick || a.priority - b.priority || a.order - b.order);
  let previous = 0;
  const data: number[] = [];
  for (const e of events) {
    data.push(...vlq(e.tick - previous), ...e.data);
    previous = e.tick;
  }
  data.push(0, 255, 47, 0);
  return chunk('MTrk', data);
}
/** Preflight the whole performance. No partial file on impossible allocation or
 * unrepresentable file-level timing. Channels are zero-based; 9 is percussion. */
export function exportMidi(performance: Performance): MidiResult {
  const diagnostics: MidiDiagnostic[] = [];
  try {
    const voices = new Map(performance.voices.map((v) => [v.id, v]));
    const parts = [
      ...new Set(performance.voices.filter((v) => !v.kit).map((v) => v.partIndex)),
    ].sort((a, b) => a - b);
    if (parts.length > 15)
      return {
        ok: false,
        diagnostics: [
          {
            code: 'channel-allocation',
            message: 'More than 15 melodic parts require channels; no MIDI file produced.',
          },
        ],
      };
    const available = Array.from({ length: 16 }, (_, i) => i).filter((i) => i !== 9);
    const allocations: MidiAllocation[] = parts.map((partIndex) => ({
      partIndex,
      channels: [available.shift()!],
      independent: false,
    }));
    const eventGroup = new Map<string, number>();
    for (const allocation of allocations) {
      const notes = performance.sounding
        .filter(
          (s) =>
            voices.get(s.voice)?.partIndex === allocation.partIndex && !voices.get(s.voice)?.kit,
        )
        .sort(
          (a, b) => compare(a.position, b.position) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        );
      const strings = [
        ...new Set(
          notes.flatMap((s) => (voices.get(s.voice)?.string === undefined ? [] : [s.voice])),
        ),
      ];
      const releases: Rational[] = [];
      for (const s of notes) {
        const string = strings.indexOf(s.voice);
        if (string >= 0) {
          eventGroup.set(s.id, string);
          continue;
        }
        let slot = releases.findIndex((t) => compare(t, s.position) <= 0);
        if (slot < 0) slot = releases.length;
        releases[slot] = finish(s);
        eventGroup.set(s.id, strings.length + slot);
      }
      const count = Math.max(1, strings.length + releases.length),
        extra = count - 1;
      if (extra <= available.length) {
        allocation.channels.push(...available.splice(0, extra));
        allocation.independent = true;
      } else
        diagnostics.push({
          code: 'shared-channel',
          partIndex: allocation.partIndex,
          message:
            'Insufficient channels for full independence: one channel retained, all independent pitch curves omitted.',
        });
    }
    const conductor: Event[] = [];
    let order = 0;
    const push = (out: Event[], tick: number, priority: number, data: number[]) => {
      if (order >= 1_000_000) throw new RangeError('MIDI event budget exceeded.');
      out.push({ tick, priority, data, order: order++ });
    };
    push(
      conductor,
      0,
      0,
      meta(
        1,
        textBytes(
          'MNX Lab bounded MIDI export: written identities and articulation/timbre semantics are not preserved. Curves are quantized, may be clipped or omitted; see export diagnostics.',
        ),
      ),
    );
    for (const t of performance.tempo) {
      const exact = divide(rational(60_000_000n), t.quarterBpm);
      const micros = Number((exact.num * 2n + exact.den) / (exact.den * 2n));
      if (micros < 1 || micros > 0xffffff)
        throw new RangeError('Tempo cannot be represented by a 24-bit MIDI tempo event.');
      push(
        conductor,
        quantizeTick(t.position),
        0,
        meta(81, [(micros >>> 16) & 255, (micros >>> 8) & 255, micros & 255]),
      );
    }
    const tracks = new Map<number, Event[]>();
    const trackFor = (part: number) => {
      let events = tracks.get(part);
      if (!events) {
        events = [];
        tracks.set(part, events);
        push(events, 0, 0, meta(3, textBytes(`Part ${part + 1}`)));
      }
      return events;
    };
    const initialized = new Set<number>();
    for (const s of performance.sounding) {
      const voice = voices.get(s.voice);
      if (!voice) throw new RangeError(`Missing voice declaration: ${s.voice}`);
      const allocation = allocations.find((a) => a.partIndex === voice.partIndex);
      const channel = voice.kit
        ? 9
        : allocation!.channels[allocation!.independent ? (eventGroup.get(s.id) ?? 0) : 0];
      const events = trackFor(voice.partIndex),
        start = quantizeTick(s.position),
        stop = quantizeTick(finish(s));
      if (stop <= start) {
        diagnostics.push({
          code: 'collapsed-note',
          soundingId: s.id,
          message: 'Positive note boundaries collapse after rounding; omitted.',
        });
        continue;
      }
      if (s.midi < 0 || s.midi > 127 || !Number.isFinite(s.midi)) {
        diagnostics.push({
          code: 'pitch-range',
          soundingId: s.id,
          message: 'Pitch outside MIDI 0..127 omitted.',
        });
        continue;
      }
      if (s.velocity <= 0) {
        diagnostics.push({
          code: 'silent-note',
          soundingId: s.id,
          message: 'Zero-velocity sounding event is silent and omitted from MIDI.',
        });
        continue;
      }
      if (s.noReattack || s.timbre?.length || s.damped)
        diagnostics.push({
          code: 'omitted-voice-expression',
          soundingId: s.id,
          message:
            'MIDI retriggers logical legato transitions and omits harmonic/damped timbre hints; numeric pitch, velocity and duration remain.',
        });
      const pitch = Math.round(s.midi),
        fractional = (s.midi - pitch) * 100;
      if (!initialized.has(channel)) {
        initialized.add(channel);
        for (const [cc, value] of [
          [101, 0],
          [100, 0],
          [6, 12],
          [38, 0],
          [101, 127],
          [100, 127],
        ])
          push(events, 0, 0, [176 | channel, cc, value]);
        push(events, 0, 1, [224 | channel, 0, 64]);
      }
      const independent = !voice.kit && allocation!.independent;
      const bend = (tick: number, cents: number) => {
        if (cents < -1200 || cents > 1200)
          diagnostics.push({
            code: 'bend-clipped',
            soundingId: s.id,
            message: 'Pitch curve clipped to the declared ±12-semitone range.',
          });
        const clipped = Math.max(-1200, Math.min(1200, cents));
        const value = Math.max(0, Math.min(16383, Math.round(8192 + (clipped / 1200) * 8192)));
        push(events, tick, 2, [224 | channel, value & 127, (value >> 7) & 127]);
      };
      if (independent) {
        bend(start, fractional);
        const times = new Map<number, Rational>();
        const number = (q: Rational) => Number(q.num) / Number(q.den);
        const remember = (offset: Rational) => {
          const tick = quantizeTick(add(s.position, offset));
          if (times.has(tick) && compare(times.get(tick)!, offset) !== 0)
            diagnostics.push({
              code: 'collapsed-curve',
              soundingId: s.id,
              message: 'Distinct curve samples collapse to one tick.',
            });
          times.set(tick, offset);
        };
        for (const curve of s.curve) {
          if (curve.kind === 'bend') {
            for (let i = 1; i < curve.points.length; i++) {
              const a = curve.points[i - 1],
                b = curve.points[i];
              if (compare(a.offset, b.offset) > 0)
                throw new RangeError('Bend points must be ordered.');
              const ta = quantizeTick(add(s.position, a.offset)),
                tb = quantizeTick(add(s.position, b.offset));
              if (tb - ta > 100_000)
                throw new RangeError('MIDI curve exceeds 100,000 sampled ticks.');
              for (let tick = ta + 1; tick < tb && tick < stop; tick++)
                if (tick >= start)
                  times.set(
                    tick,
                    subtract(rational(BigInt(tick), BigInt(MIDI_PPQ * 4)), s.position),
                  );
            }
            curve.points.forEach((point) => remember(point.offset));
          } else {
            if (curve.period.num <= 0n) throw new RangeError('Vibrato period must be positive.');
            const step = divide(curve.period, rational(32n));
            let offset = ZERO,
              count = 0;
            while (compare(offset, curve.duration) <= 0) {
              if (count++ > 100_000) throw new RangeError('MIDI vibrato exceeds the curve budget.');
              remember(add(curve.offset, offset));
              offset = add(offset, step);
            }
          }
        }
        const centsAt = (time: Rational) =>
          s.curve.reduce((sum, curve) => {
            if (curve.kind === 'vibrato') {
              const local = subtract(time, curve.offset);
              if (compare(local, ZERO) < 0 || compare(local, curve.duration) > 0) return sum;
              return (
                sum + curve.depthCents * Math.sin(2 * Math.PI * number(divide(local, curve.period)))
              );
            }
            let cents = 0;
            for (let i = 0; i < curve.points.length; i++) {
              const point = curve.points[i];
              if (compare(time, point.offset) < 0) break;
              cents = point.cents;
              const next = curve.points[i + 1];
              if (next && compare(time, next.offset) < 0) {
                cents +=
                  (next.cents - point.cents) *
                  number(divide(subtract(time, point.offset), subtract(next.offset, point.offset)));
                break;
              }
            }
            return sum + cents;
          }, fractional);
        for (const [tick, offset] of [...times].sort((a, b) => a[0] - b[0]))
          if (tick >= start && tick < stop) bend(tick, centsAt(offset));
      } else if (fractional !== 0 || s.curve.length)
        diagnostics.push({
          code: 'omitted-pitch-curve',
          soundingId: s.id,
          message: 'Shared/kit channel omits independent pitch curves and fractional pitch.',
        });
      push(events, stop, -1, [128 | channel, pitch, 0]);
      // Reset before any new note's curve setup at the same tick, never after it.
      if (independent) push(events, stop, 1, [224 | channel, 0, 64]);
      push(events, start, 3, [
        144 | channel,
        pitch,
        Math.max(1, Math.min(127, Math.round(s.velocity))),
      ]);
    }
    for (const d of diagnostics)
      push(conductor, 0, 0, meta(1, textBytes(`${d.code}: ${d.message}`)));
    const data = [
      ...chunk('MThd', [0, 1, 0, tracks.size + 1, MIDI_PPQ >> 8, MIDI_PPQ & 255]),
      ...track(conductor),
    ];
    for (const [, events] of [...tracks.entries()].sort((a, b) => a[0] - b[0]))
      data.push(...track(events));
    return {
      ok: true,
      bytes: new Uint8Array(data),
      diagnostics,
      allocation: allocations,
    };
  } catch (error) {
    if (error instanceof RangeError)
      return {
        ok: false,
        diagnostics: [...diagnostics, { code: 'midi-range', message: error.message }],
      };
    throw error;
  }
}
