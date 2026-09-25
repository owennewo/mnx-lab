import { CATEGORIES, type Evaluation } from '../evaluate/index.ts';
export interface Cost {
  machine: { hostname: string; cpu: string; platform: string; arch: string; node: string; cores: number };
  sampleRate: number; chunkSamples: number; chunks: number; audioSeconds: number;
  meanMs: number; p95Ms: number; p99Ms: number; sustainedRatio: number; maxBacklogMs: number;
  provisional: true;
}
export interface RunReport {
  id: string; candidate: string; set: string; evaluator: string;
  evaluations: Evaluation[];
  causality: { example: string; pass: boolean; cuts: { seconds: number; kind: string; pass: boolean }[] }[] | null;
  costs: { example: string; value: Cost }[] | null;
}
const escape = (s: string) => s.replaceAll('|', '\\|').replaceAll('\n', ' ');
const number = (n: number | null) => n === null ? 'none' : String(n);
const rate = (n: number, d: number) => `${n} / ${d}${d ? ` (${(100 * n / d).toFixed(2)}%)` : ' (n/a)'}`;
const table = (headers: string[], rows: (string | number)[][]): string =>
  `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.map(v => escape(String(v))).join(' | ')} |`).join('\n')}\n`;
export function renderReport(run: RunReport): string {
  const text = [`# ${run.id}`, `Candidate: ${run.candidate}. Set: ${run.set}. Evaluator: ${run.evaluator}.`,
    'Development instrument check under research-contract-0 (provisional, not human-approved). No qualification or retention decision. Counts are correlated grid points.'];
  for (const e of run.evaluations) {
    text.push(`## ${e.example}`, `Partition: ${e.partition}.`, table(['Profile dimension', 'Level', 'Actual range / deviation'], Object.entries(e.profile).map(([k, p]) => [k, p.level, `${p.range}${p.note ? '; ' + p.note : ''}`])));
    text.push(table(['Category', 'As decided', 'Hindsight', 'Denominator (live / hindsight)'], CATEGORIES.map(k => {
      const denom = (v: Evaluation['asDecided']) => k === 'pending' ? v.denominators.pending : (k === 'falseFollowing' || k === 'correctRejection') ? v.denominators.unsupported : k === 'uncovered' ? v.denominators.answerable : v.denominators.supported;
      return [k, e.asDecided.counts[k], e.hindsight.counts[k], `${denom(e.asDecided)} / ${denom(e.hindsight)}`];
    })));
    for (const [name, v] of [['As decided', e.asDecided], ['Hindsight', e.hindsight]] as const) {
      text.push(`### ${name}`, `Supported correct: ${rate(v.counts.correct, v.denominators.supported)}. Uncovered: ${rate(v.coverage.uncovered, v.coverage.denominator)}. Unsupported on supported truth: ${rate(v.abstention.count, v.abstention.denominator)}.`,
        `Wrong-position errors: n=${v.errors.values.length}; mean ${number(v.errors.mean)}, p95 ${number(v.errors.p95)}, max ${number(v.errors.max)} quarters; wrong-route points without a quarter distance: ${v.errors.routeMismatches}.`,
        `False following: ${v.falseFollowingSeconds} s. Confident pending claims: ${rate(v.counts.confidentPending, v.denominators.pending)}.`,
        table(['Loss starts (s)', 'Recovery (s)', 'Elapsed (s)'], v.losses.map(l => [l.start, l.recoveredAt ?? 'never', l.recoverySeconds ?? 'never'])),
        table(['Confidence bin', 'All claims', 'Pending', 'Correct / all', 'Correct / answerable'], v.confidence.map((c, i) => [`[${c.lower}, ${c.upper}${i === 4 ? ']' : ')'}`, c.claims, c.pending, rate(c.correct, c.claims), rate(c.correct, c.answerable)])));
    }
    text.push(`Timeliness: missed deadlines ${rate(e.timeliness.missed, e.timeliness.denominator)}; correct-decision delay mean ${number(e.timeliness.mean)}, p95 ${number(e.timeliness.p95)}, max ${number(e.timeliness.max)} s. No correct decision: ${e.timeliness.delays.filter(d => d.seconds === null).length} points. Deadline: 0.2 s.`,
      `Exposure (as decided only): total ${e.exposure.totalSeconds} s; longest continuous episode ${e.exposure.longestSeconds} s.`);
  }
  text.push('## Causality', run.causality ? table(['Example', 'Result', 'Prefix checks'], run.causality.map(c => [c.example, c.pass ? 'pass' : 'FAIL', c.cuts.map(p => `${p.kind} @ ${p.seconds}s: ${p.pass ? 'pass' : 'FAIL'}`).join('; ')])) : 'Not run: oracle records are handwritten, with no listener.');
  text.push('## Processing cost — provisional', 'Development-machine budget: sustained ≤ 25% of real time; p99 chunk ≤ 10 ms. Wall-clock measurements vary with load; they do not measure microphone-to-feedback latency.');
  if (run.costs) for (const c of run.costs) {
    text.push(`### ${c.example}`, `${c.value.machine.hostname}; ${c.value.machine.cpu}; ${c.value.machine.cores} logical CPUs; ${c.value.machine.platform}/${c.value.machine.arch}; Node ${c.value.machine.node}.`,
      `${c.value.sampleRate} Hz mono; ${c.value.chunkSamples} samples/chunk; ${c.value.chunks} chunks; ${c.value.audioSeconds} s audio.`,
      table(['Mean ms/chunk', 'p95 ms', 'p99 ms', 'Sustained / real time', 'Maximum backlog ms', 'Provisional budget'], [[c.value.meanMs, c.value.p95Ms, c.value.p99Ms, c.value.sustainedRatio, c.value.maxBacklogMs, c.value.sustainedRatio <= .25 && c.value.p99Ms <= 10 ? 'within' : 'EXCEEDED']]));
  } else text.push('Not measured: no listener executed.');
  const failures = run.evaluations.reduce((n, e) => n + e.asDecided.counts.wrong + e.asDecided.counts.falseFollowing + e.asDecided.counts.lost + e.asDecided.counts.overAmbiguous + e.asDecided.counts.uncovered, 0);
  text.push(`Summary: ${failures} answerable live points in failure categories; inspect the example tables above. This is an instrument check.`);
  return text.join('\n\n') + '\n';
}
export function renderComparison(a: RunReport, b: RunReport): string {
  if (a.set !== b.set || a.evaluator !== b.evaluator || a.evaluations.length !== b.evaluations.length || new Set(a.evaluations.map(e => e.example)).size !== a.evaluations.length || new Set(b.evaluations.map(e => e.example)).size !== b.evaluations.length) throw new Error('Comparison requires the same set, evaluator and examples');
  const rows: (string | number)[][] = [];
  for (const left of a.evaluations) {
    const right = b.evaluations.find(e => e.example === left.example);
    if (!right || left.evidenceId !== right.evidenceId || JSON.stringify(left.asDecided.denominators) !== JSON.stringify(right.asDecided.denominators) || JSON.stringify(left.profile) !== JSON.stringify(right.profile)) throw new Error('Comparison requires the same labelled examples');
    for (const k of CATEGORIES) rows.push([left.example, k, left.asDecided.counts[k], right.asDecided.counts[k], right.asDecided.counts[k] - left.asDecided.counts[k], 'n = 1 source per example; no interval']);
    for (const [label, x, y] of [['missed deadlines', left.timeliness.missed, right.timeliness.missed], ['exposure seconds', left.exposure.totalSeconds, right.exposure.totalSeconds]] as const) rows.push([left.example, label, x, y, y - x, 'n = 1 source per example; no interval']);
  }
  return `# ${a.id} → ${b.id}\n\nSame set ${a.set}; evaluator ${a.evaluator}. Live counts; differences are right minus left.\n\n${table(['Example', 'Category', a.id, b.id, 'Difference', 'Uncertainty'], rows)}\nNo causal or cost comparison: see the individual reports for measured conditions.\n\nSummary: category differences only; no retention decision.\n`;
}
