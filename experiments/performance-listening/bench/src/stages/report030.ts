/** Lossless format promotion for diagnostic remeasurement, never a flag-policy repair. */
import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { positionFromJSON } from '../../../listen/json.ts';
import type { AssessmentReport2 } from '../events/assessment2.ts';
import { reportedBars, REPORT_FORMAT_3, type AssessmentReport3 } from '../events/assessment3.ts';
import { scoreEvents } from '../events/label.ts';

export function promoteReport030(report: AssessmentReport2, score: MnxStructure): AssessmentReport3 {
  const compiled = compilePerformance(score);
  if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error('Score does not compile cleanly');
  const events = scoreEvents(compiled.performance).map(e => ({ at: positionFromJSON(e.at), quarter: e.quarter }));
  const clone = structuredClone(report);
  return { ...clone, format: REPORT_FORMAT_3, tempo: { ...clone.tempo, bars: reportedBars(events, clone.tempo.intervals) } };
}
