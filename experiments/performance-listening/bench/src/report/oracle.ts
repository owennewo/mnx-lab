import { readFileSync, writeFileSync } from 'node:fs';
import { evaluate, EVALUATOR_VERSION } from '../evaluate/index.ts';
import type { Decision, Golden } from '../types.ts';
import { renderComparison, renderReport, type RunReport } from './index.ts';
export function oracleReport(id: string): RunReport {
  const folder = new URL(`../../oracle/${id}/`, import.meta.url);
  const golden = JSON.parse(readFileSync(new URL('golden.json', folder), 'utf8')) as Golden;
  const record = JSON.parse(readFileSync(new URL('decisions.json', folder), 'utf8')) as Decision[];
  return { id, candidate: 'handwritten oracle (no listener)', set: 'oracle-v1', evaluator: EVALUATOR_VERSION, evaluations: [evaluate(golden, record)], causality: null, costs: null };
}
export function renderOracleArtifacts(): void {
  const one = oracleReport('o1-perfect'), four = oracleReport('o4-lost-then-found');
  writeFileSync(new URL('../../oracle/o4-lost-then-found/report.md', import.meta.url), renderReport(four));
  // These two records use the same handwritten score and identical following labels.
  one.evaluations[0]!.example = 'two-bars'; four.evaluations[0]!.example = 'two-bars';
  writeFileSync(new URL('../../oracle/comparison-o1-o4.md', import.meta.url), renderComparison(one, four));
}
