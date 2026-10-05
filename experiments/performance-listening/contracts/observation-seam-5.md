# Observation seam 5 — finish observability and safe lengths

2026-10-05, experiment 042; **GPT-6.1-Sol (high) in Codex**.
Inherits [seam 4](observation-seam-4.md) and all its inherited definitions unchanged.
**No new seam rule, numerical gate, tolerance or producer version.** This version adds
observable hand fixtures for the two scalar coverage gaps in [audit 4](../bench/oracle-events/audit-observation-seam-4.md#rules-i-could-not-exercise).
Its [separate hand file](../bench/oracle-events/observation-seam-5.json) and
[freeze](../bench/oracle-events/freeze-observation-seam-5.json) land before checks.
Independent audit is required before any listener judgment.

## Added fixtures

`finishState5` supplies setup/start emissions, one explicit 48 kHz feed, its service
and emissions, finish service and nonempty finish emissions. Feed samples are zeros
except the last supplied input, `tail`. Where `zeroMaps` is true, supply one all-zero
172x88 note map on the scheduled feed. Record generated/ring/pending counts, delivered
samples, next cadence, watermark and physical window bits immediately before/after
finish, returned finish frames, model-call counts, completion/work/ratio, stamped
finish decisions, old-history preservation and appended-history equality. Mutating a
returned finish payload must leave the saved clone unchanged. The immutable-history
rule and serial stamp ownership are inherited, not introduced here.

S10 leaves a pending interpolation neighbor in a three-sample prefix. Its supplied
`continuation` is a diagnostic probe AFTER recording finish state: supplying the
missing right neighbor demonstrates the retained value was preserved. It grants no
post-finish live-listener lifecycle permission. S11 has populated ring/watermark and
one scheduled map call; finish does not add a call, sample, frame or window.
These are injected-backend state/stamp cases, not native inference/timer evidence.

O19 refuses 2^53, an integer outside the safe range; O20/O21 refuse Infinity/NaN,
represented as seam 4's `special` objects. Validation precedes geometry or allocation.
Earlier ordinary/zero/negative/fractional cases remain unchanged.

Compare physical bits exactly, integers/IDs/null/booleans exactly and times/rational
arithmetic at 1e-12, as seam 4 already states. S10's continuation sample uses physical
0x41479e7a; its rational is explanatory arithmetic only.

## Independent adoption remains separate

The [041 implementation review brief](../REVIEWING_AN_IMPLEMENTATION.md) permits the
separate reviewer to inspect native context/maps, timer scope, provenance and prefix
records. This scalar version does not certify those obligations. Both this version's
independent oracle audit and that native adoption review must resolve before the
formal guitar-stage experiment. No native listener, historical verdict, gate, suite,
sentinel or held-out evidence changes here.
