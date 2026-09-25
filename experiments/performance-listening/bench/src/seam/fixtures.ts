/** Seam fixtures, not ladder rungs: a score with a repeat and a volta, played from the top,
 * and the same score started mid-way. A listener must follow each on the correct pass or
 * refuse at start. This is what stops "route 1 only" from reaching Studio unnoticed. */
import { readFileSync } from 'node:fs';
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import { rational as exact } from '../../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import type { Handoff } from '../../../listen/contract.ts';
import { topOfScore } from '../../../listen/positions.ts';
import { partIds } from '../../../listen/validate.ts';
import { ladderGolden, type LadderGolden } from '../ladder/goldens.ts';
import { mixSines, noteLabels, windowNotes, type RungZeroRecipe } from '../ladder/render.ts';
import type { Golden } from '../types.ts';

export const FIXTURE_SCORE = 'scenarios/lab/40-navigation/02-repeats-and-marks-on-tab/document.mnx.json';
const BPM = 60;
const PROFILE = Object.fromEntries(['melodic', 'polyphonic', 'harmonic', 'dynamics', 'rhythm', 'tempo', 'structuralAmbiguity', 'navigation']
  .map(k => [k, { level: 1, range: k === 'navigation' ? 'A repeat with a volta; performed in full' : 'Seam fixture, sine rendering' }])) as Golden['profile'];

export interface SeamFixture { id: string; score: MnxStructure; handoff: Handoff; audio: Float32Array; golden: LadderGolden }

export function seamFixtures(repoRoot: string): SeamFixture[] {
  const score = JSON.parse(readFileSync(`${repoRoot}/${FIXTURE_SCORE}`, 'utf8')) as MnxStructure;
  const compiled = compilePerformance(score);
  if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error('The seam fixture score must compile cleanly');
  const { measures } = compiled.performance, quarters = (r: { num: bigint; den: bigint }) => 4 * Number(r.num) / Number(r.den);
  if (!measures.some(m => m.occurrence > 1)) throw new Error('The seam fixture score must repeat');
  const end = quarters(measures.at(-1)!.position) + quarters(measures.at(-1)!.duration);
  const build = (id: string, ordinal: number): SeamFixture => {
    const fromQuarter = quarters(measures[ordinal]!.position);
    const recipe: RungZeroRecipe = { renderer: 'score-render@1', rung: 0, bpm: BPM, fromQuarter, toQuarter: end, sampleRate: 48000, peakDbfs: -12, rampSeconds: 0.01 };
    const toSample = (q: number) => Math.round((q - fromQuarter) * 60 / BPM * 48000), windowEnd = toSample(end), length = Math.ceil(windowEnd / 3) * 3;
    const notes = windowNotes(score, fromQuarter, end, toSample, windowEnd, 480);
    const audio = Float32Array.from(mixSines(notes, length, -12, 480, 48000), x => x / 32768);
    const golden = ladderGolden({ set: 'seam-fixtures', example: 'positive', recipe, duration: length / 48000, audioSha256: 'rendered at run time', score: FIXTURE_SCORE,
      notes: noteLabels(notes, recipe), profile: PROFILE, scoreOrigin: FIXTURE_SCORE });
    const from = ordinal === 0 ? topOfScore(compiled.performance) : { ordinal, metricOffset: measures[ordinal]!.from };
    return { id, score, handoff: { from, parts: partIds(score), tempo: { quartersPerMinute: exact(BigInt(BPM)) }, rate: 1 }, audio, golden };
  };
  return [build('repeat-and-volta-from-the-top', 0), build('start-mid-score', 1)];
}
