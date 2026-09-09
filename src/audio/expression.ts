import type { MnxStructure, MnxEvent, MnxNote, MnxDynamic } from '../model/mnx.ts';
import type { Performance, SoundingEvent, WrittenOccurrence } from './performanceTypes.ts';
import {
  ZERO,
  add,
  subtract,
  multiply,
  compare,
  rational as q,
  fromDecimal,
  fromSafeFraction,
  type Rational,
} from './time.ts';
import { midiOf } from './pitch.ts';

export interface ExpressionSource {
  part: number;
  measure: number;
  sequence: number;
  staff: number;
  offset: Rational;
  event: MnxEvent;
  note?: MnxNote;
  tremoloIndex?: number;
}
export const DYNAMIC_VELOCITIES: Record<string, number> = {
  pppppp: 8,
  ppppp: 16,
  pppp: 24,
  ppp: 32,
  pp: 44,
  p: 56,
  mp: 68,
  mf: 80,
  f: 96,
  ff: 108,
  fff: 116,
  ffff: 120,
  fffff: 124,
  ffffff: 127,
  n: 0,
};
const clamp = (v: number) => Math.max(0, Math.min(127, Math.round(v)));
const fraction = (f: [number, number]) => fromSafeFraction({ num: f[0], den: f[1] });

function numericDynamic(mark: MnxDynamic): MnxDynamic {
  if (mark.value !== undefined || mark.glyphs?.length !== 1) return mark;
  const glyph = mark.glyphs[0];
  const ladder = glyph.startsWith('dynamic') ? glyph.slice(7).toLowerCase() : '';
  if (ladder in DYNAMIC_VELOCITIES) return { ...mark, value: ladder as MnxDynamic['value'] };
  const accents: Record<string, [MnxDynamic['value'], MnxDynamic['residualValue']?]> = {
    dynamicSforzato: ['f'],
    dynamicSforzando1: ['f'],
    dynamicForzando: ['f'],
    dynamicRinforzando1: ['f'],
    dynamicRinforzando2: ['f'],
    dynamicSforzatoFF: ['ff'],
    dynamicFortePiano: ['f', 'p'],
    dynamicSforzandoPiano: ['f', 'p'],
    dynamicSforzatoPiano: ['f', 'p'],
    dynamicSforzandoPianissimo: ['f', 'pp'],
  };
  const accent = accents[glyph];
  return accent
    ? {
        ...mark,
        type: 'accent',
        value: accent[0],
        ...(accent[1] ? { residualValue: accent[1] } : {}),
      }
    : mark;
}

/** Written-state lookup restores scoped dynamics at each repeat/jump destination.
 * Specific scopes win simultaneous marks; later marks always supersede earlier ones. */
function velocity(
  doc: MnxStructure,
  source: ExpressionSource,
  lengths: Rational[],
  report: (code: string, message: string) => void,
): number {
  const voice = doc.parts[source.part].measures[source.measure].sequences?.[source.sequence].voice;
  const starts: Rational[] = [ZERO];
  for (const length of lengths) starts.push(add(starts[starts.length - 1], length));
  const now = add(starts[source.measure], source.offset);
  let value = 80,
    attack: number | undefined;
  let ramp: { start: Rational; end: Rational; from: number; to: number } | undefined;
  const advance = (position: Rational) => {
    if (!ramp) return;
    const elapsed = subtract(position, ramp.start),
      span = subtract(ramp.end, ramp.start);
    const ratio = Math.max(
      0,
      Math.min(1, Number(elapsed.num * span.den) / Number(elapsed.den * span.num)),
    );
    value = clamp(ramp.from + (ramp.to - ramp.from) * ratio);
    if (compare(position, ramp.end) >= 0) ramp = undefined;
  };
  doc.parts[source.part].measures.slice(0, source.measure + 1).forEach((measure, mi) => {
    const marks = (measure.dynamics ?? [])
      .filter(
        (d) =>
          (d.staff === undefined || d.staff === source.staff) &&
          (d.voice === undefined || d.voice === voice),
      )
      .sort(
        (a, b) =>
          compare(fraction(a.position.fraction), fraction(b.position.fraction)) ||
          Number(a.staff !== undefined) +
            Number(a.voice !== undefined) -
            Number(b.staff !== undefined) -
            Number(b.voice !== undefined),
      );
    for (const mark of marks) {
      const d = numericDynamic(mark);
      const at = add(starts[mi], fraction(d.position.fraction));
      if (compare(at, now) > 0) break;
      advance(at);
      const exact = compare(at, now) === 0;
      const specified = d.value === undefined ? undefined : DYNAMIC_VELOCITIES[d.value];
      if (d.type === 'immediate' && specified !== undefined) {
        value = specified;
        ramp = undefined;
      } else if (d.type === 'relative') {
        if (!d.relativeValue) {
          report('unsupported-dynamic', 'Relative dynamic has no direction.');
          continue;
        }
        value = clamp(value + (d.relativeValue === 'louder' ? 12 : -12));
        ramp = undefined;
      } else if (d.type === 'accent') {
        if (exact) attack = specified ?? clamp(value + 20);
        if (d.residualValue !== undefined) {
          value = DYNAMIC_VELOCITIES[d.residualValue];
          ramp = undefined;
        }
      } else if (d.type === 'gradual') {
        if (!d.end) {
          report('unsupported-dynamic', 'Gradual dynamic has no end.');
          continue;
        }
        const endMeasure = doc.global?.measures?.findIndex((m) => m.id === d.end!.measure) ?? -1;
        if (endMeasure < 0 || !d.end.position) {
          report('unsupported-dynamic', 'Gradual dynamic has an unresolved end.');
          continue;
        }
        const end = add(starts[endMeasure], fraction(d.end.position.fraction));
        if (compare(end, at) <= 0) {
          report('unsupported-dynamic', 'Gradual dynamic has a nonpositive span.');
          continue;
        }
        ramp = {
          start: at,
          end,
          from: value,
          to: specified ?? clamp(value + (d.wedgeType === 'decreasing' ? -20 : 20)),
        };
      } else if (d.glyphs?.length)
        report('unsupported-dynamic', 'Glyph-only dynamic has no numeric interpretation.');
    }
  });
  advance(now);
  return attack ?? value;
}

/** Mutates only the freshly compiled sounding list; cursor spans stay written. */
export function applyExpression(
  doc: MnxStructure,
  written: WrittenOccurrence[],
  sounds: SoundingEvent[],
  sources: Map<string, ExpressionSource>,
  lengths: Rational[],
  diagnostics: Performance['diagnostics'],
): void {
  const byWritten = new Map(written.map((w) => [w.id, w]));
  const reportFor = (s: SoundingEvent) => (code: string, message: string) => {
    const w = byWritten.get(s.writtenIds[0])!;
    if (
      !diagnostics.some(
        (d) => d.code === code && d.noteKey === w.noteKey && d.ordinal === w.ordinal,
      )
    )
      diagnostics.push({
        code,
        message,
        noteKey: w.noteKey,
        ordinal: w.ordinal,
      });
  };
  for (const s of sounds) {
    const source = sources.get(s.id) ?? sources.get(s.writtenIds[0])!,
      report = reportFor(s);
    const marks = source.event.markings,
      technique = source.note?._x?.mnxLab?.tab?.technique;
    s.velocity = velocity(doc, source, lengths, report);
    if (marks?.accent) s.velocity += 20;
    if (source.tremoloIndex !== undefined) s.velocity += source.tremoloIndex % 2 ? -4 : 4;
    // Ties retain their continuous gate. Staccato wins over tenuto on an untied note.
    if (marks?.staccato && s.writtenIds.length === 1) s.duration = multiply(s.duration, q(1n, 2n));
    if (technique?.palmMute) {
      s.duration = multiply(s.duration, q(3n, 5n));
      s.velocity -= 15;
      s.damped = true;
    }
    if (technique?.harmonic) {
      s.velocity -= 10;
      s.timbre = ['harmonic'];
      const harmonic = technique.harmonic;
      const part = doc.parts[source.part]._x?.mnxLab;
      const string = part?.strings?.find((v) => v.string === source.note?._x?.mnxLab?.string);
      if (harmonic.type !== 'natural' || !string || !harmonic.touchingPitch)
        report(
          'unsupported-harmonic-validation',
          'Harmonic metadata lacks a known natural open-string node; sounded pitch is preserved.',
        );
      else {
        const open = midiOf(string.pitch) + (part?.capo ?? 0),
          touch = midiOf(harmonic.touchingPitch) - open;
        // Common natural nodes only; no artificial/stopped-string inference.
        const nodes = [
          { touch: 12, sound: 12 },
          { touch: 7, sound: 19 },
          { touch: 5, sound: 24 },
          { touch: 4, sound: 28 },
        ];
        const node = nodes.find((n) => Math.abs(n.touch - touch) < 0.15);
        if (!node)
          report(
            'unsupported-harmonic-validation',
            'Touching metadata is outside the supported natural-node table.',
          );
        else if (Math.abs(s.midi - open - node.sound) > 0.15)
          report(
            'inconsistent-harmonic',
            'Natural harmonic sounded pitch disagrees with touching metadata; pitch is preserved.',
          );
      }
    }
    for (const key of Object.keys(marks ?? {}))
      if (!['accent', 'staccato', 'tenuto', 'tremolo'].includes(key))
        report('unsupported-articulation', `Articulation ${key} has no playback convention.`);
    for (const id of s.writtenIds.slice(1))
      if (sources.get(id)?.note?._x?.mnxLab?.tab?.technique)
        report(
          'tied-continuation-technique',
          'Technique on a merged tie continuation is not applied; the attack owns expression.',
        );
    s.velocity = clamp(s.velocity);
  }
  // Roll only the marked pitch span, including notes on other voices/staves.
  for (const [pi, part] of doc.parts.entries())
    for (const [mi, measure] of part.measures.entries())
      for (const mark of measure.arpeggios ?? []) {
        const candidates = sounds.filter((s) => {
          const a = sources.get(s.writtenIds[0])!;
          return (
            a.part === pi &&
            a.measure === mi &&
            compare(a.offset, fraction(mark.position.fraction)) === 0
          );
        });
        const ordinals = new Set(candidates.map((s) => byWritten.get(s.writtenIds[0])!.ordinal));
        for (const ordinal of ordinals) {
          const group = candidates.filter(
            (s) => byWritten.get(s.writtenIds[0])!.ordinal === ordinal,
          );
          const start = group.find(
              (s) => byWritten.get(s.writtenIds[0])!.noteKey === mark.span.start,
            ),
            end = group.find((s) => byWritten.get(s.writtenIds[0])!.noteKey === mark.span.end);
          if (!start || !end) {
            if (group[0])
              reportFor(group[0])(
                'unsupported-arpeggio',
                'Arpeggio endpoints are not both present in this performed chord.',
              );
            continue;
          }
          const rolled = group
            .filter(
              (s) =>
                s.midi >= Math.min(start.midi, end.midi) &&
                s.midi <= Math.max(start.midi, end.midi),
            )
            .sort((a, b) => (mark.direction === 'down' ? b.midi - a.midi : a.midi - b.midi));
          rolled.forEach((s, i) => {
            let delay = q(BigInt(i), 64n);
            if (compare(delay, s.duration) >= 0) {
              delay = multiply(s.duration, q(BigInt(i), BigInt(rolled.length)));
              reportFor(s)(
                'compressed-arpeggio',
                'Arpeggio roll compressed to keep each note within its gate.',
              );
            }
            s.position = add(s.position, delay);
            s.duration = subtract(s.duration, delay);
          });
        }
      }
  sounds.sort((a, b) => compare(a.position, b.position) || a.id.localeCompare(b.id));
  for (const s of sounds) {
    const source = sources.get(s.id) ?? sources.get(s.writtenIds[0])!,
      t = source.note?._x?.mnxLab?.tab?.technique;
    if (!t) continue;
    const report = reportFor(s);
    const targetFor = (id: string | undefined) =>
      sounds.find(
        (v) =>
          v !== s &&
          v.voice === s.voice &&
          compare(v.position, s.position) > 0 &&
          byWritten.get(v.writtenIds[0])!.noteKey === id,
      );
    if (t.bend) {
      const points = t.bend.points;
      if (
        points.some(
          (p) =>
            !Number.isFinite(p.alter) ||
            !Number.isFinite(p.position) ||
            p.position < 0 ||
            p.position > 1,
        )
      )
        report('invalid-bend', 'Bend points must have finite cents and positions within the note.');
      else
        s.curve.push({
          kind: 'bend',
          points: [...points]
            .sort((a, b) => a.position - b.position)
            .map((p) => ({
              offset: multiply(s.duration, fromDecimal(p.position)),
              cents: p.alter * 100,
            })),
        });
    }
    if (t.vibrato)
      s.curve.push({
        kind: 'vibrato',
        offset: multiply(s.duration, q(1n, 4n)),
        duration: multiply(s.duration, q(3n, 4n)),
        period: q(1n, 10n),
        depthCents: 30,
      });
    if (t.slide) {
      const slide = t.slide,
        target = targetFor(slide.target),
        delta = slide.direction === 'down' ? -200 : 200;
      if (slide.type === 'slideIn')
        s.curve.push({
          kind: 'bend',
          points: [
            { offset: ZERO, cents: -delta },
            { offset: multiply(s.duration, q(1n, 4n)), cents: 0 },
          ],
        });
      else if (slide.type === 'slideOut' || target)
        s.curve.push({
          kind: 'bend',
          points: [
            { offset: ZERO, cents: 0 },
            { offset: multiply(s.duration, q(3n, 4n)), cents: 0 },
            {
              offset: s.duration,
              cents: target ? (target.midi - s.midi) * 100 : delta,
            },
          ],
        });
      else
        report(
          'unresolved-technique-target',
          'Slide target has no future occurrence on the same voice.',
        );
    }
    if (t.hammerPull || t.slide?.type === 'legato') {
      const target = targetFor(t.hammerPull?.target ?? t.slide?.target);
      // Only contiguous written notes on one physical string can share an envelope.
      const w = byWritten.get(s.writtenIds[s.writtenIds.length - 1])!;
      if (
        !target ||
        !s.voice.includes(':string:') ||
        compare(add(w.position, w.duration), target.position) !== 0 ||
        sounds.some(
          (v) =>
            v !== s &&
            v !== target &&
            v.voice === s.voice &&
            compare(v.position, s.position) > 0 &&
            compare(v.position, target.position) <= 0,
        )
      )
        report(
          'unresolved-technique-target',
          'Legato target is not the next contiguous note on the same assigned string.',
        );
      else {
        s.duration = subtract(target.position, s.position);
        target.noReattack = true;
        if (t.hammerPull) target.velocity = clamp(target.velocity - 25);
      }
    }
  }
}
