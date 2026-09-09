// Comparison policy over an independently produced MIDI recording. No pass-model
// calls: written-bar evidence comes directly from MusicXML pitch fingerprints.
import { parseXML, type XmlElement } from '../../converters/musicxml-mnx/src/common/xml.ts';
import { readMidi } from './readMidi.ts';
import type { Performance } from '../../src/audio/performanceTypes.ts';
import { createTempoMap, add } from '../../src/audio/time.ts';
export const ONSET_TOLERANCE = 1 / 64; // quarter notes, after PPQ normalization
const rounded = (n: number) => Math.round(n * 1e9) / 1e9;
export interface OracleNote {
  pitch: number;
  duration: number;
  velocity: number;
  seconds: number;
  measure?: number;
}
export interface Attack {
  onset: number;
  seconds: number;
  notes: OracleNote[];
}
const signature = (a: Attack) =>
  a.notes
    .map((n) => n.pitch)
    .sort((a, b) => a - b)
    .join(',');
function group(notes: { onset: number; seconds: number; note: OracleNote }[]): Attack[] {
  const rows: Attack[] = [];
  for (const n of notes.sort((a, b) => a.onset - b.onset || a.note.pitch - b.note.pitch)) {
    const last = rows.at(-1);
    if (last && Math.abs(last.onset - n.onset) < 1e-8) last.notes.push(n.note);
    else rows.push({ onset: n.onset, seconds: n.seconds, notes: [n.note] });
  }
  return rows;
}
export function midiAttacks(bytes: Uint8Array) {
  const midi = readMidi(bytes);
  if (midi.ppq <= 0) throw Error('MIDI oracle requires positive metrical PPQ.');
  const tempos = midi.tracks
    .flat()
    .filter((e) => e.metaType === 81)
    .map((e) => ({ tick: e.tick, micros: e.data[0] * 65536 + e.data[1] * 256 + e.data[2] }))
    .sort((a, b) => a.tick - b.tick);
  const secondsAt = (tick: number) => {
    let seconds = 0,
      prev = 0,
      micros = 500000;
    for (const t of tempos) {
      if (t.tick > tick) break;
      seconds += (((t.tick - prev) / midi.ppq) * micros) / 1e6;
      prev = t.tick;
      micros = t.micros;
    }
    return seconds + (((tick - prev) / midi.ppq) * micros) / 1e6;
  };
  const notes: { onset: number; seconds: number; note: OracleNote }[] = [];
  for (const track of midi.tracks) {
    const active = new Map<string, { tick: number; pitch: number; velocity: number }[]>();
    for (const e of track) {
      const type = e.status >> 4,
        key = `${e.status & 15}:${e.data[0]}`;
      if (type === 9 && e.data[1] > 0)
        active.set(key, [
          ...(active.get(key) ?? []),
          { tick: e.tick, pitch: e.data[0], velocity: e.data[1] },
        ]);
      else if (type === 8 || (type === 9 && e.data[1] === 0)) {
        const n = active.get(key)?.shift();
        if (!n) continue;
        notes.push({
          onset: n.tick / midi.ppq,
          seconds: secondsAt(n.tick),
          note: {
            pitch: n.pitch,
            velocity: n.velocity,
            duration: (e.tick - n.tick) / midi.ppq,
            seconds: secondsAt(e.tick) - secondsAt(n.tick),
          },
        });
      }
    }
    if ([...active.values()].some((a) => a.length))
      throw Error('Unreleased MIDI note in external evidence.');
  }
  const bends = midi.tracks.flat().filter((e) => e.status >> 4 === 14);
  return {
    ppq: midi.ppq,
    attacks: group(notes),
    tempoEvents: tempos.length,
    pitchBendEvents: bends.length,
    noncentralPitchBendEvents: bends.filter((e) => e.data[0] + e.data[1] * 128 !== 8192).length,
  };
}
export function performanceAttacks(performance: Performance): Attack[] {
  const q = (r: { num: bigint; den: bigint }) => (Number(r.num) / Number(r.den)) * 4;
  const tempo = createTempoMap(performance.tempo);
  const written = new Map(performance.written.map((w) => [w.id, w]));
  return group(
    performance.sounding
      .filter((s) => s.velocity > 0)
      .map((s) => ({
        onset: q(s.position),
        seconds: tempo.secondsAt(s.position),
        note: {
          pitch: s.midi,
          duration: q(s.duration),
          velocity: s.velocity,
          seconds: tempo.secondsAt(add(s.position, s.duration)) - tempo.secondsAt(s.position),
          measure: performance.measures[written.get(s.writtenIds[0])!.ordinal].measureIndex,
        },
      })),
  );
}
const children = (e: XmlElement, tag?: string) =>
  e.childNodes.filter((n) => n.nodeType === 1 && (!tag || n.nodeName === tag)) as XmlElement[];
const text = (e: XmlElement, tag: string) => children(e, tag)[0]?.textContent;
export interface WrittenBar {
  index: number;
  number: string;
  patterns: string[];
  offsets: number[];
  features: string[];
  timingInterpretive: boolean;
}
export function xmlEvidence(xml: string): {
  bars: WrittenBar[];
  featureCounts: Record<string, number>;
} {
  const root = parseXML(xml).documentElement;
  if (root?.tagName !== 'score-partwise')
    throw Error('Oracle provenance requires score-partwise MusicXML.');
  const bars: {
    number: string;
    notes: { onset: number; seconds: number; note: OracleNote }[];
    features: Set<string>;
  }[] = [];
  const featureCounts: Record<string, number> = {
    parts: children(root, 'part').length,
    tabParts: children(root, 'part').filter((p) =>
      p.getElementsByTagName('clef').some((c) => text(c, 'sign') === 'TAB'),
    ).length,
  };
  const features = [
    'grace',
    'fermata',
    'arpeggiate',
    'tremolo',
    'staccato',
    'tenuto',
    'accent',
    'dynamics',
    'bend',
    'slide',
    'hammer-on',
    'pull-off',
    'harmonic',
    'other-technical',
    'slur',
    'tie',
    'unpitched',
    'harmony',
  ];
  for (const part of children(root, 'part')) {
    let divisions = 1,
      transpose = 0;
    for (const [index, m] of children(part, 'measure').entries()) {
      const bar = (bars[index] ??= {
        number: m.getAttribute('number') ?? String(index + 1),
        notes: [],
        features: new Set(),
      });
      bars[index] = bar;
      for (const f of features) {
        const count = m.getElementsByTagName(f).length;
        if (count) {
          bar.features.add(f);
          featureCounts[f] = (featureCounts[f] ?? 0) + count;
        }
      }
      let cursor = 0,
        previous = 0;
      for (const e of children(m)) {
        if (e.tagName === 'attributes') {
          const div = text(e, 'divisions');
          if (div) divisions = Number(div);
          const t = children(e, 'transpose')[0];
          if (t)
            transpose =
              Number(text(t, 'chromatic') ?? 0) + 12 * Number(text(t, 'octave-change') ?? 0);
          continue;
        }
        if (e.tagName === 'backup' || e.tagName === 'forward') {
          cursor +=
            ((e.tagName === 'backup' ? -1 : 1) * Number(text(e, 'duration') ?? 0)) / divisions;
          continue;
        }
        if (e.tagName !== 'note') continue;
        const duration = Number(text(e, 'duration') ?? 0) / divisions,
          chord = children(e, 'chord').length > 0;
        const onset = chord ? previous : cursor;
        const pitch = children(e, 'pitch')[0];
        const tied = children(e, 'tie').some((t) => t.getAttribute('type') === 'stop');
        if (pitch && !tied) {
          const step = text(pitch, 'step')!;
          const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
          const midi =
            (Number(text(pitch, 'octave')) + 1) * 12 +
            base[step] +
            Number(text(pitch, 'alter') ?? 0) +
            transpose;
          bar.notes.push({
            onset,
            seconds: 0,
            note: { pitch: midi, duration, velocity: 0, seconds: 0 },
          });
        }
        if (!chord) {
          previous = cursor;
          cursor += duration;
        }
      }
    }
  }
  return {
    bars: bars.map((b, index) => {
      const a = group(b.notes);
      return {
        index,
        number: b.number,
        patterns: a.map(signature),
        offsets: a.map((a) => a.onset),
        features: [...b.features].sort(),
        timingInterpretive: ['grace', 'fermata', 'arpeggiate', 'tremolo'].some((f) =>
          b.features.has(f),
        ),
      };
    }),
    featureCounts,
  };
}
/** Deterministic LCS on complete simultaneous pitch multisets. Missing/extra
 * groups remain failures; ambiguity never licenses substituting a pitch. */
export function alignAttacks(a: Attack[], b: Attack[]): [number, number][] {
  if ((a.length + 1) * (b.length + 1) > 8_000_000)
    throw Error('Oracle alignment exceeds eight million cells.');
  const x = a.map(signature),
    y = b.map(signature),
    width = y.length + 1,
    dp = new Uint32Array((x.length + 1) * width);
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      dp[i * width + j] =
        x[i] === y[j]
          ? 1 + dp[(i + 1) * width + j + 1]
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
  const matches: [number, number][] = [];
  let i = 0,
    j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      matches.push([i++, j++]);
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) i++;
    else j++;
  }
  return matches;
}
/** Independent XML fingerprints: no traversal is synthesized for silent or
 * identical written bars. Candidates are windows in the external recording. */
export function barEvidence(external: Attack[], bars: WrittenBar[]) {
  const keys = external.map(signature);
  const writtenKeys = bars.flatMap((b) => b.patterns);
  const occurrences = (pattern: string[]) =>
    writtenKeys.reduce(
      (n, _, i) => n + Number(pattern.every((p, j) => writtenKeys[i + j] === p)),
      0,
    );
  return external.map((_, from) => {
    const candidates = bars.filter(
      (b) =>
        b.patterns.length > 0 &&
        b.patterns.every((p, i) => keys[from + i] === p) &&
        (b.timingInterpretive ||
          b.offsets.every(
            (o, i) =>
              Math.abs(external[from + i].onset - external[from].onset - (o - b.offsets[0])) <=
              ONSET_TOLERANCE,
          )),
    );
    const max = Math.max(0, ...candidates.map((b) => b.patterns.length));
    const longest = candidates.filter((b) => b.patterns.length === max);
    const identifiable = longest.length === 1 && occurrences(longest[0].patterns) === 1;
    return {
      externalAttack: from,
      candidates: longest.map((b) => b.index),
      writtenMeasure: identifiable ? longest[0].index : null,
      windowAttacks: max,
      reason: identifiable
        ? 'unique-written-content'
        : max
          ? 'ambiguous-written-content'
          : 'no-complete-bar-fingerprint',
    };
  });
}
export function comparePerformances(
  ours: Attack[],
  external: Attack[],
  evidence: ReturnType<typeof xmlEvidence>,
) {
  const alignment = alignAttacks(ours, external),
    ownMatched = new Set(alignment.map((a) => a[0])),
    externalMatched = new Set(alignment.map((a) => a[1]));
  const ownKeys = ours.map(signature),
    extKeys = external.map(signature);
  const uniqueAnchor = (i: number, j: number) => {
    for (const radius of [0, 1, 2]) {
      if (i < radius || j < radius || i + radius >= ours.length || j + radius >= external.length)
        continue;
      const needle = ownKeys.slice(i - radius, i + radius + 1).join('|');
      if (needle !== extKeys.slice(j - radius, j + radius + 1).join('|')) continue;
      const count = (keys: string[]) =>
        keys.reduce(
          (n, _, k) => n + Number(keys.slice(k, k + radius * 2 + 1).join('|') === needle),
          0,
        );
      if (count(ownKeys) === 1 && count(extKeys) === 1) return true;
    }
    return false;
  };
  const bars = barEvidence(external, evidence.bars),
    timing: { ourAttack: number; externalAttack: number; status: string; delta?: number }[] = [],
    deltas: {
      ourAttack: number;
      externalAttack: number;
      pitch: number;
      durationQuarters: number;
      durationSeconds: number;
      velocity: number;
      onsetSeconds: number;
    }[] = [];
  let anchor = { own: 0, external: 0 },
    needsAnchor = false,
    lastI = -1,
    lastJ = -1;
  const excluded = new Set(evidence.bars.filter((b) => b.timingInterpretive).map((b) => b.index));
  for (const [i, j] of alignment) {
    if (i !== lastI + 1 || j !== lastJ + 1) needsAnchor = true;
    if (
      ours
        .slice(lastI + 1, i)
        .some((a) => a.notes.some((n) => n.measure !== undefined && excluded.has(n.measure)))
    )
      needsAnchor = true;
    const interpretive =
      ours[i].notes.some((n) => n.measure !== undefined && excluded.has(n.measure)) ||
      bars[j].candidates.some((m) => excluded.has(m));
    if (interpretive) {
      timing.push({ ourAttack: i, externalAttack: j, status: 'interpretive-region' });
      needsAnchor = true;
    } else if (needsAnchor) {
      if (uniqueAnchor(i, j)) {
        anchor = { own: ours[i].onset, external: external[j].onset };
        needsAnchor = false;
        timing.push({ ourAttack: i, externalAttack: j, status: 'independent-anchor' });
      } else timing.push({ ourAttack: i, externalAttack: j, status: 'unobservable-no-anchor' });
    } else {
      const delta = rounded(ours[i].onset - anchor.own - (external[j].onset - anchor.external));
      timing.push({
        ourAttack: i,
        externalAttack: j,
        status: Math.abs(delta) <= ONSET_TOLERANCE ? 'match' : 'mismatch',
        delta,
      });
    }
    const a = [...ours[i].notes].sort((a, b) => a.pitch - b.pitch),
      b = [...external[j].notes].sort((a, b) => a.pitch - b.pitch);
    a.forEach((n, k) =>
      deltas.push({
        ourAttack: i,
        externalAttack: j,
        pitch: n.pitch,
        durationQuarters: rounded(n.duration - b[k].duration),
        durationSeconds: rounded(n.seconds - b[k].seconds),
        velocity: n.velocity - b[k].velocity,
        onsetSeconds: rounded(ours[i].seconds - external[j].seconds),
      }),
    );
    lastI = i;
    lastJ = j;
  }
  const missing = ours.flatMap((a, i) =>
      ownMatched.has(i) ? [] : [{ attack: i, pitches: a.notes.map((n) => n.pitch) }],
    ),
    extra = external.flatMap((a, i) =>
      externalMatched.has(i) ? [] : [{ attack: i, pitches: a.notes.map((n) => n.pitch) }],
    );
  const barChecks = alignment.flatMap(([i, j]) => {
    const b = bars[j];
    if (b.writtenMeasure === null) return [];
    const measures = [
      ...new Set(ours[i].notes.map((n) => n.measure).filter((n) => n !== undefined)),
    ];
    return measures.length === 1
      ? [
          {
            ourAttack: i,
            externalAttack: j,
            externalMeasure: b.writtenMeasure,
            ourMeasure: measures[0],
            match: measures[0] === b.writtenMeasure,
          },
        ]
      : [];
  });
  const timingFailures = timing.filter((t) => t.status === 'mismatch');
  return {
    strict: {
      match:
        missing.length === 0 &&
        extra.length === 0 &&
        timingFailures.length === 0 &&
        barChecks.every((b) => b.match),
      pitchOrder: {
        match: missing.length === 0 && extra.length === 0,
        matchedGroups: alignment.length,
        missingFromExternal: missing,
        extraInExternal: extra,
      },
      timing: {
        toleranceQuarter: ONSET_TOLERANCE,
        checked: timing.filter((t) => t.status === 'match' || t.status === 'mismatch').length,
        mismatches: timingFailures,
        anchors: timing.filter((t) => t.status === 'independent-anchor'),
        excluded: timing.filter(
          (t) => t.status === 'interpretive-region' || t.status === 'unobservable-no-anchor',
        ),
      },
      bars: {
        checked: barChecks.length,
        mismatches: barChecks.filter((b) => !b.match),
        unobservableWritten: evidence.bars
          .filter(
            (b) =>
              !b.patterns.length ||
              evidence.bars.filter((o) => o.patterns.join('|') === b.patterns.join('|')).length > 1,
          )
          .map((b) => ({
            measure: b.index,
            reason: b.patterns.length ? 'identical-pitch-content' : 'silent',
          })),
        externalEvidence: bars,
      },
    },
    coverage: {
      ourGroups: ours.length,
      externalGroups: external.length,
      ourNotes: ours.reduce((n, a) => n + a.notes.length, 0),
      externalNotes: external.reduce((n, a) => n + a.notes.length, 0),
      matchedNotes: deltas.length,
      excludedWrittenSpans: evidence.bars
        .filter((b) => excluded.has(b.index))
        .map((b) => ({ measure: b.index, number: b.number, features: b.features })),
      sourceFeatures: evidence.featureCounts,
    },
    interpretive: {
      noteDeltas: deltas,
      scope:
        'Duration, velocity and wall-clock differences are deltas, not strict pitch/order verdicts. Raw MIDI cannot prove string identity, phase-preserving legato, harmonic timbre or palm-mute timbre.',
    },
  };
}
/** Small semantic receipt from MuseScore's own imported score, excluding random
 * element ids. This diagnoses importer/exporter differences, never builds a pass. */
export function musescoreImportedEvidence(xml: string) {
  const document = parseXML(xml);
  return {
    notePitches: document.getElementsByTagName('Note').map((n) => Number(text(n, 'pitch'))),
    zeroLengthPlaybackNotes: document
      .getElementsByTagName('Note')
      .filter((n) => n.getElementsByTagName('len').some((e) => e.textContent === '0'))
      .map((n) => Number(text(n, 'pitch'))),
    jumps: document
      .getElementsByTagName('Jump')
      .map((j) => ({
        jumpTo: text(j, 'jumpTo'),
        playUntil: text(j, 'playUntil'),
        continueAt: text(j, 'continueAt'),
      })),
    markers: document
      .getElementsByTagName('Marker')
      .map((m) => ({ label: text(m, 'label'), text: text(m, 'text') })),
    repeatCounts: document.getElementsByTagName('endRepeat').map((e) => Number(e.textContent)),
    voltaEndings: document.getElementsByTagName('Volta').map((e) => text(e, 'endings')),
  };
}
