import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { oracleReport } from '../src/report/oracle.ts';
import { renderComparison, renderReport } from '../src/report/index.ts';
it('renders the lost category and denominator above causality, cost and summary', () => {
  const report = renderReport(oracleReport('o4-lost-then-found'));
  expect(report).toContain('| lost | 40 | 40 | 158 / 158 |');
  expect(report).toContain('40 / 158 (25.32%)');
  expect(report.indexOf('| lost')).toBeLessThan(report.indexOf('## Causality'));
  expect(report.indexOf('## Causality')).toBeLessThan(report.indexOf('## Processing cost'));
  expect(report.indexOf('## Processing cost')).toBeLessThan(report.indexOf('Summary:'));
  expect(report).toBe(readFileSync(new URL('../oracle/o4-lost-then-found/report.md', import.meta.url), 'utf8'));
});
it('renders differences on the same example with explicit lack of independent-source uncertainty', () => {
  const a = oracleReport('o1-perfect'), b = oracleReport('o4-lost-then-found');
  a.evaluations[0]!.example = 'two-bars'; b.evaluations[0]!.example = 'two-bars';
  const report = renderComparison(a, b);
  expect(report).toContain('| two-bars | lost | 0 | 40 | 40 | n = 1 source per example; no interval |');
  expect(report).toContain('| two-bars | correct | 158 | 118 | -40 |');
  expect(report).toBe(readFileSync(new URL('../oracle/comparison-o1-o4.md', import.meta.url), 'utf8'));
  b.evaluations[0]!.evidenceId = 'different-labels'; expect(() => renderComparison(a, b)).toThrow('same labelled examples');
  b.set = 'another-set'; expect(() => renderComparison(a, b)).toThrow('same set');
});
