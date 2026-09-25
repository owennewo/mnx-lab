# Research log

The entry point to the performance-listening experiment. It answers three questions
for a person or a resuming loop driver: what do we currently believe, on what evidence,
and what is the next question. It is piece 11 of
[EXPERIMENT_HARNESS_STRUCTURE.md](EXPERIMENT_HARNESS_STRUCTURE.md), and the only file
in the experiment that is rewritten in place. No other document restates the current
state: the README, the report index and the evidence records link here instead.
`ledger.md` holds the history, one append-only row per run; `research/` holds one note
per source read; a run's report holds its numbers. This file points at all three and
repeats none of them.

How to maintain it:

- **Current state** is a few sentences, rewritten whenever an experiment lands. It says
  where the harness stands, which candidate is current, and what the last result
  changed. No figures.
- **Findings** are one row each. A finding states a belief and cites the evidence that
  supports it: a research note, a ledger row, or a per-experiment write-up. A row
  without evidence is a hypothesis and belongs under open questions instead. When
  later evidence contradicts a finding, its status becomes `superseded` and the row
  gains the evidence that did it; the row is never deleted or reworded to fit.
- **Open questions** are ranked as the loop driver ranks them: by the contract's
  priorities first, then by frequency of the failure they concern, then by how much
  uncertainty an answer would remove. The top row is the next question. A question
  that becomes a finding moves down with its evidence; one that a budget closes is
  marked `stopped`, with the reason.
- A finding's numbers stay in the report it cites. If a figure matters enough to be
  in this file, the report it comes from matters more, so link it.
- Every commit that adds a ledger row updates this file in the same commit, even if
  the update is only to the current-state paragraph.

## Current state

2026-09-25. Development runs a slim active suite of 19 examples from rungs 0–2, at the
user's direction, under [development contract 1](contracts/development-contract-1.md).
A candidate that saturates it moves on to Winner's bars 5–8. A scoreboard run now takes
about two minutes.

`online-time-warp@2` remains the incumbent: it passes rungs 0 and 1 and fails rung 2,
recorded guitar at exact timing. It has two separate defects there. Its support test is
miscalibrated across guitars. Its alignment slips in short bursts, and
[experiment 010](reports/010-slim-suite-and-burst-features.html) found that in most of
those frames the features favour the true position: the alignment path carries it away.
The next question is what in the path does that.

## Findings

Status is `holds`, `superseded` or `withdrawn`. Evidence links a research note, a
ledger row (`ledger.md#<row>`), or a findings write-up.

| # | Finding | Evidence | Status | Since | Notes |
|---|---|---|---|---|---|
| 1 | The published evaluation distinguishes alignment error from reporting latency; its example threshold does not validate our musical-position tolerance or deadline. | [Cont 2007 note](research/cont-2007-evaluation.md), [MIREX note](research/mirex-2015.md) | holds | 2026-09-25 | Instrument tolerances unchanged |
| 2 | The bounded search found no published audio-ignoring clock floor with comparable numbers. | [Search outcome](research/trivial-baseline-search.md) | holds | 2026-09-25 | An unsuccessful search, not a claim of absence |
| 3 | The root gate needed an explicit workspace suite for the listening bench and its disk-read evidence. | [Gate rule](../../tools/gate.mjs), [contract test](bench/test/contracts.test.ts) | holds | 2026-09-25 | Item A; production boundary already exists |
| 4 | The oracle distinguishes loss, abstention and live exposure; backdated corrections preserve the wrong live claim until replaced. | [Oracle arithmetic](bench/oracle/README.md), [o4 report](bench/oracle/o4-lost-then-found/report.md), [pair report](bench/oracle/comparison-o1-o4.md) | holds | 2026-09-25 | B/C instrument evidence; no listener result |
| 5 | The vendor score compiles without adding event types or tempo; the fixed recipes distinguish positive tails from supported following and give the two controls different durations. | [Set records](sets/harness-v1/README.md), [score/set checks](bench/test/set.test.ts) | holds | 2026-09-25 | D; no generated audio yet |
| 6 | Deterministic sine generation reproduces the independently drafted note boundaries and following labels; compiler sink counts do not measure musical polyphony. | [Generator checks](bench/test/generate.test.ts), [manifest](generators/sine-v1.json) | holds | 2026-09-25 | E |
| 7 | The runner reproduces the independent oracle record with sample-clock stamps and isolated chunks; complete-record prefix checks catch divergent output identities. | [Runner tests](bench/test/runner.test.ts) | holds | 2026-09-25 | F; silence-only futures cannot discriminate causality |
| 8 | The available library snapshot supplies structural following candidates, but no source is ready to freeze without independent solo/route/precision and access evidence. | [Evidence inventory](research/evidence-inventory.md) | superseded | 2026-09-25 | R1 qualification limit remains; finding 15 records the development amendment |
| 9 | The first end-to-end clock run agrees with the independent predictions and exposes false following and tempo drift; this validates the instrument at the synthetic harness profile, not listening capability. | [First run](ledger.md#g001-clock-harness-v1), [prediction and reproduction checks](bench/test/first-run.test.ts), [instrument freeze](contracts/freeze.json) | holds | 2026-09-25 | G; research contract remains provisional |
| 10 | The frozen v1 instrument cannot yet judge uncertain real-audio labels: its schema is generator-specific and its evaluator does not use annotation bounds. | [Contract prerequisite](contracts/research-contract-1-draft.md#instrument-prerequisite-and-activation), [v1 types](bench/src/types.ts), [v1 evaluator](bench/src/evaluate/index.ts) | holds | 2026-09-25 | A separate version is required before real comparisons |
| 11 | The selected first four-bar windows map structurally and decode reproducibly, while independent score/audio and precision checks remain open; Dust has a later route mismatch. | [Preflight snapshot](evidence/initial-four-bars-preflight.json), [preparation record](evidence/README.md) | superseded | 2026-09-25 | Findings 12 and 15 record subsequent review and proxy freeze; later Dust route hold remains |
| 12 | The user confirmed both selected clips are solo guitar and contain four bars; this does not establish beat precision or exact score/route correspondence. | [Source confirmation with clip hashes](evidence/source-review-1.json) | holds | 2026-09-25 | Winner remains first |
| 13 | Exact bar anchors alone, even under an assumed bounded local speed, cannot provide the approved interior timing coverage for these windows. | [Precision sensitivity](evidence/bar-anchor-precision-1.json), [analytic oracle](bench/test/v2-anchor-limits.test.ts) | holds | 2026-09-25 | Assumption calculation, not accepted labels |
| 14 | The v2 instrument distinguishes guaranteed, impossible and indeterminate correctness, preserves live exposure and applies conservative comparison decisions. | [Hand-worked oracle](bench/oracle-v2/README.md), [recorded checkpoint](bench/oracle-v2/recorded/checkpoint.json), [instrument contract](contracts/instrument-v2.md) | holds | 2026-09-25 | Instrument proof, not listener qualification |
| 15 | Existing sync anchors can be used as a fixed approximate development reference under the user's explicit direction; independent timing precision remains unmeasured. | [Development policy](contracts/sync-proxy-development-1.md), [experiment 002](reports/002-winner-sync-proxy.html) | holds | 2026-09-25 | Supersedes the manual-beat prerequisite for this initial loop only |
| 16 | The first spectral candidate improves control rejection but worsens positive following versus the clock on the frozen Winner proxy set. | [Run 002a](ledger.md#g002a-spectral1-winner-sync-proxy) | holds | 2026-09-25 | Failed positive agreement, exposure, episode and deadline targets |
| 17 | The register/harmonic revision increases rejection and loses more correct following; smaller exposure and residuals among fewer claims do not establish improvement. | [Run 002b](ledger.md#g002b-spectral2-winner-sync-proxy), [pre-run hypothesis](research/spectral-revision-2.md) | holds | 2026-09-25 | Hypothesis contradicted; neither version passes, sub-batch closed |
| 18 | Supplying approximate sync alignment does not rescue either frozen representation's positive confidence, and nearby competing positions often tie; scalar cutoff adjustment cannot separate those framewise cases reliably. | [Experiment 003](reports/003-recognition-at-sync.html), [run](ledger.md#g003-recognition-at-sync) | holds | 2026-09-25 | Privileged component diagnosis; does not rule out sequence-based disambiguation |
| 19 | The fixed constant-offset sensitivity test does not rescue recognition; shared normalized template decay erases within-active-set decay cues. | [Sensitivity and template analysis](reports/003-recognition-at-sync.md#what-explains-the-ties-and-what-to-try-next), [frozen template code](bench/src/candidates/spectralFollower1.ts) | holds | 2026-09-25 | Does not certify sync precision or attribute every tie to one cause |
| 20 | Neither spectral follower has been run on audio with exact labels, so experiment 002 cannot separate tracking defects from acoustic limits. | [Run g001](ledger.md#g001-clock-harness-v1) ran only the clock; [runs 002a/002b](ledger.md#g002a-spectral1-winner-sync-proxy) ran only the real clip | superseded | 2026-09-25 | Motivated [development contract 1](contracts/development-contract-1.md); superseded by finding 21, [run g004](ledger.md#g004-rung0-clean-winner) |
| 21 | On clean, exactly timed rung-0 audio, both frozen spectral followers fail the following gates, so their tracking defect is not an acoustic effect. | [Run g004](ledger.md#g004-rung0-clean-winner), [report 004](reports/004-rung0-clean-winner.md#results) | holds | 2026-09-25 | Answers question 9; supersedes the premise of finding 20 |
| 22 | Static-template ties with nearby wrong positions persist at exact alignment on pure sines, confirming they are structural. | [Report 004 recognition](reports/004-rung0-clean-winner.md#recognition-at-exact-labels) | holds | 2026-09-25 | Strengthens finding 19 |
| 23 | A follower's control rejection on the real clip did not show discrimination: the same frozen follower rejects the wrong score far less often on clean audio, where it also recognises far more. | [Report 004](reports/004-rung0-clean-winner.md#what-this-changes), [run 002a](ledger.md#g002a-spectral1-winner-sync-proxy) | holds | 2026-09-25 | Read control rejection together with positive acceptance, never alone |
| 24 | The development scoreboard reproduces experiment 002's real-clip metrics exactly for all three frozen candidates. | [Run g004 thermometer](runs/g004-rung0-clean-winner/summary.json) | holds | 2026-09-25 | The pipeline is deterministic |
| 25 | A per-frame support test cannot reject a different piece: single sustained notes shared by Winner and Dust match below the online time-warping follower's threshold on most frames. | [Run g005](ledger.md#g005-oltw-rung0), [report 005](reports/005-online-time-warp-rung0.md#why-the-wrong-score-is-accepted) | holds | 2026-09-25 | Same failure family as finding 23: support judged from the current sound, not the sequence |
| 26 | Onset-weighted semitone features remove the static templates' exact ties at exact alignment, though repeated passages still leave near-ties. | [Report 005 recognition](reports/005-online-time-warp-rung0.md#recognition-at-exact-labels) | holds | 2026-09-25 | Reference and audio share synthesis on rung 0, so this is an upper bound |
| 27 | Judging support from the aligned sequence, by comparing the tempo-consistent path with unconstrained frame matching, rejects the wrong score on rung 0 without losing the positive. | [Run g006](ledger.md#g006-sequence-support-rung0), [report 006](reports/006-sequence-support-rung0.md#results) | holds | 2026-09-25 | Answers question 12 for rung 0; reference shares synthesis with the audio |
| 28 | That path-versus-free cost gap is not robust to timbre: on the real clip it rejects the correct score almost everywhere. | [Report 006 thermometer](reports/006-sequence-support-rung0.md#thermometer) | holds | 2026-09-25 | Thermometer evidence, not used to select; the timbre rung must test it |
| 29 | The incumbent follows tempo curves within 80–120% of the handed tempo without a single wrong position; its wrong-score rejection is thinnest, though still above 95%, on constant tempi faster than handed. | [Run g007](ledger.md#g007-rung1-tempo), [report 007](reports/007-rung1-tempo.md#results) | holds | 2026-09-25 | Answers question 13; held-out seeds share the generator |
| 30 | following-evaluator@1 fails on clip durations that are not exact at 1e-9 s; sets must pad clips to a multiple of 3 samples at 48 kHz. | [Report 007 infrastructure failure](reports/007-rung1-tempo.md#an-infrastructure-failure-first) | holds | 2026-09-25 | Instrument limitation, handled in the set builder |
| 31 | Timbre alone, at exact timing, breaks the incumbent: most failed points are its support test rejecting a mostly correct alignment, and the test's calibration moves with the guitar in both directions. | [Run g008](ledger.md#g008-rung2-guitar-samples), [report 008](reports/008-rung2-guitar-samples.md#results) | holds | 2026-09-25 | Supersedes the hope in finding 27 that the cost gap cancels timbre; confirms finding 28 on controlled audio |
| 32 | With support ignored, the alignment is 87.8–96.3% correct on recorded guitars; its errors are short bursts during the decay of sustained bass notes, with no overall lag. | [Report 008 alignment](reports/008-rung2-guitar-samples.md#where-the-alignment-goes-wrong) | holds | 2026-09-25 | Suspected cause, untested: the sine reference never decays |
| 33 | On the real clip, the incumbent's alignment agrees with the sync reference on 69.8% of points; its support test reduces that to 12.7%. | [Report 008 thermometer](reports/008-rung2-guitar-samples.md#recognition-and-the-thermometer) | holds | 2026-09-25 | Thermometer evidence, not used to select |
| 34 | A reference with one fixed plucked decay removes the alignment bursts only on guitars whose decay it matches, and does not calibrate the support test across guitars. | [Run g009](ledger.md#g009-plucked-reference), [report 009](reports/009-plucked-reference.md#results) | holds | 2026-09-25 | Answers question 15: no; points toward envelope-insensitive features |
| 35 | Rung 2's held-out guitar sets have informed revisions and now count as development evidence; judging a revised candidate needs fresh independent guitar sources. | [Report 009 what this changes](reports/009-plucked-reference.md#what-this-changes) | superseded | 2026-09-25 | Superseded by the user's direction: the fresh check is Winner's next four bars, [development contract 1](contracts/development-contract-1.md#the-active-suite-and-the-next-bars) |
| 36 | The slim active suite reproduces the full scoreboard's results on its examples exactly and runs in about two minutes. | [Run g010a](ledger.md#g010-slim-suite-and-burst-features), [report 010](reports/010-slim-suite-and-burst-features.md#the-slim-suite-reproduces-in-two-minutes) | holds | 2026-09-25 | Development evidence only; generalisation is checked on the next four bars |
| 37 | In most frames where the incumbent's alignment is wrong on recorded guitar, its own features match the true position better; the path, not the features, carries it off. | [Run g010b](ledger.md#g010-slim-suite-and-burst-features), [report 010](reports/010-slim-suite-and-burst-features.md#the-features-do-not-explain-the-bursts) | holds | 2026-09-25 | Answers question 16 |


## Open questions

Ranked by row order; the top row is the next question the driver asks. The number
is an identifier given when a question opens and never reused, so citations stay valid. Status is `open`,
`in progress`, `answered` (with the finding number) or `stopped` (with the reason).

| Rank | Question | Why it is ranked here | Status | Owner item |
|---|---|---|---|---|
| 18 | What in the alignment path carries it away from positions its features prefer: endpoint choice by length-normalised cost, or the step constraints that limit recovery? | The bursts are the incumbent's alignment defect on rung 2 | open | [Report 010 decision](reports/010-slim-suite-and-burst-features.md#decision) |
| 19 | Can a support test be calibrated across guitars, rejecting Dust without rejecting correct alignments? | The incumbent's other rung-2 defect, and most of its real-clip failure | open | [Report 008](reports/008-rung2-guitar-samples.md#the-support-test-is-not-calibrated-across-timbre) |
| 14 | Does the incumbent pass rung 3, per-note onset jitter up to ±40 ms and chord spread up to 30 ms, on held-out seeds, and does the fast-tempo rejection margin hold? | Deferred until a candidate passes rung 2; jitter blurs the onsets its features rely on | open | [Report 007 next](reports/007-rung1-tempo.md#next) |
| 11 | Which ladder rung first breaks the best candidate, and does recognition at supplied labels fail on that rung too? | Ranks the remaining rungs by the failure they expose | open | [Development contract 1](contracts/development-contract-1.md#the-ladder) |
| 7 | Can independent source/label checks establish timing bounds for later formal qualification? | Still relevant to stronger claims; explicitly not required for current proxy development | open, deferred to qualification | [Real-evidence preparation](evidence/README.md) |
| 17 | Which further independent guitar recordings can serve as fresh held-out evidence for rung 2? | The current held-out sets are spent | stopped: the user chose the next four bars of Winner as the fresh check instead | [Report 009 what this changes](reports/009-plucked-reference.md#what-this-changes) |
| 16 | In the alignment's error bursts on recorded guitar, which feature bands make a wrong reference position look closer than the true one? | Needed before another candidate change, by experiment 009's rule | answered (finding 37) | [Report 009 next](reports/009-plucked-reference.md#next) |
| 15 | Does rendering the listener's reference with a fixed plucked decay, with nothing else changed, remove the alignment slips and bring the support test within the gates on rung 2's held-out sample sets? | Both rung-2 defects may share one cause: a reference that never decays | answered: no (finding 34) | [Report 008 decision](reports/008-rung2-guitar-samples.md#decision) |
| 13 | Does the incumbent follow rung 1, tempo change within 80–120% of the handed tempo, on held-out seeds? | The next rung; the first where the clock floor must fail on the positive | answered (finding 29) | [Report 006 next](reports/006-sequence-support-rung0.md#next) |
| 12 | Does judging support from the aligned sequence, by comparing a tempo-consistent path with unconstrained frame-by-frame matching, reject the wrong score on rung 0 while keeping the positive? | The only rung-0 failure left for the comparator; the comparison is also meant to survive timbre change | answered for rung 0 (finding 27) | [Report 005 next](reports/005-online-time-warp-rung0.md#next) |
| 10 | Does a causal online time-warping follower with onset-emphasised features pass rung 0 and the tempo rung? | The published standard method is the comparator every home-grown candidate faces; the tempo rung is where the clock floor breaks | answered for rung 0: fails the wrong-score control (finding 25) | [Development contract 1](contracts/development-contract-1.md#candidates) |
| 9 | Do the frozen spectral followers meet the following gates on rung 0, clean sine audio of Winner bars 1–4? | A failure on exact, clean audio is a tracking defect; it reinterprets 002 before any new candidate | answered (findings 21–23) | [Development contract 1](contracts/development-contract-1.md#candidates) |
| 8 | At supplied sync alignment, do the frozen templates discriminate the intended passage? | Separates component recognition/confidence from path-selection errors | answered (findings 18–19); diagnostic closed | [Experiment 003](reports/003-recognition-at-sync.html) |
| 6 | Can the initial spectral follower or one harmonic/register revision improve control rejection without losing Winner following? | First fixed real-audio algorithm question | answered (findings 16–17); sub-batch stopped at its two-version limit | [Experiment 002](reports/002-winner-sync-proxy.html) |
| 2 | How has real-time score following been evaluated elsewhere, and do our ±0.25-quarter tolerance and 200 ms deadline sit inside those norms? | FIRST_STEP §10 question 1; answers whether the first contract's tolerances are defensible before anything is measured against them | answered (findings 1–2) | FIRST_STEP item A |
| 3 | Is there a published trivial baseline for score following, so our clock floor can be compared with the usual one? | FIRST_STEP §10 question 2; decides whether the first ledger row has an external reference point | answered (findings 1–2) | FIRST_STEP item A |
| 4 | Which library recordings and re-amplification opportunities are eligible real evidence for the following milestone, and with what anchor precision? | The structure document runs real evidence alongside the pipeline; without an answer the first human-approved contract cannot name its evidence supply | answered (finding 8; missing evidence explicit) | FIRST_STEP item R1 |
| 5 | Does the first run of the clock follower over `harness-v1` reproduce the pre-registered predictions in FIRST_STEP §9? | The whole first step exists to answer it; a mismatch is an instrument defect, never a finding about the candidate | answered (finding 9) | FIRST_STEP item G |

## Superseded and stopped

Rows moved here keep their original number or rank so citations stay valid.

| # or rank | Was | Superseded or stopped by | Date |
|---|---|---|---|
| Rank 1 | Can attack-sensitive features and short sequence evidence distinguish passages while retaining positive recognition, on the real Winner clip? | **Abandoned** by user direction before any work: development moves to the synthetic ladder first. The idea survives in the online time-warping comparator. [Development contract 1](contracts/development-contract-1.md#effect-on-existing-records) | 2026-09-25 |
