import fs from "node:fs";
import path from "node:path";
import { readJSON, writeJSON } from "../evaluation/io.mjs";
const [run, destination] = process.argv.slice(2).map((p) => path.resolve(p));
if (!run || !destination)
  throw Error("Usage: fusion-report.mjs RUN EXPORTED_REFERENCE");
const table = path.join(destination, "table.md"),
  diagnosis = path.join(destination, "attack-diagnostics.json");
if (fs.existsSync(table) || fs.existsSync(diagnosis))
  throw Error("Refusing to overwrite report");
const selected = readJSON(path.join(run, "selection.json")).id;
const pct = (x) => (x === null ? "—" : `${(100 * x).toFixed(1)}%`);
const ms = (x) => (x === null ? "—" : `${(1000 * x).toFixed(2)} ms`);
const lines = [
    "# Measured comparison",
    "",
    "Counts are pooled over cases. Processing is median total per-chunk wall time across three passes; latency/backlog are first-pass replay values.",
    "",
  ],
  diagnostics = {};
for (const split of ["development", "heldout"]) {
  const summaries = readJSON(path.join(run, split + "-summary.json"));
  const data = readJSON(path.join(run, split + "-results.json"));
  lines.push(
    `## ${split}`,
    "",
    "| Recipe | Attack TP / FP / FN | Repeat precision / recall / F1 | Active F1 | False accusations | Unassessed targets | Processing / F-000 |",
    "|---|---|---|---|---:|---:|---:|",
  );
  const parent = summaries[0];
  const row = (id, r, repeat, cpu) =>
    `| ${id} | ${r.onset.tp} / ${r.onset.fp} / ${r.onset.fn} | ${pct(repeat.precision)} / ${pct(repeat.recall)} / ${pct(repeat.f1)} | ${pct(r.active.f1)} | ${r.falseAccusations} | ${r.unassessedTargetEvents} | ${cpu.toFixed(4)}× |`;
  lines.push(
    row("F-000", parent.parent, parent.categories.repeated.parent.onset, 1),
  );
  for (const r of summaries)
    lines.push(
      row(
        r.id + (r.id === selected ? " (selected)" : ""),
        r.candidate,
        r.categories.repeated.candidate.onset,
        r.cpuRatio,
      ),
    );
  lines.push(
    "",
    "| Recipe | Matched p95 | Common-match p95 parent → candidate (count) | Max backlog | Failed gates |",
    "|---|---|---|---|---|",
  );
  for (const r of summaries)
    lines.push(
      `| ${r.id} | ${ms(r.candidate.latencyP95)} | ${ms(r.common.parentP95)} → ${ms(r.common.candidateP95)} (${r.common.count}) | ${ms(r.candidate.maxBacklog)} | ${r.failures.join("; ") || "None"} |`,
    );
  lines.push(
    "",
    "A lower pooled latency can reflect a changed match population. Parent and reference details, all timings and category/preset results remain in the JSON summaries.",
    "",
  );
  const records = new Map(
    data.audioManifest.records.map((r) => [`${r.preset}/${r.id}`, r]),
  );
  diagnostics[split] = {};
  for (const r of data.results.filter((r) => r.strategy !== "F-000")) {
    const cell = (diagnostics[split][r.strategy] ??= {
      unmatchedRestrikes: 0,
      pitchNeverScheduled: 0,
      events: [],
    });
    const truth = records.get(`${r.preset}/${r.fixture}`).actual;
    for (const e of r.metrics.extra.filter((e) => e.kind === "restrike")) {
      const never = !truth.some((n) => {
        const to = n.pitch + (n.bend?.cents ?? 0) / 100;
        return (
          e.pitch >= Math.min(n.pitch, to) - 0.5 &&
          e.pitch <= Math.max(n.pitch, to) + 0.5
        );
      });
      cell.unmatchedRestrikes++;
      cell.pitchNeverScheduled += Number(never);
      cell.events.push({
        preset: r.preset,
        fixture: r.fixture,
        pitch: e.pitch,
        start: e.start,
        pitchNeverScheduled: never,
      });
    }
  }
}
writeJSON(diagnosis, diagnostics);
fs.writeFileSync(table, lines.join("\n") + "\n");
console.log("Wrote comparison table and diagnostics", destination);
