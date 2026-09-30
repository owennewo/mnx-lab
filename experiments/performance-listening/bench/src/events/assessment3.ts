/** Other-bars assessment instruments. Earlier instruments and listener outputs stay frozen. */
import type { ScorePosition } from '../../../listen/contract.ts';
import { samePosition } from '../../../listen/positions.ts';
import { expectedAssessment2, evaluateAssessment2, typicalTempo, THETA,
  type AssessmentReport2, type AssessmentEvaluation2, type ExpectedAssessment2, type Direction, type KindCounts } from './assessment2.ts';
import { type PerformanceLabel } from './label.ts';
export const REPORT_FORMAT_3 = 'assessment-report@3';
export const ASSESSMENT_EVALUATOR_3 = 'assessment-evaluator@3';
export interface BarSummary {
  ordinal: number; quartersPerMinute: number | null; reference: number | null;
  ratio: number | null; otherBars: number; eligible: boolean;
}
export interface BarTruth extends BarSummary { expected: Direction | 'none' | 'either' }
export interface AssessmentReport3 extends Omit<AssessmentReport2, 'format' | 'tempo'> {
  format: typeof REPORT_FORMAT_3;
  tempo: AssessmentReport2['tempo'] & { bars: BarSummary[] };
}
export interface ExpectedAssessment3 extends Omit<ExpectedAssessment2, 'bars'> { bars: BarTruth[] }
export interface AssessmentEvaluation3 extends Omit<AssessmentEvaluation2, 'evaluator' | 'expected'> {
  evaluator: typeof ASSESSMENT_EVALUATOR_3;
  expected: ExpectedAssessment3;
  barReports: { expected: number; matched: number; unreported: number; unexpected: number;
    errors: { ordinal: number; local: number | null; reference: number | null; ratio: number | null;
      otherBarsCorrect: boolean; eligibleCorrect: boolean }[] };
}
export interface BarInterval { ordinal: number; seconds: number; quarters: number; quartersPerMinute: number }
/** Applies endpoint attribution; each reference excludes all of its own intervals. */
export function summarizeBars(ordinals: readonly number[], intervals: readonly BarInterval[]): BarSummary[] {
  return [...new Set(ordinals)].sort((a,b) => a-b).map(ordinal => {
    const own = intervals.filter(i => i.ordinal === ordinal), other = intervals.filter(i => i.ordinal !== ordinal);
    const quartersPerMinute = own.length ? 60 * own.reduce((s,i) => s+i.quarters,0) / own.reduce((s,i) => s+i.seconds,0) : null;
    const reference = typicalTempo(other), otherBars = new Set(other.map(i => i.ordinal)).size;
    return { ordinal, quartersPerMinute, reference, ratio: quartersPerMinute !== null && reference !== null ? quartersPerMinute/reference : null,
      otherBars, eligible: quartersPerMinute !== null && reference !== null && otherBars >= 3 };
  });
}
const flagOf=(b:BarSummary):BarTruth['expected']=> {
  if(!b.eligible || b.ratio===null)return 'none';
  const r=b.ratio;
  if(r<=1-THETA || Math.abs(r-(1-THETA))<=1e-12)return 'slow';
  if(r>=1+THETA || Math.abs(r-(1+THETA))<=1e-12)return 'fast';
  const distance=Math.abs(r-1);
  return distance<THETA/2 && Math.abs(distance-THETA/2)>1e-12?'none':'either';
};
export function expectedAssessment3(label: PerformanceLabel): ExpectedAssessment3 {
  const base = expectedAssessment2(label);
  const bars = summarizeBars(label.events.map(e=>e.at.ordinal),base.intervals.map(i=>({...i,ordinal:label.events[i.to]!.at.ordinal})))
    .map((b): BarTruth => ({...b, expected:flagOf(b)}));
  const clean = base.notes.every(n=>n.outcome==='matched') && label.performance.extras.length===0 && bars.every(b=>b.ratio===null || Math.abs(b.ratio-1)<THETA/2 && Math.abs(Math.abs(b.ratio-1)-THETA/2)>1e-12);
  return {...base,bars,clean};
}
/** An assessor may derive its informational bar summaries from its own report intervals.
 * This helper sees score events only, never actual performance labels. */
export function reportedBars(events: readonly { at: ScorePosition; quarter: number }[], intervals: AssessmentReport2['tempo']['intervals']): BarSummary[] {
  const converted = intervals.map(i=> {
    const from = events.find(e=>samePosition(e.at,i.from)), to = events.find(e=>samePosition(e.at,i.to));
    if(!from || !to || !(to.quarter>from.quarter) || !Number.isFinite(i.seconds) || !(i.seconds>0)) throw new Error('Invalid reported interval');
    const quarters=to.quarter-from.quarter;
    return {ordinal:to.at.ordinal,quarters,seconds:i.seconds,quartersPerMinute:60*quarters/i.seconds};
  });
  return summarizeBars(events.map(e=>e.at.ordinal),converted);
}
export function evaluateAssessment3(label: PerformanceLabel, report: AssessmentReport3): AssessmentEvaluation3 {
  if(report.format!==REPORT_FORMAT_3) throw new Error('Unknown assessment report format');
  for(const b of report.tempo.bars) {
    if(!Number.isInteger(b.ordinal) || b.ordinal<0 || !Number.isInteger(b.otherBars) || b.otherBars<0 || typeof b.eligible!=='boolean' ||
      ![b.quartersPerMinute,b.reference,b.ratio].every(n=>n===null || Number.isFinite(n) && n>0)) throw new Error('Malformed reported bar');
  }
  // Reuse unchanged note/duration/overall measurement, without passing new flags to the old truth.
  const base=evaluateAssessment2(label,{...report,format:'assessment-report@2',tempo:{...report.tempo,flags:[]}});
  const expected=expectedAssessment3(label), flagged=new Set(report.tempo.flags.map(f=>`${f.ordinal}:${f.direction}`));
  const count=(direction:Direction):KindCounts=> {
    const c={positives:0,detected:0,negatives:0,falseAlarms:0};
    for(const b of expected.bars) {
      const hit=flagged.has(`${b.ordinal}:${direction}`);
      if(b.expected===direction) {c.positives++; if(hit)c.detected++;}
      else if(b.expected!=='either') {c.negatives++;if(hit)c.falseAlarms++;}
    }
    return c;
  };
  const slow=count('slow'),fast=count('fast');
  const placed=new Map<number,BarSummary>();let unexpected=0;
  for(const b of report.tempo.bars) {
    if(!expected.bars.some(t=>t.ordinal===b.ordinal)||placed.has(b.ordinal))unexpected++;
    else placed.set(b.ordinal,b);
  }
  const delta=(actual:number|null,truth:number|null)=>actual===null || truth===null ? null : actual-truth;
  const errors=expected.bars.flatMap(b=> {
    const r=placed.get(b.ordinal);return r?[{ordinal:b.ordinal,local:delta(r.quartersPerMinute,b.quartersPerMinute),reference:delta(r.reference,b.reference),ratio:delta(r.ratio,b.ratio),
      otherBarsCorrect:r.otherBars===b.otherBars,eligibleCorrect:r.eligible===b.eligible}]:[];
  });
  return {...base,evaluator:ASSESSMENT_EVALUATOR_3,expected,clean:expected.clean,
    flags:{slow,fast,unplaced:report.tempo.flags.filter(f=>!expected.bars.some(b=>b.ordinal===f.ordinal)).length},
    falseFindings:base.falseFindings+slow.falseAlarms+fast.falseAlarms,
    tempoClaims:base.tempoClaims+report.tempo.flags.length,
    barReports:{expected:expected.bars.length,matched:errors.length,unreported:expected.bars.length-errors.length,unexpected,errors}};
}
