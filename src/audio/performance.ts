import {
  isTimedEvent,
  isTuplet,
  isGrace,
  isTremolo,
  type MnxStructure,
  type MnxSequenceItem,
  type MnxEvent,
  type MnxNote,
  type MnxGrace,
} from '../model/mnx.ts';
import { noteKeyAt } from '../model/noteWalk.ts';
import { linearizePasses, type PassModel } from '../model/passes.ts';
import { midiOf } from './pitch.ts';
import {
  ZERO,
  ONE,
  add,
  subtract,
  multiply,
  compare,
  min,
  max,
  rational,
  fromSafeFraction,
  fromRationalJSON,
  noteDuration,
  tupletScale,
  createTempoMap,
  TimingError,
  type Rational,
} from './time.ts';
import {
  allocateGrace,
  createInsertionMap,
  fermataExtra,
  barlineFermataExtra,
  LV_DURATION,
  type InsertionRequest,
} from './timingConventions.ts';
import { performedTempoChanges } from './writtenState.ts';
import type {
  Performance,
  PerformanceResult,
  WrittenOccurrence,
  SoundingEvent,
  PerformanceVoice,
} from './performanceTypes.ts';

import { applyExpression, type ExpressionSource } from './expression.ts';

interface EventSpan {
  event: MnxEvent;
  part: number;
  measure: number;
  sequence: number;
  staff: number;
  voice: number;
  eventIndex: number;
  path: number[];
  offset: Rational;
  duration: Rational;
  weight: Rational;
  grace?: { id: string; kind: NonNullable<MnxGrace['graceType']> };
  tremolo?: { id: string; index: number; count: number; step: Rational };
}
interface Visit extends EventSpan {
  ordinal: number;
  metricPosition: Rational;
  metricOffset: Rational;
  metricDuration: Rational;
  position: Rational;
  playedDuration: Rational;
}
const fraction = (value: [number, number]): Rational =>
  fromSafeFraction({ num: value[0], den: value[1] });
const integer = (n: number) => fromSafeFraction({ num: n, den: 1 });
const end = (span: { position: Rational; duration: Rational }) => add(span.position, span.duration);
const LIMIT = 100_000;
const limit = () => {
  throw new TimingError({
    code: 'resource-limit',
    message: `Performance exceeds ${LIMIT} events or 32 container levels.`,
  });
};

/** Exact compiler; no DOM, sink, ticks or wall clock. Invalid/resource-limited
 * input fails as a whole. Unsupported sound content has explicit diagnostics. */
export function compilePerformance(
  doc: MnxStructure,
  passes: PassModel = linearizePasses(doc),
): PerformanceResult {
  try {
    return { ok: true, performance: compile(doc, passes) };
  } catch (error) {
    if (error instanceof TimingError) return { ok: false, diagnostics: [error.diagnostic] };
    if (error instanceof RangeError)
      return {
        ok: false,
        diagnostics: [{ code: 'invalid-time', message: error.message }],
      };
    throw error;
  }
}
function compile(doc: MnxStructure, passes: PassModel): Performance {
  if (passes.truncated) limit();
  const diagnostics: Performance['diagnostics'] = passes.diagnostics.map((d) => ({
    code: d.code,
    message: d.message,
  }));
  const diagnostic = (code: string, message: string, ordinal?: number, noteKey?: string) =>
    diagnostics.push({
      code,
      message,
      ...(ordinal === undefined ? {} : { ordinal }),
      ...(noteKey === undefined ? {} : { noteKey }),
    });
  const events: EventSpan[] = [];
  const lengths: Rational[] = Array.from({ length: passes.passCounts.length }, () => ZERO);
  let meter = ONE;
  const meters = (doc.global?.measures ?? []).map((m) => {
    if (m.time) meter = fromSafeFraction({ num: m.time.count, den: m.time.unit });
    return meter;
  });
  const measureCount = Math.max(lengths.length, ...doc.parts.map((p) => p.measures.length));
  for (let i = 0; i < measureCount; i++) lengths[i] = ZERO;
  doc.parts.forEach((part, pi) =>
    part.measures.forEach((measure, mi) => {
      const voices = new Map<number, number>();
      measure.sequences?.forEach((sequence, si) => {
        const staff = sequence.staff ?? 1,
          voice = (voices.get(staff) ?? -1) + 1;
        voices.set(staff, voice);
        const walk = (
          item: MnxSequenceItem,
          offset: Rational,
          scale: Rational,
          eventIndex: number,
          path: number[],
          grace?: EventSpan['grace'],
        ): Rational => {
          if (path.length > 32 || events.length >= LIMIT) limit();
          const base = {
            part: pi,
            measure: mi,
            sequence: si,
            staff,
            voice,
            eventIndex,
            path,
            offset,
          };
          if (Array.isArray((item as MnxEvent).duration))
            return multiply(
              fraction((item as unknown as { duration: [number, number] }).duration),
              scale,
            );
          if (isTimedEvent(item)) {
            const duration = multiply(noteDuration(item.duration), scale);
            const marks = (item.markings as { tremolo?: { marks?: number } } | undefined)?.tremolo
              ?.marks;
            if (marks !== undefined && (!Number.isSafeInteger(marks) || marks < 0 || marks > 16))
              limit();
            events.push({
              ...base,
              event: item,
              duration: grace ? ZERO : duration,
              weight: duration,
              ...(grace ? { grace } : {}),
              ...(marks === undefined
                ? {}
                : {
                    tremolo: {
                      id: `p${pi}m${mi}q${si}e${eventIndex}c${path.join('.')}`,
                      index: 0,
                      count: 1,
                      step: multiply(rational(1n, 1n << BigInt(marks + 2)), scale),
                    },
                  }),
            });
            return grace ? ZERO : duration;
          }
          if (isGrace(item)) {
            const group = {
              id: `p${pi}m${mi}q${si}e${eventIndex}c${path.join('.')}`,
              kind: item.graceType ?? 'stealFollowing',
            };
            item.content.forEach((child, i) =>
              walk(child, offset, scale, eventIndex, [...path, i], group),
            );
            return ZERO;
          }
          if (isTuplet(item)) {
            const own = multiply(scale, tupletScale(item));
            let cursor = offset;
            item.content.forEach((child, i) => {
              cursor = add(cursor, walk(child, cursor, own, eventIndex, [...path, i], grace));
            });
            const declared = multiply(
              multiply(noteDuration(item.outer.duration), integer(item.outer.multiple)),
              scale,
            );
            if (!grace && compare(subtract(cursor, offset), declared) !== 0)
              diagnostic(
                'tuplet-content-span',
                'Tuplet content does not fill its declared outer span.',
              );
            return grace ? ZERO : declared;
          }
          if (isTremolo(item)) {
            const duration = multiply(
              item.outer
                ? multiply(noteDuration(item.outer.duration), integer(item.outer.multiple ?? 1))
                : item.content[0]
                  ? noteDuration(item.content[0].duration)
                  : ZERO,
              scale,
            );
            const marks = item.marks ?? 1;
            if (!Number.isSafeInteger(marks) || marks < 0 || marks > 16) limit();
            const id = `p${pi}m${mi}q${si}e${eventIndex}c${path.join('.')}`;
            item.content.forEach((child, i) => {
              if (!isTimedEvent(child)) {
                diagnostic('unsupported-tremolo', 'Non-event tremolo child is silent.');
                return;
              }
              events.push({
                ...base,
                path: [...path, i],
                event: child,
                duration,
                weight: duration,
                tremolo: {
                  id,
                  index: i,
                  count: item.content.length,
                  step: multiply(rational(1n, 1n << BigInt(marks + 2)), scale),
                },
              });
            });
            return duration;
          }
          diagnostic(
            'unsupported-sequence-item',
            `Unsupported sequence item ${String((item as { type?: string }).type)} is silent.`,
          );
          return ZERO;
        };
        let cursor = ZERO;
        sequence.content.forEach((item, ei) => {
          cursor = add(cursor, walk(item, cursor, ONE, ei, []));
        });
        lengths[mi] = max(lengths[mi] ?? ZERO, cursor);
      });
    }),
  );
  lengths.forEach((value, i) => {
    if (value.num === 0n) lengths[i] = meters[i] ?? meters.at(-1) ?? ONE;
  });
  const measures: Performance['measures'] = [];
  let position = ZERO;
  for (const entry of passes.entries) {
    const from = entry.from ? fraction(entry.from) : ZERO,
      until = entry.until ? fraction(entry.until) : lengths[entry.measureIndex];
    if (
      !until ||
      compare(from, ZERO) < 0 ||
      compare(until, from) < 0 ||
      compare(until, lengths[entry.measureIndex]) > 0
    )
      throw new RangeError('Traversal slice is outside its written measure.');
    const duration = subtract(until, from);
    measures.push({
      ordinal: entry.ordinal,
      measureIndex: entry.measureIndex,
      occurrence: entry.occurrence,
      iteration: entry.iteration,
      from,
      until,
      metricPosition: position,
      metricDuration: duration,
      position,
      duration,
    });
    position = add(position, duration);
  }
  const visits: Visit[] = [];
  for (const measure of measures) {
    for (const event of events.filter((e) => e.measure === measure.measureIndex)) {
      const from = max(event.offset, measure.from),
        until = min(add(event.offset, event.duration), measure.until);
      if (
        event.grace
          ? compare(event.offset, measure.from) < 0 ||
            compare(event.offset, measure.until) > 0 ||
            (compare(event.offset, measure.until) === 0 &&
              (event.grace.kind !== 'stealPrevious' ||
                compare(measure.until, lengths[event.measure]) !== 0))
          : compare(until, from) <= 0
      )
        continue;
      const metricPosition = add(measure.metricPosition, subtract(from, measure.from));
      const duration = event.grace ? ZERO : subtract(until, from);
      visits.push({
        ...event,
        ordinal: measure.ordinal,
        metricOffset: from,
        metricPosition,
        metricDuration: duration,
        position: metricPosition,
        playedDuration: duration,
      });
      if (visits.length > LIMIT) limit();
    }
  }
  const requests: InsertionRequest[] = [];
  for (const measure of measures) {
    const fermata = doc.global?.measures[measure.measureIndex]?.fermata;
    if (fermata && compare(measure.until, lengths[measure.measureIndex]) === 0)
      requests.push({
        position: add(measure.metricPosition, measure.metricDuration),
        duration: barlineFermataExtra(fermata.duration),
        kind: 'fermata',
        source: { ordinal: measure.ordinal, metricOffset: measure.until },
      });
  }
  const graceGroups = new Map<string, Visit[]>();
  for (const visit of visits)
    if (visit.grace) {
      const key = `${visit.ordinal}:${visit.grace.id}`;
      graceGroups.set(key, [...(graceGroups.get(key) ?? []), visit]);
    }
  const soundingInk = (v: Visit) =>
    (v.event.notes?.length ?? 0) > 0 ||
    ((v.event as { kitNotes?: unknown[] }).kitNotes?.length ?? 0) > 0;
  for (const group of graceGroups.values()) {
    const first = group[0],
      kind = first.grace!.kind;
    const neighbours = visits.filter(
      (v) =>
        !v.grace &&
        v.part === first.part &&
        v.staff === first.staff &&
        v.voice === first.voice &&
        soundingInk(v),
    );
    const neighbour =
      kind === 'stealPrevious'
        ? [...neighbours]
            .reverse()
            .find(
              (v) =>
                compare(add(v.metricPosition, v.playedDuration), first.metricPosition) === 0 &&
                v.ordinal >= first.ordinal - 1,
            )
        : neighbours.find(
            (v) =>
              compare(v.metricPosition, first.metricPosition) === 0 &&
              v.ordinal <= first.ordinal + 1,
          );
    // Across entries only ordinary written adjacency is eligible, never a jump/loop.
    const adjacent =
      !neighbour ||
      neighbour.ordinal === first.ordinal ||
      (Math.abs(neighbour.measure - first.measure) === 1 &&
        !passes.entries[Math.max(neighbour.ordinal, first.ordinal)]?.via);
    const allocation = allocateGrace(
      kind,
      group.map((v) => v.weight),
      adjacent ? (neighbour?.playedDuration ?? null) : null,
    );
    diagnostics.push(...allocation.diagnostics.map((d) => ({ ...d, ordinal: first.ordinal })));
    if (kind === 'makeTime')
      requests.push({
        position: first.metricPosition,
        duration: allocation.duration,
        kind: 'makeTime',
        source: {
          ordinal: first.ordinal,
          metricOffset: first.metricOffset,
          graceId: first.grace!.id,
        },
      });
    let cursor =
      kind === 'stealPrevious' && neighbour
        ? subtract(add(neighbour.position, neighbour.playedDuration), allocation.duration)
        : first.metricPosition;
    group.forEach((v, i) => {
      v.position = cursor;
      v.playedDuration = allocation.durations[i];
      cursor = add(cursor, v.playedDuration);
    });
    if (kind !== 'makeTime' && neighbour && adjacent) {
      const peers = neighbour.tremolo
        ? visits.filter(
            (v) => v.ordinal === neighbour.ordinal && v.tremolo?.id === neighbour.tremolo!.id,
          )
        : [neighbour];
      for (const peer of peers) {
        if (kind === 'stealFollowing') peer.position = add(peer.position, allocation.duration);
        peer.playedDuration = subtract(peer.playedDuration, allocation.duration);
      }
    }
  }
  // Holds apply to the resolved neighbour after stealing, before inserted time.
  for (const visit of visits)
    if (visit.event.fermata && !visit.grace)
      requests.push({
        position: add(visit.position, visit.playedDuration),
        duration: fermataExtra(visit.playedDuration, visit.event.fermata.duration),
        kind: 'fermata',
        source: {
          ordinal: visit.ordinal,
          metricOffset: add(
            visit.metricOffset,
            add(subtract(visit.position, visit.metricPosition), visit.playedDuration),
          ),
        },
      });
  const gates = new Map(
    visits.map((v) => [v, { position: v.position, duration: v.playedDuration }]),
  );
  const insertions = createInsertionMap(requests);
  for (const visit of visits) {
    if (visit.playedDuration.num === 0n) continue;
    if (visit.grace?.kind === 'makeTime') {
      const insertion = insertions.insertions.find(
        (i) => i.kind === 'makeTime' && compare(i.metricPosition, visit.metricPosition) === 0,
      )!;
      visit.position = add(insertion.position, subtract(visit.position, visit.metricPosition));
    } else {
      const mapped = insertions.mapSpan(visit.position, visit.playedDuration);
      visit.position = mapped.position;
      visit.playedDuration = mapped.duration;
    }
  }
  const written: WrittenOccurrence[] = [];
  const sounding: SoundingEvent[] = [];
  const voices = new Map<string, PerformanceVoice>();
  const notes = new Map<string, MnxNote>();
  const expressionSources = new Map<string, ExpressionSource>();
  for (const visit of visits) {
    const pitched: {
      note?: MnxNote;
      key: string;
      midi?: number;
      kit: boolean;
    }[] = (visit.event.notes ?? []).map((note, ni) => ({
      note,
      key: noteKeyAt(
        note,
        visit.measure,
        visit.voice,
        visit.eventIndex,
        ni,
        visit.path.length === 0 ? undefined : visit.path.length === 1 ? visit.path[0] : visit.path,
        visit.part,
        visit.staff,
      ),
      midi: midiOf(note.pitch),
      kit: false,
    }));
    const kitNotes =
      (visit.event as { kitNotes?: { id?: string; kitComponent?: string }[] }).kitNotes ?? [];
    kitNotes.forEach((note, i) => {
      const part = doc.parts[visit.part] as unknown as {
        kit?: Record<string, { sound?: string }>;
      };
      const sound = part.kit?.[note.kitComponent ?? '']?.sound;
      const midi = (
        doc.global as unknown as {
          sounds?: Record<string, { midiNumber?: number }>;
        }
      ).sounds?.[sound ?? '']?.midiNumber;
      if (midi === undefined)
        diagnostic(
          'missing-kit-sound',
          'Kit note has no declared MIDI sound; silent.',
          visit.ordinal,
        );
      pitched.push({
        note: undefined as unknown as MnxNote,
        key:
          note.id ??
          `@p${visit.part}.m${visit.measure}.s${visit.staff}.v${visit.voice}.e${visit.eventIndex}${visit.path.map((i) => `.c${i}`).join('')}.k${i}`,
        midi,
        kit: true,
      });
    });
    for (const { note, key, midi, kit } of pitched) {
      const id = `w${visit.ordinal}:${key}`;
      const w: WrittenOccurrence = {
        id,
        noteKey: key,
        ordinal: visit.ordinal,
        metricOffset: visit.metricOffset,
        metricDuration: visit.metricDuration,
        position: visit.position,
        duration: visit.playedDuration,
        soundingIds: [],
      };
      written.push(w);
      expressionSources.set(id, {
        ...visit,
        offset: visit.metricOffset,
        note,
        tremoloIndex: visit.tremolo?.index,
      });
      if (note) notes.set(id, note);
      if (visit.playedDuration.num === 0n || midi === undefined) continue;
      const string = note?._x?.mnxLab?.string,
        declared = doc.parts[visit.part]._x?.mnxLab?.strings ?? [];
      const validString = string !== undefined && declared.some((s) => s.string === string);
      if (string !== undefined && !validString)
        diagnostic(
          'invalid-string',
          'Assigned string is not declared; using an independent pitch-only voice.',
          visit.ordinal,
          key,
        );
      if (!validString && note?._x?.mnxLab?.tab?.technique)
        diagnostic(
          'unassigned-string-technique',
          'String continuity cannot be honored without a valid assigned string; pitch-local expression remains available.',
          visit.ordinal,
          key,
        );
      const voice = kit
        ? `p${visit.part}:kit`
        : validString
          ? `p${visit.part}:string:${string}`
          : `p${visit.part}:note:${id}`;
      voices.set(voice, {
        id: voice,
        partIndex: visit.part,
        ...(doc.parts[visit.part].id ? { partId: doc.parts[visit.part].id } : {}),
        ...(validString ? { string } : {}),
        ...(kit ? { kit: true } : {}),
      });
      const emit = (position: Rational, duration: Rational, tremoloIndex?: number) => {
        if (duration.num === 0n) return;
        if (sounding.length >= LIMIT) limit();
        const s: SoundingEvent = {
          id: `s${sounding.length}`,
          voice,
          position,
          duration,
          midi,
          velocity: 80,
          curve: [],
          writtenIds: [id],
        };
        expressionSources.set(s.id, {
          ...expressionSources.get(id)!,
          tremoloIndex,
        });
        sounding.push(s);
        w.soundingIds.push(s.id);
      };
      if (visit.tremolo) {
        // Subdivision lives on the unsliced metric grid; jump slices never restart alternation.
        const t = visit.tremolo;
        let n = 0,
          cursor = visit.offset;
        while (compare(cursor, add(visit.offset, visit.duration)) < 0) {
          if (n > LIMIT) limit();
          const gate = gates.get(visit)!;
          const allowedFrom = add(
            measures[visit.ordinal].from,
            subtract(gate.position, measures[visit.ordinal].metricPosition),
          );
          const a = max(cursor, allowedFrom),
            b = min(add(cursor, t.step), add(allowedFrom, gate.duration));
          if (n % t.count === t.index && compare(b, a) > 0) {
            const metric = add(
              measures[visit.ordinal].metricPosition,
              subtract(a, measures[visit.ordinal].from),
            );
            const mapped = insertions.mapSpan(metric, subtract(b, a));
            emit(mapped.position, mapped.duration, n);
          }
          cursor = add(cursor, t.step);
          n++;
        }
      } else emit(w.position, w.duration);
    }
  }
  // Merge after unrolling. References choose an actual future written occurrence,
  // and a normal tie cannot bridge a repeat/jump that skipped its target.
  written.sort(
    (a, b) =>
      compare(a.position, b.position) ||
      a.ordinal - b.ordinal ||
      (a.noteKey < b.noteKey ? -1 : a.noteKey > b.noteKey ? 1 : 0),
  );
  const bySound = new Map(sounding.map((s) => [s.id, s]));
  for (const w of written) {
    const note = notes.get(w.id);
    if (!note?.ties?.length || w.soundingIds.length !== 1) continue;
    const sound = bySound.get(w.soundingIds[0]);
    if (!sound) continue;
    for (const tie of note.ties) {
      if (tie.lv && !tie.target) {
        sound.duration = max(sound.duration, LV_DURATION);
        continue;
      }
      const candidates = written.filter(
        (t) =>
          t.id !== w.id &&
          compare(t.position, w.position) > 0 &&
          (!tie.target || t.noteKey === tie.target) &&
          t.soundingIds.length === 1,
      );
      const target = candidates.find((t) => {
        const other = bySound.get(t.soundingIds[0]);
        if (!other || other.midi !== sound.midi) return false;
        const jumped = passes.entries
          .slice(w.ordinal + 1, t.ordinal + 1)
          .some((e) => e.via === 'loop' || e.via === 'jump' || e.via === 'ending');
        return tie.targetType === 'crossJump'
          ? jumped
          : !jumped && (tie.target !== undefined || compare(t.position, end(w)) === 0);
      });
      if (!target) continue; // alternative endings legitimately leave one outgoing tie unused
      const merged = bySound.get(target.soundingIds[0])!;
      if (merged === sound) continue;
      sound.duration = subtract(max(end(sound), end(merged)), sound.position);
      for (const id of merged.writtenIds) {
        const linked = written.find((v) => v.id === id)!;
        linked.soundingIds = [sound.id];
        sound.writtenIds.push(id);
      }
      bySound.delete(merged.id);
      break;
    }
  }
  const result = [...bySound.values()].sort(
    (a, b) => compare(a.position, b.position) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  applyExpression(doc, written, result, expressionSources, lengths, diagnostics);
  // Simultaneous string conflicts keep every pitch, on explicit fallback voices.
  const conflict = new Map<string, SoundingEvent[]>();
  for (const s of result)
    if (voices.get(s.voice)?.string !== undefined) {
      const k = `${s.voice}:${s.position.num}/${s.position.den}`;
      conflict.set(k, [...(conflict.get(k) ?? []), s]);
    }
  const claims = new Map(result.map((s) => [s.id, s.voice]));
  for (const group of conflict.values())
    if (group.length > 1) {
      diagnostic(
        'string-conflict',
        'Simultaneous attacks on one string use independent fallback voices.',
      );
      for (const s of group) {
        const metadata = voices.get(s.voice)!;
        s.voice = `${s.voice}:conflict:${s.id}`;
        voices.set(s.voice, {
          id: s.voice,
          partIndex: metadata.partIndex,
          ...(metadata.partId ? { partId: metadata.partId } : {}),
        });
      }
    }
  const active = new Map<string, SoundingEvent[]>();
  for (const group of conflict.values()) {
    const claim = claims.get(group[0].id)!;
    for (const previous of active.get(claim) ?? [])
      if (compare(end(previous), group[0].position) > 0)
        previous.duration = subtract(group[0].position, previous.position);
    active.set(claim, group);
  }
  // Re-striking a string can silence a tied span before a later written target.
  // Keep the written occurrence/link: its sounding event records the truncation.
  for (const m of measures) {
    m.position = insertions.toPerformance(m.metricPosition, 'afterFermata');
    m.duration = subtract(
      insertions.toPerformance(add(m.metricPosition, m.metricDuration), 'afterFermata'),
      m.position,
    );
  }
  const projected = performedTempoChanges(
    doc.global?.measures ?? [],
    measures.map((m) => ({
      ordinal: m.ordinal,
      measureIndex: m.measureIndex,
      metricOffset: m.from,
      until: m.until,
      position: m.metricPosition,
    })),
  );
  const tempo = createTempoMap(
    projected.map((t) => ({
      ...t,
      position: insertions.toPerformance(t.position),
    })),
  ).changes;
  const sourceMap: Performance['sourceMap'] = [...insertions.insertions];
  for (const m of measures) {
    let start = m.metricPosition;
    const finish = add(start, m.metricDuration);
    const cuts = [
      ...insertions.insertions
        .map((i) => i.metricPosition)
        .filter((p) => compare(p, start) > 0 && compare(p, finish) < 0),
      finish,
    ].sort(compare);
    for (const stop of cuts) {
      if (compare(stop, start) > 0)
        sourceMap.push({
          kind: 'metric',
          ordinal: m.ordinal,
          metricOffset: add(m.from, subtract(start, m.metricPosition)),
          metricPosition: start,
          position: insertions.toPerformance(start),
          duration: subtract(stop, start),
        });
      start = stop;
    }
  }
  sourceMap.sort((a, b) => compare(a.position, b.position));
  const used = new Set(result.map((s) => s.voice));
  return {
    formatVersion: 1,
    written,
    sounding: result,
    voices: [...voices.values()].filter((v) => used.has(v.id)),
    tempo: [...tempo],
    measures,
    sourceMap,
    diagnostics,
  };
}
/** Canonical exact JSON: no floating seconds/ticks or BigInt in evidence. */
export function serializePerformance(performance: Performance): string {
  return (
    JSON.stringify(
      performance,
      (_key, value: unknown) => (typeof value === 'bigint' ? String(value) : value),
      2,
    ) + '\n'
  );
}

/** Read generated evidence, rejecting noncanonical fractions. */
export function parsePerformance(text: string): Performance {
  const value = JSON.parse(text, (_key, value: unknown) => {
    if (value && typeof value === 'object' && 'num' in value && 'den' in value) {
      const input = value as { num: unknown; den: unknown };
      if (
        typeof input.num !== 'string' ||
        typeof input.den !== 'string' ||
        !/^(-?[1-9][0-9]*|0)$/.test(input.num) ||
        !/^([1-9][0-9]*)$/.test(input.den)
      )
        throw new RangeError('Invalid rational performance value.');
      return fromRationalJSON({ num: input.num, den: input.den });
    }
    return value;
  });
  if (
    value?.formatVersion !== 1 ||
    !['written', 'sounding', 'voices', 'tempo', 'measures', 'sourceMap', 'diagnostics'].every(
      (key) => Array.isArray(value[key]),
    )
  )
    throw new RangeError('Unsupported performance evidence format.');
  return value as Performance;
}
