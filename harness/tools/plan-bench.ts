// @ts-nocheck: a measurement tool reaching into the synth's untyped internals (Plucked, the planner, the engine).
// Replays captured re-plan inputs (plan-stalls.ts CAPTURE=) through the plucked planner:
// the time per re-plan, and a hash of every plan's events so a rewrite can be held to them.
import fs from 'node:fs';
import v8 from 'node:v8';
import crypto from 'node:crypto';
import { planPlucked, gestureEntries } from '../../synth/web/host/instruments/plucked-plan.js';

type Input = { entries: unknown[]; resolved: unknown; rate: number; memory: unknown; from: number };
const inputs = v8.deserialize(fs.readFileSync(process.argv[2]!)) as Input[], rounds = Number(process.argv[3] ?? 20);
// FULL=1: plan every event, as before `from` (the hash is of events at or after `from` either way).
const plan = (x: Input) => planPlucked(gestureEntries(x.entries, x.resolved, x.rate, x.memory), x.resolved, x.rate, x.memory, process.env.FULL ? -Infinity : x.from);
const hash = crypto.createHash('sha256');
for (const x of inputs) for (const e of plan(x).events) if (e.frame >= x.from) hash.update(`${e.frame} ${e.key} ${e.value}\n`);
const times: number[] = [];
for (let r = 0; r < rounds; r++) for (const x of inputs) { const t = performance.now(); plan(x); times.push(performance.now() - t); }
const last = times.slice(-inputs.length).sort((a, b) => a - b), mean = last.reduce((a, b) => a + b, 0) / last.length;
console.log(`${inputs.length} plans: mean ${mean.toFixed(3)} ms, p90 ${last[Math.floor(.9 * last.length)]!.toFixed(3)}, max ${last.at(-1)!.toFixed(3)}; events ${hash.digest('hex').slice(0, 16)}`);
