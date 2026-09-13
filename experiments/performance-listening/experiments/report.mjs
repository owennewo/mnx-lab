import fs from "node:fs";
import path from "node:path";
import { bench, readJSON, writeJSON, hash } from "../evaluation/io.mjs";
import { counts, quantile, attacks } from "../evaluation/metrics.mjs";
const run = path.resolve(process.argv[2] ?? path.join(bench, "output/run-v1"));
const output = path.resolve(
  process.argv[3] ?? path.join(bench, "findings/reference-v1"),
);
if (fs.existsSync(output))
  throw Error("Refusing to overwrite a reference report: " + output);
const bytes = fs.readFileSync(path.join(run, "results.json")),
  data = JSON.parse(bytes);
const expected = data.audioManifest.records.filter(
  (r) => r.split === "evaluation",
);
if (
  data.limit !== null ||
  data.results.length !==
    expected.length * 3 * (1 + data.config.streamChunks.length)
)
  throw Error(
    "Reference requires a complete matrix, including explicit unavailable outcomes",
  );
const recordFor = (r) =>
  data.audioManifest.records.find(
    (f) =>
      f.id === r.fixture && f.preset === r.preset && f.split === "evaluation",
  );
function summarize(rows) {
  const good = rows.filter((r) => r.status === "ok"),
    sum = (f) => good.reduce((s, r) => s + f(r), 0);
  const latencies = good.flatMap((r) =>
    r.metrics.matched.map(
      (p) =>
        r.detection.events[p.predicted].emittedAt -
        attacks(r.record.actual)[p.expected].start,
    ),
  );
  const activeFrames = sum((r) => r.metrics.activeFrames);
  return {
    runs: good.length,
    unavailable: rows.filter((r) => r.status === "unavailable").length,
    failed: rows.filter((r) => r.status === "failed").length,
    onset: counts(
      sum((r) => r.metrics.onset.tp),
      sum((r) => r.metrics.onset.fp),
      sum((r) => r.metrics.onset.fn),
    ),
    active: counts(
      sum((r) => r.metrics.active.tp),
      sum((r) => r.metrics.active.fp),
      sum((r) => r.metrics.active.fn),
    ),
    exactActiveFrames: sum((r) => r.metrics.exactActiveFrames),
    activeFrames,
    exactChordRate: activeFrames
      ? sum((r) => r.metrics.exactActiveFrames) / activeFrames
      : null,
    latency: {
      matchedCount: latencies.length,
      p50: quantile(latencies, 0.5),
      p95: quantile(latencies, 0.95),
    },
    realTimeFactor: good.length
      ? sum((r) => r.detection.cpuMs) / 1000 / sum((r) => r.duration)
      : null,
    maxBacklog: good.some((r) => r.detection.maxBacklog !== null)
      ? Math.max(...good.map((r) => r.detection.maxBacklog ?? 0))
      : null,
    falseAccusations: sum((r) => r.assessment.falseAccusations),
    missedUnexpectedAttacks: sum((r) => r.assessment.missedUnexpectedAttacks),
    unassessedTargetEvents: sum((r) => r.assessment.unassessedTargetEvents),
    silentFalseFrames: sum((r) => r.metrics.silentFalseFrames),
    silentFrames: sum((r) => r.metrics.silentFrames),
    octaveConfusions: sum((r) => r.metrics.octaveConfusions),
    confidence: data.config.confidenceThresholds.map((threshold, i) => ({
      threshold,
      ...counts(
        sum((r) => r.metrics.confidenceCurve[i].tp),
        sum((r) => r.metrics.confidenceCurve[i].fp),
        sum((r) => r.metrics.confidenceCurve[i].fn),
      ),
    })),
    scoreBins: Array.from({ length: 5 }, (_, i) => ({
      from: i / 5,
      to: (i + 1) / 5,
      count: sum((r) => r.metrics.scoreBins[i].count),
      correct: sum((r) => r.metrics.scoreBins[i].correct),
    })),
  };
}
const rows = data.results.map((r) => ({ ...r, record: recordFor(r) }));
const group = (key) =>
  Object.fromEntries(
    [...new Set(rows.map(key))].map((k) => [
      k,
      summarize(rows.filter((r) => key(r) === k)),
    ]),
  );
const base = (r) => `${r.strategy}/${r.mode}/${r.preset}`;
const groups = group(base),
  categories = group((r) => `${base(r)}/${r.category}`);
const range = (ns) =>
  !ns.length
    ? "silence"
    : Math.max(...ns.map((n) => n.pitch)) < 56
      ? "low"
      : Math.min(...ns.map((n) => n.pitch)) >= 72
        ? "high"
        : Math.min(...ns.map((n) => n.pitch)) >= 56 &&
            Math.max(...ns.map((n) => n.pitch)) < 72
          ? "middle"
          : "mixed";
const level = (ns) =>
  !ns.length
    ? "silence"
    : Math.max(...ns.map((n) => n.velocity)) -
          Math.min(...ns.map((n) => n.velocity)) >
        0.2
      ? "unequal"
      : Math.max(...ns.map((n) => n.velocity)) < 0.5
        ? "soft"
        : "normal";
const compact = data.results.map((r) => ({
  fixture: r.fixture,
  preset: r.preset,
  strategy: r.strategy,
  mode: r.mode,
  status: r.status,
  reason: r.reason,
  ...(r.status === "ok"
    ? {
        onset: r.metrics.onset,
        active: r.metrics.active,
        exactChordRate: r.metrics.exactChordRate,
        latency: r.metrics.latency,
        assessment: r.assessment,
        octaveConfusions: r.metrics.octaveConfusions,
      }
    : {}),
}));
writeJSON(path.join(output, "summary.json"), {
  version: 1,
  runHash: hash(bytes),
  createdAt: data.createdAt,
  revisionAtRun: data.revision,
  sourceHashes: data.sourceHashes,
  manifestHash: data.manifestHash,
  config: data.config,
  environment: data.environment,
  neural: data.neural,
  algorithms: data.algorithms,
  groups,
  breakdownsFile: "breakdowns.jsonl",
});
writeJSON(path.join(output, "audio-manifest.json"), data.audioManifest);
const breakdowns = {
  category: categories,
  range: group((r) => `${base(r)}/${range(r.record.actual)}`),
  level: group((r) => `${base(r)}/${level(r.record.actual)}`),
};
fs.writeFileSync(
  path.join(output, "breakdowns.jsonl"),
  Object.entries(breakdowns)
    .flatMap(([dimension, groups]) =>
      Object.entries(groups).map(([key, metrics]) =>
        JSON.stringify({ dimension, key, ...metrics }),
      ),
    )
    .join("\n") + "\n",
);
// One row per line keeps every case reviewable without committing bulky predictions.
fs.writeFileSync(
  path.join(output, "cases.jsonl"),
  compact.map((r) => JSON.stringify(r)).join("\n") + "\n",
);
const pct = (n) => (n == null ? "—" : (n * 100).toFixed(1) + "%"),
  num = (n) => (n == null ? "—" : n.toFixed(3));
let md =
  "# Reference measurement\n\nGenerated from the full run; see `summary.json` for counts and provenance.\n\n| Strategy / mode / sound | Attack F1 | Active F1 | Exact active sets | Matched latency p95 (s) | Processing / audio |\n|---|---:|---:|---:|---:|---:|\n";
for (const [key, g] of Object.entries(groups))
  md += `| ${key} | ${pct(g.onset.f1)} | ${pct(g.active.f1)} | ${pct(g.exactChordRate)} | ${num(g.latency.p95)} | ${num(g.realTimeFactor)} |\n`;
md +=
  "\nNeural stream rows are unavailable, not zero scores. Latencies cover matched attacks only.\nProcessing uses wall-clock elapsed time on the recorded machine; no microphone or UI latency is included.\n";
fs.writeFileSync(path.join(output, "table.md"), md);
console.log("Reference report saved: " + output);
