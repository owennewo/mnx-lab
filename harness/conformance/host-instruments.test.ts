// Choosing instruments on the synth's host (core-campaign-synth.md, Phase 6): the part
// router honours a factory design, a part rig and the old player's sound where they fit
// the part, says why where they do not, and a stored choice survives normalisation.
import { it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validateSetup, type Part } from '@mnx-lab/synth/contract';
import { compilePerformance } from '../../src/audio/performance.ts';
import { hostSetup, levelDb } from '../../src/audio/hostSetup.ts';
import { normalizeInstrument, parsePartRig } from '../../src/audio/hostInstruments.ts';
import type { PartRig } from '../../src/audio/partMix.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error plain mjs
import { loadCorpus } from '../verify/check-scenarios.mjs';

const scenario = (id: string) => {
  const s = (loadCorpus() as { id: string; dir: string }[]).find(x => x.id === id)!;
  const document = JSON.parse(fs.readFileSync(path.join(s.dir, 'document.mnx.json'), 'utf8')) as MnxStructure;
  const compiled = compilePerformance(document);
  if (!compiled.ok) throw new Error('fixture');
  return { document, performance: compiled.performance };
};
/** Guitar (part 0, strings) and keys (part 1). */
const blues = () => scenario('lab/document/twelve-bar-blues');
const guitarIndex = (document: MnxStructure) => document.parts.findIndex(p => p._x?.mnxLab?.strings?.length);
const keysIndex = (document: MnxStructure) => document.parts.findIndex(p => !p._x?.mnxLab?.strings?.length);
/** A part rig as the synth's Export part writes it (state.js partRig). */
const partRig = (instrument: Part['instrument'], extra: Partial<Part> = {}): PartRig => ({
  rig: '3.0.0', name: 'My sound',
  setup: { contract: 'mnx-sound/2', session: { buses: [{ id: 'room', type: 'room', state: 'on', params: {} }, { id: 'echo-bus', type: 'echo', params: {} }], master: {} },
    parts: [{ id: 'g', name: 'Guitar', instrument, chain: [{ id: 'drive', type: 'drive', state: 'on', params: { gain: 0.4 } }],
      strip: { levelDb: -3, pan: -0.25, mute: false, solo: false, sends: { room: 0.4, 'echo-bus': 0.2 } }, ...extra }] },
});
const guitarRig = () => partRig({ kind: 'plucked', design: 'soft-nylon', layout: { strings: [{ pitch: 62 }, { pitch: 57 }, { pitch: 53 }, { pitch: 50 }, { pitch: 45 }, { pitch: 40 }] } });

it('defaults: the guitar part plays Clear steel on its strings, the other part basic keys', () => {
  const { document, performance } = blues();
  const routed = hostSetup(performance, document);
  const g = routed.parts.find(p => p.partIndex === guitarIndex(document))!, k = routed.parts.find(p => p.partIndex === keysIndex(document))!;
  expect(g).toMatchObject({ kind: 'plucked', source: 'default', design: 'clear-steel', pluckable: true });
  expect(k).toMatchObject({ kind: 'keys', source: 'default', design: 'basic-piano', pluckable: false });
  expect(() => validateSetup(routed.setup)).not.toThrow();
});

it('a factory design plays where it fits, and says why where it does not', () => {
  const { document, performance } = blues(), gi = guitarIndex(document), ki = keysIndex(document);
  const routed = hostSetup(performance, document, { [gi]: { instrument: { kind: 'design', design: 'bridge-electric' } }, [ki]: { instrument: { kind: 'design', design: 'soft-nylon' } } });
  expect(routed.parts.find(p => p.partIndex === gi)).toMatchObject({ kind: 'plucked', source: 'design', design: 'bridge-electric' });
  expect(routed.setup.parts.find(p => p.id === `part${gi}`)!.instrument.design).toBe('bridge-electric');
  expect(routed.parts.find(p => p.partIndex === ki)).toMatchObject({ kind: 'keys', source: 'default' });
  expect(routed.diagnostics.map(d => d.partIndex)).toEqual([ki]);
  expect(routed.diagnostics[0]!.message).toMatch(/guitar design needs strings/);
  // The guitar part may play keys.
  const keys = hostSetup(performance, document, { [gi]: { instrument: { kind: 'design', design: 'basic-piano' } } });
  expect(keys.parts.find(p => p.partIndex === gi)).toMatchObject({ kind: 'keys', source: 'design' });
});

it('a part rig brings its instrument, chain and strip; the score keeps the strings; one room', () => {
  const { document, performance } = blues(), gi = guitarIndex(document);
  const routed = hostSetup(performance, document, { [gi]: { volume: 0.5, instrument: { kind: 'rig', rig: guitarRig() } } });
  const part = routed.setup.parts.find(p => p.id === `part${gi}`)!;
  expect(routed.parts.find(p => p.partIndex === gi)).toMatchObject({ kind: 'plucked', source: 'rig', rig: 'My sound', design: 'soft-nylon' });
  expect(part.chain).toEqual([{ id: 'drive', type: 'drive', state: 'on', params: { gain: 0.4 } }]);
  expect(part.strip).toMatchObject({ pan: -0.25, sends: { room: 0.4 } });
  expect(part.strip!.levelDb).toBeCloseTo(-3 + levelDb(0.5), 9);
  const strings = document.parts[gi]!._x!.mnxLab!.strings!;
  expect(part.instrument.layout!.strings.length, 'the score’s strings, not the rig’s').toBe(strings.length);
  expect(routed.setup.session.buses!.map(b => b.id)).toEqual(['room']);
  expect(routed.diagnostics[0]!.message).toMatch(/echo-bus are dropped/);
  expect(() => validateSetup(routed.setup)).not.toThrow();
  // A guitar rig cannot play the keys part; a keys rig can.
  const ki = keysIndex(document);
  const misfit = hostSetup(performance, document, { [ki]: { instrument: { kind: 'rig', rig: guitarRig() } } });
  expect(misfit.parts.find(p => p.partIndex === ki)).toMatchObject({ kind: 'keys', source: 'default' });
  const keysRig = partRig({ kind: 'keys', design: { id: 'basic-piano' } });
  expect(hostSetup(performance, document, { [ki]: { instrument: { kind: 'rig', rig: keysRig } } }).parts.find(p => p.partIndex === ki)).toMatchObject({ kind: 'keys', source: 'rig' });
});

it('the old player’s sound keeps a part off the host', () => {
  const { document, performance } = blues(), ki = keysIndex(document);
  const routed = hostSetup(performance, document, { [ki]: { sound: 'synth', instrument: { kind: 'sink' } } });
  expect(routed.parts.find(p => p.partIndex === ki)).toMatchObject({ kind: 'sink', source: 'sink' });
  expect(routed.setup.parts.map(p => p.id)).not.toContain(`part${ki}`);
  for (const v of performance.voices) expect(routed.partOf(v) === undefined).toBe(v.partIndex === ki);
});

it('rig files: a single-part rig 3.0.0 is accepted; anything else says why', () => {
  expect(parsePartRig(guitarRig())).toMatchObject({ ok: true, kind: 'plucked' });
  expect(parsePartRig({ ...guitarRig(), rig: '2.0.0' })).toMatchObject({ ok: false, message: expect.stringMatching(/rig 3\.0\.0/) });
  const two = guitarRig(); (two.setup.parts as object[]).push({ ...two.setup.parts[0], id: 'h' });
  expect(parsePartRig(two)).toMatchObject({ ok: false, message: expect.stringMatching(/2 parts/) });
  expect(parsePartRig({ rig: '3.0.0', name: 'x', setup: { contract: 'mnx-sound/2', session: {}, parts: [{ id: 'g' }] } })).toMatchObject({ ok: false });
  expect(parsePartRig('nope')).toMatchObject({ ok: false });
});

it('stored choices survive normalisation; damaged ones are dropped', () => {
  expect(normalizeInstrument({ kind: 'design', design: 'clear-steel' })).toEqual({ kind: 'design', design: 'clear-steel' });
  expect(normalizeInstrument({ kind: 'design', design: 'no spaces allowed' })).toBeUndefined();
  expect(normalizeInstrument({ kind: 'sink' })).toEqual({ kind: 'sink' });
  expect(normalizeInstrument({ kind: 'rig', rig: { rig: '3.0.0' } })).toBeUndefined();
  // A rig survives the JSON round trip storage makes (studio's normalizeParts calls this; the
  // studio-instruments smoke proves the choice survives a reload).
  expect(normalizeInstrument(JSON.parse(JSON.stringify({ kind: 'rig', rig: guitarRig() })))).toEqual({ kind: 'rig', rig: guitarRig() });
  expect(normalizeInstrument({ kind: 'bogus' })).toBeUndefined();
  expect(JSON.stringify(guitarRig()).length, 'a rig fits the library’s preferences many times over').toBeLessThan(64 * 1024 / 8);
});
