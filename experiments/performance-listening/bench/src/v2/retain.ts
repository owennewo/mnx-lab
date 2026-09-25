import { round } from '../types.ts';
import { evaluateV2 } from './evaluate.ts';
import { evidenceHolds } from './validate.ts';
import { reservedHolds, type PartitionRegistry } from './partitions.ts';
import type { Bounds, GoldenV2, RecordedRun } from './types.ts';
export interface Gate { example: string; name: string; outcome: 'pass' | 'fail' | 'uncertain'; observed: Bounds | null; threshold: number }
export interface Retention {
  rule: 'research-contract-1@1'; decision: 'provisional' | 'retain' | 'reject' | 'inconclusive' | 'stop-no-headroom';
  gates: Gate[]; holds: string[]; improvement: { absolute: Bounds; relative: Bounds | null } | null;
  recovery: 'measured' | 'untested'; next: string;
}
const EPS = 1e-9;
const exact = (n: number): Bounds => ({ lower:n, upper:n });
const valid = (b: Bounds | null) => b === null || Number.isFinite(b.lower) && Number.isFinite(b.upper) && b.lower >= 0 && b.upper >= b.lower;
export function compareV2(base: RecordedRun, candidate: RecordedRun, goldens: GoldenV2[], registry?: PartitionRegistry): Retention {
  if (!goldens.length || base.setHash !== candidate.setHash || base.instrumentHash !== candidate.instrumentHash || !/^[a-f0-9]{64}$/.test(base.setHash) || !/^[a-f0-9]{64}$/.test(base.instrumentHash)) throw new Error('Comparison must use the same frozen set and instrument');
  const ids = goldens.map(g => g.example);
  if (new Set(ids).size !== ids.length || [base,candidate].some(run => run.measurements.length !== ids.length || new Set(run.measurements.map(m=>m.evaluation.example)).size !== ids.length || run.measurements.some(m=>!ids.includes(m.evaluation.example)))) throw new Error('Comparison examples differ');
  const partitions = new Set(goldens.map(g=>g.partition));
  if (partitions.size !== 1 || partitions.has('acceptance')) throw new Error('Final acceptance is separate from selection/retention');
  const reserved = partitions.has('reserved');
  const gates: Gate[] = [], holds = goldens.flatMap(evidenceHolds);
  const gate = (example: string, name: string, observed: Bounds | null, threshold: number, direction: 'min'|'max') => {
    if (!valid(observed)) throw new Error(`Invalid measurement: ${example}/${name}`);
    const pass = observed && (direction === 'min' ? observed.lower >= threshold-EPS : observed.upper <= threshold+EPS);
    const fail = observed && (direction === 'min' ? observed.upper < threshold-EPS : observed.lower > threshold+EPS);
    gates.push({ example, name, observed, threshold, outcome: pass ? 'pass' : fail ? 'fail' : 'uncertain' });
  };
  const ratios: { group: string; base: Bounds; candidate: Bounds }[] = [];
  const positive = goldens.filter(g=>g.role === 'positive');
  if (!positive.length) holds.push('No positive real-source example');
  if (!goldens.some(g=>g.role === 'silence')) holds.push('Synthetic silence control missing');
  for (const g of positive) if (!goldens.some(other=>other.role === 'wrong-score' && other.audio.sha256 === g.audio.sha256 && other.intended.scoreSha256 !== g.intended.scoreSha256)) holds.push(`${g.example}: paired wrong-score control missing`);
  // Distinct strings alone are insufficient: any shared piece/performer/session connects groups.
  if (reserved) {
    const components = positive.map(g=>new Set([`piece:${g.group.piece}`,`performer:${g.group.performer}`,`session:${g.group.session}`]));
    for (let i=0;i<components.length;i++) for (let j=i+1;j<components.length;) {
      if ([...components[j]!].some(k=>components[i]!.has(k))) { for (const k of components[j]!) components[i]!.add(k); components.splice(j,1); j=i+1; } else j++;
    }
    if (components.length < 3) holds.push('Reserved evidence requires at least three independent connected groups');
    if (!goldens.some(g=>g.role==='room-noise')) holds.push('Reviewed real room-noise control missing');
    if (!goldens.some(g=>g.role==='interruption' && g.recoveries.length)) holds.push('Reviewed interruption/recovery evidence missing');
    holds.push(...reservedHolds(registry,base,candidate,goldens));
  }
  for (const g of goldens) {
    const a = base.measurements.find(m=>m.evaluation.example===g.example)!, b = candidate.measurements.find(m=>m.evaluation.example===g.example)!;
    const expectedId = evaluateV2(g,[]).evidenceId;
    if (a.evaluation.evidenceId !== expectedId || b.evaluation.evidenceId !== expectedId || a.evaluation.evaluator !== 'following-evaluator@2' || b.evaluation.evaluator !== 'following-evaluator@2') throw new Error('Mismatched example evidence/evaluator');
    const e=b.evaluation, p=a.evaluation;
    for (const item of [e,p]) {
      for (const b of [item.supportedCorrect,item.rejection,item.coverage,item.deadlineMiss,item.exposure.fraction]) if (!valid(b) || b && b.upper > 1+EPS) throw new Error('Invalid measured fraction');
      if (!Number.isFinite(item.referenceCoverage) || item.referenceCoverage<0 || item.referenceCoverage>1) throw new Error('Invalid reference coverage');
    }
    if (!a.causality.pass || a.causality.checks<1) holds.push(`${g.example}: comparator causality is unestablished`);
    if (g.role === 'positive' || g.role === 'interruption') {
      if (e.referenceCoverage < .8 - EPS) holds.push(`${g.example}: less than 80% answerable reference time; evidence cannot support promotion`);
      gate(g.example,'supported correctness',e.supportedCorrect,.95,'min');
    }
    if (g.role !== 'positive') gate(g.example,'unsupported rejection',e.rejection,.95,'min');
    gate(g.example,'decision coverage',e.coverage,.98,'min');
    gate(g.example,'wrong/false exposure',e.exposure.fraction,.05,'max');
    gate(g.example,'longest wrong/false episode',e.exposure.longestSeconds,.5,'max');
    gate(g.example,'deadline misses',e.deadlineMiss,.1,'max');
    if (!Number.isSafeInteger(b.causality.checks) || b.causality.checks < 1) holds.push(`${g.example}: causality checks missing`);
    else gate(g.example,'prefix causality',exact(b.causality.pass ? 1 : 0),1,'min');
    if (b.cost.machine !== 'williao-G3-3579') holds.push(`${g.example}: processing not measured on the contract laptop`);
    gate(g.example,'sustained processing',exact(b.cost.sustainedRatio),.25,'max');
    gate(g.example,'chunk p99 ms',exact(b.cost.p99Ms),10,'max');
    if (!Number.isFinite(b.cost.maxBacklogMs) || b.cost.maxBacklogMs < 0) throw new Error('Maximum backlog must be reported');
    for (const r of e.recovery) gate(g.example,`recovery from ${r.at}`,r.seconds,2,'max');
    for (const key of ['supportedCorrect','rejection','deadlineMiss'] as const) {
      const old=p[key], next=e[key];
      if (old === null && next === null) continue;
      const change = old && next ? key === 'deadlineMiss' ? { lower:next.lower-old.upper, upper:next.upper-old.lower } : { lower:old.lower-next.upper,upper:old.upper-next.lower } : null;
      // Regressions may be negative. Shift by one so the common nonnegative gate applies.
      gate(g.example,`${key} regression + 1`,change ? { lower:1+change.lower,upper:1+change.upper } : null,1.02,'max');
    }
    if (p.exposure.fraction && e.exposure.fraction) ratios.push({ group:g.group.piece,base:p.exposure.fraction,candidate:e.exposure.fraction });
  }
  let improvement: Retention['improvement'] = null;
  if (ratios.length === goldens.length) {
    const groups = [...new Set(ratios.map(r=>r.group))];
    const means = (run:'base'|'candidate',side:'lower'|'upper') => groups.reduce((sum,group)=>{const rows=ratios.filter(r=>r.group===group);return sum+rows.reduce((s,r)=>s+r[run][side],0)/rows.length;},0)/groups.length;
    const lo=means('base','lower'),hi=means('base','upper'),clo=means('candidate','lower'),chi=means('candidate','upper');
    if (hi <= EPS && !holds.length && gates.every(g=>g.outcome==='pass')) return { rule:'research-contract-1@1',decision:'stop-no-headroom',gates,holds,improvement:null,recovery:goldens.some(g=>g.recoveries.length)?'measured':'untested',next:'Stop: comparator has zero exposure; a different objective requires a new approved question.' };
    if (hi <= EPS) holds.push('Comparator has no exposure headroom; evidence holds or failed gates take precedence');
    improvement = { absolute:{lower:round(lo-chi),upper:round(hi-clo)},relative:lo>0?{lower:round((lo-chi)/lo),upper:round((hi-clo)/hi)}:null };
    // Shift potentially negative improvement into the nonnegative gate domain.
    gate('all','absolute exposure improvement + 1',{lower:1+improvement.absolute.lower,upper:1+improvement.absolute.upper},1.05,'min');
    gate('all','relative exposure improvement + 1',improvement.relative?{lower:Math.max(0,1+improvement.relative.lower),upper:Math.max(0,1+improvement.relative.upper)}:null,1.25,'min');
  } else holds.push('Missing answerable exposure denominator');
  const decision = gates.some(g=>g.outcome==='fail') ? 'reject' : holds.length || gates.some(g=>g.outcome==='uncertain') ? 'inconclusive' : reserved ? 'retain' : 'provisional';
  return { rule:'research-contract-1@1',decision,gates,holds,improvement,recovery:goldens.some(g=>g.recoveries.length)?'measured':'untested',next:decision==='reject'?'Record the definite failures; use the remaining approved budget or stop under the batch rule.':decision==='inconclusive'?'Resolve the named evidence/instrument holds before promotion; do not tune against unknown labels.':'Development gates passed. Apply the same frozen candidate to the next reviewed window; formal retention still needs independent reserved evidence.' };
}
