import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  bench,
  readJSON,
  readWav,
  writeJSON,
  hash,
  filesHash,
} from "../evaluation/io.mjs";
import { harmonicDictionary, createScorer } from "../detectors/spectral.mjs";
import { detectDSP } from "../detectors/stream.mjs";
import {
  evaluate,
  assessment,
  counts,
  quantile,
  attacks,
} from "../evaluation/metrics.mjs";
const mode = process.argv[2],
  out = path.resolve(
    process.argv[3] ?? path.join(bench, "output/fusion-whitening-v1"),
  );
const archive =
  process.env.LISTENING_ARCHIVE_ROOT ?? path.join(bench, "output");
const plan = readJSON(path.join(bench, "experiments/fusion-whitening.json")),
  base = readJSON(path.join(bench, "experiments/baseline.json"));
const config = (strength) => ({
  ...base,
  fusion: {
    threshold: 0.15,
    refractorySeconds: 0.09,
    associationSeconds: 0.035,
    mode: "restrike-only",
    neighborRatio: 1,
  },
  whitening: { strength, floor: plan.floor, maxGain: plan.maxGain },
});
function loadSet(directory) {
  const m = readJSON(path.join(directory, "manifest.json"));
  if (m.sampleRate !== base.sampleRate) throw Error("Sample-rate mismatch");
  return m.records
    .filter((r) => r.split === "evaluation")
    .map((r) => ({ ...r, source: path.basename(directory), directory }));
}
function pcm(r) {
  const w = readWav(path.join(r.directory, r.file));
  if (w.hash !== r.audioHash || w.sampleRate !== base.sampleRate)
    throw Error("Frozen WAV mismatch");
  return w.samples;
}
function run(r, strength) {
  const c = config(strength),
    d = detectDSP(
      pcm(r),
      createScorer(harmonicDictionary(c), "harmonic", c),
      c,
      256,
    ),
    m = evaluate(r.actual, d.events, r.duration, c);
  return {
    id: r.id,
    source: r.source,
    preset: r.preset,
    category: r.category,
    strength,
    audioHash: r.audioHash,
    metrics: m,
    assessment: assessment(r.target, r.actual, d.events, c),
    cpuMs: d.cpuMs,
    events: d.events,
  };
}
function summary(rows) {
  const total = { tp: 0, fp: 0, fn: 0 },
    active = { tp: 0, fp: 0, fn: 0 },
    categories = {},
    presets = {};
  let cpuMs = 0,
    falseAccusations = 0,
    missedUnexpected = 0;
  for (const r of rows) {
    for (const k of ["tp", "fp", "fn"]) {
      total[k] += r.metrics.onset[k];
      active[k] += r.metrics.active[k];
    }
    cpuMs += r.cpuMs;
    falseAccusations += r.assessment.falseAccusations;
    missedUnexpected += r.assessment.missedUnexpectedAttacks;
    for (const [obj, key] of [
      [categories, r.category],
      [presets, r.preset],
    ]) {
      obj[key] ??= { tp: 0, fp: 0, fn: 0 };
      for (const k of ["tp", "fp", "fn"]) obj[key][k] += r.metrics.onset[k];
    }
  }
  return {
    onset: counts(total.tp, total.fp, total.fn),
    active: counts(active.tp, active.fp, active.fn),
    falseAccusations,
    missedUnexpected,
    cpuMs,
    categories: Object.fromEntries(
      Object.entries(categories).map(([k, v]) => [k, counts(v.tp, v.fp, v.fn)]),
    ),
    presets: Object.fromEntries(
      Object.entries(presets).map(([k, v]) => [k, counts(v.tp, v.fp, v.fn)]),
    ),
  };
}
function publicRow(r) {
  return {
    id: r.id,
    source: r.source,
    preset: r.preset,
    category: r.category,
    strength: r.strength,
    audioHash: r.audioHash,
    onset: r.metrics.onset,
    active: r.metrics.active,
    latency: r.metrics.latency,
    assessment: r.assessment,
    cpuMs: r.cpuMs,
  };
}
if (mode === "development") {
  if (fs.existsSync(out)) throw Error("Refusing to overwrite run");
  fs.mkdirSync(out, { recursive: true });
  const records = plan.developmentAudio.flatMap((name) =>
    loadSet(path.join(archive, name)),
  );
  writeJSON(path.join(out, "protocol.json"), {
    plan,
    base,
    revision: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    codeHashes: filesHash(path.join(bench, "detectors")),
    planHash: hash(JSON.stringify(plan)),
    cpu: os.cpus()[0]?.model,
    node: process.version,
    inputHashes: records.map((r) => ({
      source: r.source,
      id: r.id,
      preset: r.preset,
      audioHash: r.audioHash,
    })),
  });
  const all = [];
  // Rotate recipe order across cases to reduce systematic warmup/order bias.
  for (const [i, r] of records.entries()) {
    const strengths = plan.strengths
      .slice(i % 4)
      .concat(plan.strengths.slice(0, i % 4));
    for (const s of strengths) all.push(run(r, s));
    if (i % 24 === 23) console.log(`Development ${i + 1}/${records.length}`);
  }
  const summaries = plan.strengths.map((strength) => ({
    strength,
    ...summary(all.filter((r) => r.strength === strength)),
  }));
  const ranked = summaries.toSorted(
      (a, b) => b.onset.f1 - a.onset.f1 || a.strength - b.strength,
    ),
    selected = ranked[0].strength;
  writeJSON(path.join(out, "development.json"), { summaries, rows: all });
  writeJSON(path.join(out, "selection.json"), {
    selected,
    rule: plan.selection,
    developmentHash: hash(fs.readFileSync(path.join(out, "development.json"))),
    summaries,
  });
  console.log(JSON.stringify({ selected, summaries }));
} else if (mode === "heldout") {
  const selection = readJSON(path.join(out, "selection.json"));
  if (fs.existsSync(path.join(out, "heldout.json")))
    throw Error("Heldout already evaluated");
  const selected = selection.selected,
    records = loadSet(path.resolve(process.argv[4]));
  const all = [],
    costs = [];
  for (let pass = 0; pass < plan.costPasses; pass++) {
    const totals = { 0: 0, [selected]: 0 };
    for (const [i, r] of records.entries()) {
      const strengths =
        selected === 0 ? [0] : (i + pass) % 2 ? [selected, 0] : [0, selected];
      for (const strength of strengths) {
        if (pass === 0) {
          const result = run(r, strength);
          all.push(result);
          totals[strength] += result.cpuMs;
        } else {
          const c = config(strength);
          totals[strength] += detectDSP(
            pcm(r),
            createScorer(harmonicDictionary(c), "harmonic", c),
            c,
            256,
          ).cpuMs;
        }
      }
    }
    costs.push(totals);
    console.log(`Fresh cost pass ${pass + 1}/${plan.costPasses}`);
  }
  const summaries = [...new Set([0, selected])].map((strength) => ({
    strength,
    ...summary(all.filter((r) => r.strength === strength)),
  }));
  const parent = summaries[0],
    candidate = summaries.at(-1);
  const latencyParent = [],
    latencyCandidate = [];
  for (const r of records) {
    const rows = all.filter((x) => x.id === r.id && x.preset === r.preset);
    const p = rows.find((x) => x.strength === 0),
      c = rows.find((x) => x.strength === selected),
      truth = attacks(r.actual),
      pm = new Map(p.metrics.matched.map((m) => [m.expected, m.predicted])),
      cm = new Map(c.metrics.matched.map((m) => [m.expected, m.predicted]));
    for (const [i, j] of pm)
      if (cm.has(i)) {
        latencyParent.push(p.events[j].emittedAt - truth[i].start);
        latencyCandidate.push(c.events[cm.get(i)].emittedAt - truth[i].start);
      }
  }
  const ratio =
      quantile(
        costs.map((p) => p[selected]),
        0.5,
      ) /
      quantile(
        costs.map((p) => p[0]),
        0.5,
      ),
    latencyIncrease =
      quantile(latencyCandidate, 0.95) - quantile(latencyParent, 0.95);
  const gates = {
    changed: selected !== 0,
    precision: candidate.onset.precision >= parent.onset.precision,
    recall: candidate.onset.recall >= parent.onset.recall,
    f1: candidate.onset.f1 > parent.onset.f1,
    falseAccusations: candidate.falseAccusations <= parent.falseAccusations,
    active:
      candidate.active.f1 >= parent.active.f1 - plan.acceptance.maxActiveF1Drop,
    categories: Object.keys(parent.categories).every(
      (k) =>
        candidate.categories[k].f1 >=
        parent.categories[k].f1 - plan.acceptance.maxCategoryF1Drop,
    ),
    cpu: ratio <= plan.acceptance.maxCpuRatio,
    commonLatency:
      latencyIncrease <= plan.acceptance.maxCommonMatchP95IncreaseSeconds,
  };
  writeJSON(path.join(out, "heldout.json"), {
    selectionHash: hash(fs.readFileSync(path.join(out, "selection.json"))),
    manifestHash: hash(
      fs.readFileSync(path.join(process.argv[4], "manifest.json")),
    ),
    summaries,
    costs,
    cpuRatio: ratio,
    commonLatency: {
      matches: latencyParent.length,
      parentP95: quantile(latencyParent, 0.95),
      candidateP95: quantile(latencyCandidate, 0.95),
      increase: latencyIncrease,
    },
    gates,
    rows: all,
  });
  console.log(
    JSON.stringify({ summaries, cpuRatio: ratio, latencyIncrease, gates }),
  );
} else if (mode === "diagnostics") {
  if (fs.existsSync(path.join(out, "diagnostics.json")))
    throw Error("Diagnostics already evaluated");
  const records = [];
  const isolationDirectory = path.join(archive, "gymnopedie-bars5-8-v1");
  for (const r of readJSON(path.join(isolationDirectory, "isolation.json"))) {
    const file = `isolated-${r.fixture.id}.wav`;
    records.push({
      ...r.fixture,
      target: r.fixture.actual,
      category: "private-isolated",
      preset: "guitar",
      source: "private-controls",
      directory: isolationDirectory,
      file,
      audioHash: readWav(path.join(isolationDirectory, file)).hash,
    });
  }
  const full = readJSON(path.join(archive, "gymnopedie-v1/results.json")),
    end = full.fixture.measures[8].start + 0.15;
  const rows = [];
  for (const strength of plan.strengths) {
    for (const r of records) rows.push(run(r, strength));
    const actual = full.fixture.actual.filter((n) => n.start < end),
      samples = readWav(
        path.join(archive, "gymnopedie-v1/guitar.wav"),
      ).samples.subarray(0, Math.ceil(end * base.sampleRate));
    const c = config(strength),
      d = detectDSP(
        samples,
        createScorer(harmonicDictionary(c), "harmonic", c),
        c,
        256,
      );
    const a = full.fixture.measures[4].start,
      b = full.fixture.measures[8].start,
      truth = attacks(actual),
      m = evaluate(actual, d.events, end, c),
      chosen = new Set(
        truth.flatMap((n, i) =>
          n.start >= a - 1e-8 && n.start < b - 1e-8 ? [i] : [],
        ),
      ),
      used = new Set(m.matched.map((x) => x.predicted)),
      matches = m.matched.filter((x) => chosen.has(x.expected)),
      fp = d.events.filter(
        (n, i) => !used.has(i) && n.start >= a - 0.1 && n.start < b - 0.1,
      ).length;
    rows.push({
      id: "private-bars5-8",
      strength,
      onset: counts(matches.length, fp, chosen.size - matches.length),
      missing: truth.filter(
        (n, i) => chosen.has(i) && !matches.some((x) => x.expected === i),
      ),
      cpuMs: d.cpuMs,
    });
  }
  writeJSON(path.join(out, "diagnostics.json"), {
    selectionHash: hash(fs.readFileSync(path.join(out, "selection.json"))),
    rows,
  });
  console.log(
    JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        strength: r.strength,
        onset: r.onset ?? r.metrics.onset,
      })),
    ),
  );
} else if (mode === "export") {
  const development = readJSON(path.join(out, "development.json")),
    heldout = readJSON(path.join(out, "heldout.json")),
    diagnostics = readJSON(path.join(out, "diagnostics.json")),
    destination = path.resolve(process.argv[4]);
  if (fs.existsSync(destination)) throw Error("Export exists");
  writeJSON(path.join(destination, "summary.json"), {
    protocol: readJSON(path.join(out, "protocol.json")),
    selection: readJSON(path.join(out, "selection.json")),
    development: development.summaries,
    heldout: { ...heldout, rows: undefined },
    diagnostics: diagnostics.rows.map((r) => ({
      id: r.id,
      strength: r.strength,
      onset: r.onset ?? r.metrics.onset,
    })),
  });
  fs.writeFileSync(
    path.join(destination, "cases.jsonl"),
    [...development.rows, ...heldout.rows]
      .map((r) => JSON.stringify(publicRow(r)))
      .join("\n") + "\n",
  );
} else throw Error("Use development | heldout | diagnostics | export");
