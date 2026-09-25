import type { GoldenV2, RecordedRun } from './types.ts';
export interface PartitionRegistry {
  version: 1;
  groups: { piece: string; performer: string; session: string; partition: GoldenV2['partition'] }[];
  accesses: { setHash: string; candidate: string; comparatorRun: string; candidateRun: string; kind: 'reserved-comparison' | 'inspection'; recordedAt: string }[];
}
/** A connected component sharing any identity must stay in one partition. */
export function reservedHolds(registry: PartitionRegistry | undefined, base: RecordedRun, candidate: RecordedRun, goldens: GoldenV2[]): string[] {
  if (!registry) return ['Reserved partition/access registry missing'];
  const holds: string[] = [];
  if (registry.version !== 1 || !Array.isArray(registry.groups) || !Array.isArray(registry.accesses)) throw new Error('Invalid partition registry');
  for (const g of registry.groups) {
    if (!['development','reserved','acceptance'].includes(g.partition) || [g.piece,g.performer,g.session].some(v=>!v || /^(unknown|pending|unallocated)$/i.test(v))) holds.push('Registry contains an unknown source identity or partition');
    for (const other of registry.groups) if (other.partition !== g.partition && (other.piece===g.piece || other.performer===g.performer || other.session===g.session)) holds.push('A connected source group crosses partitions');
  }
  if (!registry.groups.some(g=>g.partition==='development')) holds.push('Registry omits development identities');
  for(const g of goldens.filter(g=>g.provenance.kind==='recording')) if(!registry.groups.some(r=>r.partition==='reserved' && r.piece===g.group.piece && r.performer===g.group.performer && r.session===g.group.session)) holds.push(`${g.example}: source is not registered as reserved`);
  const access=registry.accesses.filter(a=>a.setHash===candidate.setHash);
  if(access.length!==1 || access[0]?.kind!=='reserved-comparison' || access[0].candidate!==candidate.candidate || access[0].candidateRun!==candidate.id || access[0].comparatorRun!==base.id || !Number.isFinite(Date.parse(access[0].recordedAt))) holds.push('Reserved set is inspected/reused or lacks its one recorded frozen comparison');
  if(registry.accesses.filter(a=>a.kind==='reserved-comparison').length!==1) holds.push('Contract 1 permits only one reserved comparison in total');
  return [...new Set(holds)];
}
