import { expect, it } from 'vitest';
import { nextAction, type BatchState } from '../src/v2/driver.ts';
import { reservedHolds, type PartitionRegistry } from '../src/v2/partitions.ts';
import type { RecordedRun } from '../src/v2/types.ts';
const empty=():BatchState=>({contract:'research-contract-1',instrumentChecked:true,evidenceHolds:['independent beat bounds missing'],candidateVersions:[],assessments:[],research:{questions:['annotation practice'],sources:['ASAP','nASAP']}});
it('directs the real batch to its missing evidence, preserving the approved budgets',()=>{
  const result=nextAction(empty());expect(result.action).toBe('collect-evidence');expect(result.remaining).toEqual({versions:6,assessments:12,cpuSeconds:7200,sources:4,questions:1});
  const s=empty();s.instrumentChecked=false;expect(nextAction(s).action).toBe('check-instrument');
});
it('stops at a budget rather than starting another assessment',()=>{
  const s=empty();s.candidateVersions=Array.from({length:6},(_,i)=>`candidate-${i}`);expect(nextAction(s).action).toBe('stop');
  s.candidateVersions.push('overflow');expect(()=>nextAction(s)).toThrow(/budget/);
});
it('requires preserving an unfinished/failed attempt',()=>{
  const s=empty();s.candidateVersions=['candidate-1'];s.assessments=[{id:'attempt-1',candidate:'candidate-1',cpuSeconds:1,result:null,infrastructureFailure:'interrupted before report'}];expect(nextAction(s).action).toBe('resolve-run');
});
it('checks connected partitions and one-time reserved access',()=>{
  const base:RecordedRun={id:'base',candidate:'clock',setHash:'a'.repeat(64),instrumentHash:'b'.repeat(64),measurements:[]};
  const candidate={...base,id:'next',candidate:'audio@1'};
  const registry:PartitionRegistry={version:1,groups:[{piece:'development-song',performer:'dev',session:'d',partition:'development'},{piece:'reserved-song',performer:'held',session:'r',partition:'reserved'}],accesses:[{setHash:base.setHash,candidate:candidate.candidate,comparatorRun:base.id,candidateRun:candidate.id,kind:'reserved-comparison',recordedAt:'2026-09-25T12:00:00Z'}]};
  expect(reservedHolds(registry,base,candidate,[])).toEqual([]);
  registry.groups[1]!.performer='dev';expect(reservedHolds(registry,base,candidate,[]).join(' ')).toContain('crosses partitions');
  registry.accesses.push({...registry.accesses[0]!,kind:'inspection'});expect(reservedHolds(registry,base,candidate,[]).join(' ')).toContain('inspected/reused');
});
