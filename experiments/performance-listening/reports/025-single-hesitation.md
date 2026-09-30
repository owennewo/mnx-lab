# 025 — One hesitation on the same sine scores

## Pre-registration

2026-09-30. Designed, implemented, run and recorded by **GPT-6 in Codex (exact version unverified)**, as stated at launch. Terminal/TypeScript/tsx/Vitest. Research-log question 9; stage 2's first deviation only. This pre-registration lands before generation, execution or evaluation. No listener, instrument or oracle is changed.

### Question and evidence

Does unchanged event-chain@1 hold the live cursor through a single hesitation and reconstruct its interval and bar-level timing effect, while preserving stage 1?
[024](024-event-chain-stage1.md) established the happy path and predicted a held cursor from the absence of clock advancement. Its actual code holds acquired positions in silence; its assessor aligns pitch changes independently of time and uses matched onsets. The alternative is transient pitch rejection on release/re-entry, a missed resumption, or onset bias large enough to change a flag. Frozen clock and time-warp@8/@12/@14 distinguish audio-dependent holding from clock prediction. Their absence of assessment remains a limitation.

The bounded [research refresh](../research/hesitation-025.md) revisits the existing event-HMM source; its clarinet results are not evidence for these gates. The audited event-oracle@2 already covers hesitation and the typical-tempo reference. Its instruments and approved stage-gates@1 apply unchanged. New exact generated labels are evidence instances, not new measurement definitions or oracle cases.

### Method fixed before the run

1. Freeze private **contract2-hesitation-v1**, retaining all 24 stage-1 v3 examples byte-identically. Add 40 performances: s1 and s2, at steady base tempi 45/63/90/99, with one pause of 0.3/0.5/0.7/1/2 seconds. Insert it immediately before s1 event index 2 (third note) or s2 event index 4 (second-bar boundary). Release the preceding note at its unchanged written end; shift each following note's onset and end by the exact pause samples. Use the existing sine renderer, -12 dBFS, 10 ms ramps, 48 kHz. No pitch, note count, articulation elsewhere, duration or further tempo deviation changes. These cover the hesitation range endpoints and intermediate values; no bundled beginner claim is made.
2. Every new performance carries same-length digital silence and its own audio handed distant w2: 120 new examples plus 24 regressions, **144 total**. w1 remains deferred to the wrong-note deviation as the contract specifies. Exact sample boundaries determine matched-note labels and cursor segments: throughout the pause the last sounded event remains true. Validate the complete frozen manifest and hashes before running. Verify the rendered PCM equals its stage-1 parent before the gap and equals it shifted after the gap; the gap itself is zero. Freeze before writing the comparison runner.
3. Run unchanged event-chain@1 and all four frozen baselines on all 144 examples at 48 kHz/480-sample chunks. Assess event-chain@1 only. Compare every stage-1 record for all five listeners and its eight performance assessments with g024 byte for byte. Run six prefix changes on every example for event-chain@1, and for each baseline on s1-90/s2-90, h-s1-90-1000/h-s2-90-1000 and the latter's two controls. Cost includes initialization, feed and finish on the recorded Linux host, provisional against the existing target; no browser/microphone claim.
4. Evaluate cursor/assessment gates per example, pooled separately for hesitation and stage-1 regressions, and cost/causality for the whole run. Pin commit, full source hashes, private manifest, records and assessments. The runner refuses dirty experiment files, an unlanded pre-registration and reused run IDs. Preserve any failed execution before diagnosing it.

### Predictions

| # | Prediction |
|---|---|
| 1 | All 24 regression examples retain identical assets and labels; all 40 new performances are exactly the parent's PCM with one zero-valued gap, with unchanged notes and exactly one enlarged onset interval. All 120 stage-1 listener records and eight event-chain performance assessments equal g024 byte for byte. |
| 2 | event-chain@1 passes every cursor gate on 40 hesitation performances, reaches all 240 events within 0.2 s, has zero ahead/exposure and makes no cursor movement within any inserted pause. |
| 3 | It matches all 240 notes and reports all 200 intervals within tolerance and all overall tempi within 5%. Typical tempo remains the base tempo; the analytical bar ratios are 3/(3 + pause*tempo/60) for s1 and 4/(4 + pause*tempo/60) for s2's second bar. There are 35 definite slow-bar positives, five either bars, and 20 unaffected first bars on s2. At least 90% of slow positives are found, with zero false findings of any kind. |
| 4 | All 96 controls (16 old, 80 new) reject for 100% of answerable time, with zero played-note/tempo claims in event-chain@1's assessment. |
| 5 | Every prefix check passes; event-chain@1 sustained ratio <=0.25 and chunk p99 <=10 ms; all stage-1 gates remain passed. |
| 6 | event-chain@1 passes this hesitation substage completely; the clock fails at least one new cursor example and no frozen baseline passes the complete two-output substage. |

Any shortfall or changed reused byte contradicts its prediction. An optional flag in the instruments' `either` band is not a false alarm. Actual gate counts and uncertainty bands are reported even if an aggregate prediction fails.

### Decision rules

- **D1, integrity:** if input hashes, exact PCM insertion, label invariants or reused deterministic artifacts differ, preserve the attempt and diagnose before claiming comparisons. Only runner/serialization defects permit a technical rerun with a new ID; neither listener tuning nor evidence changes do.
- **D2, pass:** only if every hesitation example, control, regression, pooled group, causality and cost gate passes, record this first stage-2 deviation passed and rank the next single deviation, a slowed bar. Stage 2 as a whole remains incomplete. Keep event-chain@1 unchanged.
- **D3, failure/mixed:** if any gate fails, record the failing output, example and gate. Stage 1 may remain passed when its own gates pass, but hesitation stays open. Rank the concrete measured cause, with no tuning in this experiment. A prediction stricter than the gates may be contradicted while D2 passes; report both.
- **D4, infrastructure/inconclusive:** a crash or failed prefix check is preserved and diagnosed, not treated as ordinary score error. Observations fitting no branch are inconclusive; do not invent a favourable branch afterwards.

### Carried-over state and preflight

[024](024-event-chain-stage1.md#resulting-plateau-budgets-and-evidence-access) establishes plateau **0**, one development listener version and one completed comparison; development iterations are not rationed. This experiment budgets no new listener version and one successful recorded execution, with only D1/D4 technical reruns. Qualification contract 1 remains zero frozen versions and zero assessments, all six version slots, twelve assessment slots and reserved/final access unused. Winner bars 5–8 stay unexamined. Stage-1 evidence is reused development evidence; the new pause variants are correlated transformations of the same two scores, not independent generalisation.

Worktree/ledger/reports/archive/private directories show no existing owner of 025. Worktree listening-025 and run **g025-single-hesitation** are unused. Private stage-1 v3 is readable; ffmpeg is available; the authorised external worktree and data-root writes use sandbox escalation. Dependencies are installed once. No new oracle or instrument means no audit is due. No current user decision is needed; later recorded-guitar gates, qualification and product decisions remain pending.
