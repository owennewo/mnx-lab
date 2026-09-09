import fs from 'node:fs';
import { expect, it } from 'vitest';
import { compilePerformance } from '../../src/audio/performance.ts';
import { DYNAMIC_VELOCITIES } from '../../src/audio/expression.ts';
import { Transport, centsAt, type Clock } from '../../src/audio/transport.ts';
import { exportMidi } from '../../src/audio/midiFile.ts';
import { rational as q } from '../../src/audio/time.ts';
import type { MnxStructure, MnxEvent, MnxTabTechnique, MnxDynamic } from '../../src/model/mnx.ts';
import type { Sink, SinkEvent } from '../../src/audio/sink.ts';
const note = (id: string, alter = 0, technique?: MnxTabTechnique): MnxEvent => ({
  duration: { base: 'quarter' },
  notes: [
    {
      id,
      pitch: { step: 'C', octave: 4, alter },
      _x: { mnxLab: { string: 1, tab: { technique } } },
    },
  ],
});
const doc = (events: MnxEvent[], dynamics: MnxDynamic[] = []): MnxStructure => ({
  global: { measures: [{ id: 'm1', time: { count: 4, unit: 4 } }] },
  parts: [
    {
      _x: {
        mnxLab: { strings: [{ string: 1, pitch: { step: 'C', octave: 3 } }] },
      },
      measures: [{ dynamics, sequences: [{ voice: 'upper', content: events }] }],
    },
  ],
});
const compile = (d: MnxStructure) => {
  const r = compilePerformance(d);
  if (!r.ok) throw Error(JSON.stringify(r.diagnostics));
  return r.performance;
};
const dynamic = (value: MnxDynamic['value'], at = 0): MnxDynamic => ({
  type: 'immediate',
  value,
  position: { fraction: [at, 4] },
});
it('pins the velocity ladder and clamps accents; niente stays silent', () => {
  expect(Object.values(DYNAMIC_VELOCITIES)).toEqual([
    8, 16, 24, 32, 44, 56, 68, 80, 96, 108, 116, 120, 124, 127, 0,
  ]);
  const a = note('a');
  a.markings = { accent: {} };
  expect(
    compile(doc([a, note('b')], [dynamic('ffffff'), dynamic('n', 1)])).sounding.map(
      (s) => s.velocity,
    ),
  ).toEqual([127, 0]);
});
it('restores written dynamic state on a repeat and keeps sfz a one-event attack', () => {
  const d = doc(
    [note('a'), note('b')],
    [
      dynamic('p'),
      {
        type: 'accent',
        value: 'f',
        accentPrefix: 's',
        accentSuffix: 'z',
        position: { fraction: [1, 4] },
      },
    ],
  );
  d.global!.measures![0].repeatStart = {};
  d.global!.measures![0].repeatEnd = { times: 2 };
  expect(compile(d).sounding.map((s) => s.velocity)).toEqual([56, 96, 56, 96]);
});
it('accent residual state persists and scoped dynamics leave other voices alone', () => {
  const d = doc(
    [note('a'), note('b')],
    [
      {
        type: 'accent',
        value: 'f',
        residualValue: 'p',
        voice: 'upper',
        position: { fraction: [0, 1] },
      },
    ],
  );
  d.parts[0].measures[0].sequences!.push({
    voice: 'lower',
    content: [
      {
        duration: { base: 'half' },
        notes: [{ id: 'other', pitch: { step: 'E', octave: 4 } }],
      },
    ],
  });
  const p = compile(d);
  expect(p.sounding.find((s) => s.writtenIds[0] === 'w0:a')!.velocity).toBe(96);
  expect(p.sounding.find((s) => s.writtenIds[0] === 'w0:b')!.velocity).toBe(56);
  expect(p.sounding.find((s) => s.writtenIds[0] === 'w0:other')!.velocity).toBe(80);
});
it('samples a cross-bar hairpin in exact written metric time and restores it on repeats', () => {
  const d = doc(
    [note('a'), note('b')],
    [
      dynamic('mf'),
      {
        type: 'gradual',
        wedgeType: 'decreasing',
        position: { fraction: [0, 1] },
        end: { measure: 'm2', position: { fraction: [1, 4] } },
      },
    ],
  );
  d.global!.measures!.push({ id: 'm2' });
  d.parts[0].measures.push({
    sequences: [{ content: [note('c'), note('d')] }],
  });
  expect(compile(d).sounding.map((s) => s.velocity)).toEqual([80, 73, 67, 60]);
});
it('interrupts a hairpin at the next relative mark and diagnoses missing ends', () => {
  const d = doc(
    [note('a'), note('b'), note('c')],
    [
      dynamic('mf'),
      {
        type: 'gradual',
        position: { fraction: [0, 1] },
        end: { measure: 'm1', position: { fraction: [1, 2] } },
      },
      {
        type: 'relative',
        relativeValue: 'softer',
        position: { fraction: [1, 4] },
      },
    ],
  );
  expect(compile(d).sounding.map((s) => s.velocity)).toEqual([80, 78, 78]);
  d.parts[0].measures[0].dynamics![1].end = undefined;
  expect(compile(d).diagnostics.some((d) => d.code === 'unsupported-dynamic')).toBe(true);
});
it('shortens staccato, preserves tenuto and written cursor spans, and combines palm mute', () => {
  const a = note('a', 0, { palmMute: true });
  a.markings = { staccato: {}, accent: {} };
  const b = note('b');
  b.markings = { tenuto: {} };
  const p = compile(doc([a, b]));
  expect(p.sounding.map((s) => s.duration)).toEqual([q(3n, 40n), q(1n, 4n)]);
  expect(p.written[0].duration).toEqual(q(1n, 4n));
  expect(p.sounding[0]).toMatchObject({ velocity: 85, damped: true });
});
it('alternates tremolo velocity without moving its subdivision grid', () => {
  const a = note('a');
  a.markings = { tremolo: { marks: 2 } };
  expect(compile(doc([a])).sounding.map((s) => [s.position, s.velocity])).toEqual([
    [q(0n), 84],
    [q(1n, 16n), 76],
    [q(1n, 8n), 84],
    [q(3n, 16n), 76],
  ]);
});
it.each(['up', 'down'] as const)(
  'rolls only the marked chord span %s in exact 64ths',
  (direction) => {
    const a = note('a');
    a.notes!.push(
      { id: 'b', pitch: { step: 'E', octave: 4 } },
      { id: 'c', pitch: { step: 'G', octave: 4 } },
    );
    const d = doc([a]);
    d.parts[0].measures[0].arpeggios = [
      {
        position: { fraction: [0, 1] },
        span: { start: 'a', end: 'c' },
        direction,
      },
    ];
    const p = compile(d);
    expect(p.sounding.map((s) => s.midi)).toEqual(direction === 'up' ? [60, 64, 67] : [67, 64, 60]);
    expect(p.sounding.map((s) => s.position)).toEqual([q(0n), q(1n, 64n), q(1n, 32n)]);
    expect(p.written.every((w) => w.position.num === 0n)).toBe(true);
  },
);
it('preserves pre-bend, release and decimal breakpoints and composes tempo-relative vibrato', () => {
  const s = compile(
    doc([
      note('a', 0, {
        bend: {
          points: [
            { position: 0, alter: 2 },
            { position: 0.25, alter: 2 },
            { position: 1, alter: 0 },
          ],
        },
        vibrato: true,
      }),
    ]),
  ).sounding[0];
  expect(s.curve[0]).toEqual({
    kind: 'bend',
    points: [
      { offset: q(0n), cents: 200 },
      { offset: q(1n, 16n), cents: 200 },
      { offset: q(1n, 4n), cents: 0 },
    ],
  });
  expect(s.curve[1]).toEqual({
    kind: 'vibrato',
    offset: q(1n, 16n),
    duration: q(3n, 16n),
    period: q(1n, 10n),
    depthCents: 30,
  });
  expect(centsAt(s, q(0n))).toBe(200);
  expect(centsAt({ ...s, curve: [s.curve[1]] }, q(7n, 80n))).toBeCloseTo(30);
});
it.each([
  ['slideIn', 'up', -200],
  ['slideIn', 'down', 200],
  ['slideOut', 'down', 0],
] as const)('interprets %s %s', (type, direction, initial) => {
  const s = compile(doc([note('a', 0, { slide: { type, direction } })])).sounding[0];
  expect(centsAt(s, q(0n))).toBe(initial);
  expect(centsAt(s, q(1n, 4n))).toBe(type === 'slideOut' ? -200 : 0);
});
it('connects a target slide and a hammer chain as logical transitions, and rejects unrelated voices', () => {
  const p = compile(
    doc([
      note('a', 0, { slide: { type: 'legato', target: 'b' } }),
      note('b', 2, { hammerPull: { target: 'c' } }),
      note('c', 4),
    ]),
  );
  expect(p.sounding.map((s) => s.noReattack ?? false)).toEqual([false, true, true]);
  expect(p.sounding[2].velocity).toBe(55);
  expect(centsAt(p.sounding[0], q(1n, 4n))).toBe(200);
  const d = doc([note('a', 0, { hammerPull: { target: 'b' } }), note('b', 2)]);
  delete d.parts[0].measures[0].sequences![0].content[1].notes![0]._x;
  expect(compile(d).sounding[1].noReattack).toBeUndefined();
  expect(compile(d).diagnostics.some((d) => d.code === 'unresolved-technique-target')).toBe(true);
});
it.each([
  ['natural', 0, true, true, 60, undefined],
  ['natural', 2, true, true, 62, undefined],
  ['natural', 0, true, true, 72, 'inconsistent-harmonic'],
  ['natural', 0, false, true, 72, 'unsupported-harmonic-validation'],
  ['natural', 0, true, false, 72, 'unsupported-harmonic-validation'],
  ['artificial', 0, true, true, 72, 'unsupported-harmonic-validation'],
] as const)(
  'preserves sounded MIDI for %s capo=%s string=%s touching=%s',
  (type, capo, string, touching, midi, diagnostic) => {
    const e = note('a', midi - 60, {
      harmonic: {
        type,
        ...(touching ? { touchingPitch: { step: 'C', octave: 4, alter: capo } } : {}),
      },
    });
    if (!string) delete e.notes![0]._x!.mnxLab!.string;
    const d = doc([e]);
    d.parts[0]._x!.mnxLab!.capo = capo;
    const p = compile(d);
    expect(p.sounding[0]).toMatchObject({
      midi,
      velocity: 70,
      timbre: ['harmonic'],
    });
    expect(p.diagnostics.filter((d) => d.code.includes('harmonic')).map((d) => d.code)).toEqual(
      diagnostic ? [diagnostic] : [],
    );
  },
);
it('preserves already resolved converter harmonic pitches', () => {
  const d = JSON.parse(
    fs.readFileSync(
      'scenarios/lab/25-tab-techniques/05-natural-harmonics/document.mnx.json',
      'utf8',
    ),
  );
  expect(compile(d).sounding.map((s) => s.midi)).toEqual([52, 57]);
});
it('schedules one envelope attack through a compiled hammer and reconstructs on seek', async () => {
  const p = compile(doc([note('a', 0, { hammerPull: { target: 'b' } }), note('b', 2)]));
  const actions: SinkEvent[] = [];
  const clock: Clock = {
    now: () => 0,
    setTimeout: () => 0,
    clearTimeout: () => {},
  };
  const sink: Sink = {
    now: () => 0,
    unlock: async () => {},
    schedule: (events) => actions.push(...events),
    cancel: () => {
      actions.length = 0;
    },
    release: () => {},
    bend: () => {},
    dispose: () => {},
  };
  const t = new Transport(p, clock, sink, { lookaheadSeconds: 2 });
  await t.play();
  expect(actions.filter((e) => e.kind === 'attack')).toHaveLength(1);
  expect(actions.find((e) => e.kind === 'pitch')).toMatchObject({
    velocity: 55 / 127,
  });
  t.seek(q(1n, 4n));
  expect(actions.some((e) => e.kind === 'attack' && Math.abs(e.hz - 293.664768) < 0.001)).toBe(
    true,
  );
  t.dispose();
  const midi = exportMidi(p);
  expect(midi.ok).toBe(true);
  expect(midi.diagnostics.some((d) => d.code === 'omitted-voice-expression')).toBe(true);
});
it('exports independent string bends and reports clipping beyond twelve semitones', () => {
  const p = compile(
    doc([
      note('a', 0, {
        bend: {
          points: [
            { position: 0, alter: 14 },
            { position: 1, alter: 0 },
          ],
        },
      }),
    ]),
  );
  const midi = exportMidi(p);
  expect(midi.ok).toBe(true);
  if (midi.ok) expect(midi.allocation[0].independent).toBe(true);
  expect(midi.diagnostics.some((d) => d.code === 'bend-clipped')).toBe(true);
});
it('alternates velocity across both members of a two-note tremolo', () => {
  const d = doc([]);
  d.parts[0].measures[0].sequences![0].content = [
    {
      type: 'tremolo',
      marks: 2,
      outer: { duration: { base: 'quarter' }, multiple: 1 },
      content: [note('a'), note('b', 4)],
    },
  ];
  expect(compile(d).sounding.map((s) => s.velocity)).toEqual([84, 76, 84, 76]);
});
it('recognizes explicit SMuFL ladder and sforzato glyphs without persisting the spike', () => {
  const d = doc(
    [note('a'), note('b'), note('c')],
    [
      {
        type: 'immediate',
        glyphs: ['dynamicPPPP'],
        position: { fraction: [0, 1] },
      },
      {
        type: 'immediate',
        glyphs: ['dynamicSforzato'],
        position: { fraction: [1, 4] },
      },
    ],
  );
  expect(compile(d).sounding.map((s) => s.velocity)).toEqual([24, 96, 24]);
});

it('omits niente from MIDI instead of raising it to an audible velocity', () => {
  const p = compile(doc([note('a')], [dynamic('n')]));
  const midi = exportMidi(p);
  expect(midi.ok).toBe(true);
  expect(midi.diagnostics.some((d) => d.code === 'silent-note')).toBe(true);
});
it('preserves the converter-resolved Vestapol harmonics at their hand-stated MIDI pitches', () => {
  const d = JSON.parse(fs.readFileSync('converters/fixtures/Vestapol.mnx.json', 'utf8'));
  const p = compile(d);
  for (const [key, midi] of [
    ['n102', 66],
    ['n103', 69],
    ['n104', 74],
    ['n725', 50],
    ['n726', 57],
    ['n727', 62],
    ['n728', 66],
    ['n729', 69],
    ['n730', 74],
  ] as const) {
    const occurrences = p.written.filter((w) => w.noteKey === key);
    expect(occurrences.length, key).toBeGreaterThan(0);
    for (const w of occurrences)
      for (const id of w.soundingIds) {
        const sound = p.sounding.find((s) => s.id === id)!;
        expect(sound.midi, key).toBe(midi);
        expect(sound.timbre, key).toContain('harmonic');
      }
  }
});
