import type { Retention } from './retain.ts';
export interface BatchState {
  contract: 'research-contract-1'; instrumentChecked: boolean; evidenceHolds: string[];
  candidateVersions: string[]; assessments: { id: string; candidate: string; cpuSeconds: number; result: Retention | null; infrastructureFailure: string | null }[];
  research: { questions: string[]; sources: string[] };
}
/** Pure, reviewable loop procedure. No automatic loosening, data relabelling or tuning. */
export function nextAction(s: BatchState): { action: string; reason: string; remaining: { versions: number; assessments: number; cpuSeconds: number; sources: number; questions: number } } {
  if(s.contract!=='research-contract-1' || new Set(s.candidateVersions).size!==s.candidateVersions.length || new Set(s.assessments.map(a=>a.id)).size!==s.assessments.length || s.assessments.some(a=>!s.candidateVersions.includes(a.candidate)||!Number.isFinite(a.cpuSeconds)||a.cpuSeconds<0)) throw new Error('Invalid batch history');
  const remaining={versions:6-s.candidateVersions.length,assessments:12-s.assessments.length,cpuSeconds:7200-s.assessments.reduce((n,a)=>n+a.cpuSeconds,0),sources:6-s.research.sources.length,questions:2-s.research.questions.length};
  if(Object.values(remaining).some(n=>n<0))throw new Error('Approved budget exceeded');
  const answer=(action:string,reason:string)=>({action,reason,remaining});
  if(Object.values(remaining).some(n=>n===0))return answer('stop','An approved batch budget is exhausted; no automatic extension.');
  const perVersion=s.candidateVersions.map(v=>s.assessments.filter(a=>a.candidate===v&&a.result).at(-1)?.result).filter((r):r is Retention=>!!r);
  if(perVersion.slice(-2).length===2 && perVersion.slice(-2).every(r=>r.improvement && (r.improvement.absolute.upper<.05 || (r.improvement.relative!==null && r.improvement.relative.upper<.25))))return answer('stop','Two successive evaluated versions failed the worthwhile-gain criterion.');
  const last=s.assessments.at(-1);
  if(last && !last.result)return answer('resolve-run','Preserve the unfinished/failed run and resolve its recorded infrastructure status before another assessment.');
  if(!s.instrumentChecked)return answer('check-instrument','Finish the independent v2 oracle before any real comparison.');
  if(s.evidenceHolds.length)return answer('collect-evidence',s.evidenceHolds.join('; '));
  if(last?.result?.decision==='stop-no-headroom')return answer('stop',last.result.next);
  if(last?.result?.decision==='inconclusive')return answer('resolve-evidence',last.result.next);
  if(last?.result?.decision==='retain')return answer('final-acceptance','Freeze the retained candidate; use the separate untouched microphone acceptance set once.');
  if(last?.result?.decision==='provisional')return answer('next-reviewed-window',last.result.next);
  return answer('develop-candidate','Use measured failures to freeze the next candidate within the remaining budget, then compare on identical reviewed evidence.');
}
