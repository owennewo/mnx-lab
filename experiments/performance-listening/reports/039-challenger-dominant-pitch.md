# 039 — Dominant-pitch decoding for Martin's wrong-score claims

## Pre-registration

2026-10-05. **GPT-6.1-Sol (high) in Codex**. Experiment 039, challenger track,
run 3 of 6 in the sampled-guitar promotion batch. Question 26; one listener version,
**basic-pitch-chain@2**, changing only the score-blind offline decoder input policy.

### Question and alternatives

Can keeping only each frame's strongest note activation remove Martin's false low-G2
claims while retaining all correct development-guitar assessments and quiet-noise
rejection? The preserved Martin s2-45 trace has a G2 event of confidence .398 alongside
B4 at .835, but its G2 onset peak exceeds .5: disabling the residual Melodia pass alone
is not a sound explanation for removing every such event. Either the low ghost loses
frame competition and disappears, or it wins long enough to survive decoding; a real
pitch may also lose during attacks or decays and break acceptance or timing.

The hypothesis is deliberately monophonic, matching the current chain's scope. It is
not a low-register exclusion, score-derived frequency restriction or fitted threshold.
The raw maps, decoded events and paired evaluations distinguish suppression from
simply refusing both controls and correct performances (L8).

### Method and evidence

1. Land this pre-registration before executing the new policy or measuring. Commit
all producer code and require a clean tree, unchanged landed pre-registration, unused
run ID and HEAD tag `<run-id>-source`. Primary **g039-challenger-dominant-pitch**;
one infrastructure-only rerun **g039a-challenger-dominant-pitch**. Dry-assemble and
check public summary shape before decoding; persist/hash each observation and each
assessment as completed. If writing the final record fails, repair writing without
remeasuring completed examples. Never impose a summary-size refusal after measuring.
2. Use all **576** frozen examples of contract2-challenger-guitar-noise-v1: 192
performances, 192 w2 controls and 192 pink-noise controls, clean then single silent
hesitation, all four development guitars. Use audited assessment3/gates2/oracle4
unchanged, including pooled assessment finding gates. This is an assessment-component
repair, not a full guitar-stage claim. There are no passed guitar substages or guitar
sentinels yet. The amendment retires the sines and starts guitar full-sweep obligations
at the first guitar-stage claim; no retired sine or held-out set runs here.
3. Reuse g035's guitar and g038's noise **raw model maps** after verifying producer,
model/environment/decoder and input/artifact hashes. The model, resampling and
stitching are unchanged. Verify every original audio, score and label before reuse;
any changed relevant source/input requires fresh measurement or an infrastructure
stop, never silent reuse. Cite original @1 assessments and incumbent evidence by
verified hash; incumbent and frozen baselines are unchanged and not rerun.
4. Apply a fixed frame-local winner policy to the raw note map: `argmax` across all
88 bins, lowest bin on exact ties. Set losing note **and onset** bins to zero; leave
winning entries, contour map and frame times unchanged. Run the official pinned
Basic Pitch 0.4.0 decoder with all existing defaults (onset .5, frame .3, minimum 11
frames, inferred onsets and Melodia enabled). No parameter fitting, extra event filter,
score context or frequency bound. Save score-blind decoded observations and diagnostics
on removed model energy/pitches and changes from old decoded events. Downstream
BasicPitchChain alignment/reporting is inherited byte-for-byte; @2 gets a separate
module/configuration. No existing frozen producer is edited.
5. Run every example's assessment with @2, retaining serialized reports, evaluator
results, failures, note claims and timing errors. Compare with @1 on the same labels.
Record @1's Martin 24 failures separately and verify their disappearance or persistence.
Count raw/decoded low-G2 occurrences; do not equate decoded pitch with a score claim.
There is **no live listener measurement or cursor verdict**: question 30 owns streaming,
compute-inclusive cost and seam@3/audit. No new instrument or observation timing
contract is introduced; this transformation changes listener evidence, not its oracle.
6. Bounded primary-source refresh: pinned Spotify decoder's onset and residual-energy
branches, recorded separately from the inference motivating this monophonic mask.
Synthetic policy checks exercise ties, preservation, shape/refusal and sustained
single-pitch decoding. Bench tests/typecheck and final rebased gate must pass.

### Predictions and contradictions

1. @2 rejects all **192 w2** assessments, including all **24** former Martin failures;
any remaining claim contradicts the repair prediction.
2. All **192 correct performances** retain passing assessments, with every score note
matched and zero false findings; any lost note or failed timing gate contradicts it.
3. All **192 quiet-noise controls** retain rejection and null tempo, intervals and flags;
any score claim or tempo contradicts it. Raw/decoded noise pitches may remain.
4. All 576 input/label records and reused relevant producers verify by hash; every
assessment is measured under unchanged instruments, with zero held-out/reserved access.
Any mismatch or forbidden access contradicts integrity.

### Decision rules fixed now

- **D1 component repair:** complete valid measurement, all 576 individual assessments
and every assessment pool pass, including all 24 former Martin failures. Carry @2's
fixed offline policy forward to question 30. No live or stage pass, promotion or suite
change follows from this component result.
- **D2 resolved failure:** valid complete measurement with any assessment/pool failure.
Reject this repair as a complete solution; preserve whether Martin improved and whether
correct notes/noise regressed. Rank the measured lowest assessment failure before
streaming; no tuning or second listener version within 039. The batch may continue
with a separately pre-registered repair, subject to the stopping rule.
- **D3 infrastructure/inconclusive:** a failure before measurement preserves its error
and zero measurements; a failure during measurement preserves all completed hashed
records. Diagnose before the one technical rerun. A record-only failure repairs the
writer without rerunning measurements. Unresolved infrastructure, integrity failure or
observations outside D1/D2 is inconclusive and closes the batch.

### Carried-over state and preflight

From [038](038-challenger-quiet-noise.md#resulting-stopping-count-budgets-and-evidence-access):
main stopping 0, 3 versions/11 comparisons; challenger stopping 0, 1 version/2
comparisons, exploration spent. Qualification 6 versions/12 slots unused; held-out
guitars, reserved/final evidence and Winner bars 5–8 untouched. This adds one challenger
version/comparison. Because an offline-only change cannot clear the lowest open guitar
substage's two outputs, conservatively charge one uncleared version to the challenger's
stopping count even on D1; the next version must still pass the full substage.

Preflight found only main checked out, no 039 committed/archive/private record or owner.
Own worktree listening-039, dependencies installed once; FFmpeg, pinned Python/model,
raw observations, frozen guitar/noise inputs and prior records are readable. Private
output access is checked before measurement. No threshold calibration is needed or
performed. The user's instructions are preserved:

> Your model and tool: GPT-6.1-Sol (high) in Codex.

> You cannot ask the user questions: record anything that needs them in your report and the research log.

Any needed user decisions go below the results and into the research log; this session
runs exactly one experiment, lands it, retires its worktree and stops.

## Results

**D1: the offline component repair passes every frozen development-guitar assessment.**
The fixed frame-local mask removes all 24 Martin wrong-score claims without any
assessment regression. No live measurement, guitar-stage pass or promotion is claimed.

### Correct performances and both controls

| Guitar | Clean: performance / w2 / noise | Hesitation: performance / w2 / noise | Matched notes | Intervals within tolerance / expected |
|---|---|---|---|---|
| Tone.js acoustic | 8/8; 8/8; 8/8 | 40/40; 40/40; 40/40 | 288/288 | 240/240 |
| Martin | 8/8; 8/8; 8/8 | 40/40; 40/40; 40/40 | 288/288 | 240/240 |
| Spanish | 8/8; 8/8; 8/8 | 40/40; 40/40; 40/40 | 288/288 | 240/240 |
| Fender | 8/8; 8/8; 8/8 | 40/40; 40/40; 40/40 | 288/288 | 240/240 |
| **All** | **32/32; 32/32; 32/32** | **160/160; 160/160; 160/160** | **1,152/1,152** | **960/960** |

Every correct performance has zero false findings. Every control claims zero matched
score notes and reports null overall tempo, no intervals and no flags. Every
assessment pool passes; clean and hesitation pools have no missing/wrong/dead or
bar-flag positives, so these results establish no finding recall on those deviations.
Controls remain excluded from pooled finding rates.

| Paired @1 → @2 result | Count |
|---|---|
| Assessments passing | 552/576 → 576/576 |
| Former Martin w2 failures repaired | 24/24 (4 clean, 20 hesitation) |
| Previously passing assessments regressed | 0/552 |
| Serialized reports identical | 360/576 (the unaffected controls) |
| Maximum absolute interval error | 37.174 ms → 35.890 ms |
| Maximum absolute overall-tempo relative error, @2 | 1.300% (gate 5%) |
| Maximum onset / end shift versus @1 on matched performance notes | 34.830 ms / 34.830 ms |

All 192 performance reports change some observation timing/end fields under the new
mask, while retaining every note and passing every interval. This is preservation of
assessment correctness, not byte identity of the performances' reports. The same
frozen chain/report implementation is inherited; only its decoded evidence changed.
The four guitar sources are development timbre units, and the rendered variants are
correlated coverage, not independent evidence of population reliability.

### What removed the false claims

Across the **234 unique model-map inputs** (192 guitar recordings and 42 noise WAVs),
old decoding produced 1,753 events and the masked decoder 1,351. The old maps decode
24 G2 events; the new policy decodes **none**. The raw activations remain preserved:
this is suppression by a fixed monophonic competition rule, not a repaired model or a
learned silence threshold. Each former Martin failure now claims no score note.
The pinned decoder source distinguishes onset-qualified ghosts from residual-energy
notes; the [source note](../research/dominant-pitch-039.md) motivates the intervention
without claiming that disabling Melodia was measured as an alternative.

Noise still decodes pitches on **42/42** unique clips: **199 events**, MIDI
27, 28, 29, 30, 32, 35, 36 and 41. None is in s1/s2's MIDI 60–72 register. As in 038,
these noise controls pass through pitch mismatch, not universal front-end silence
rejection. One seed and correlated length prefixes do not establish lower-register,
microphone or noise-distribution robustness. No threshold was fitted or swept.

### Execution, provenance and checks

One completed run, **2026-10-05T08:04:43.832Z–2026-10-05T08:05:05.250Z**, elapsed
**21.416 s**. No infrastructure failure, tuning or technical rerun. Official model
inference is reused by verified hash; the new 234 decodings are fresh and took **0.886 s**
in total around masking/decoding, excluding Python initialization, hashing and writes.
This is offline component cost only; it supplies no live cost or latency result.

Pre-registration **c093e806** was fast-forwarded and pushed before any new policy
execution. The committed source is **ed434d0fe27271e30055fe7fa169568d58821838**,
tagged `g039-challenger-dominant-pitch-source`. The runner checked the unchanged
landed pre-registration, clean tree, tag, unused ID and public-record shape before
decoding. Each masked-map/decoded record and each of 576 assessments was written and
hashed as completed. The public summary is **111,469 bytes**, below the target.

**1,719 pre-existing artifacts** were verified before decoding; with 468 new masked
and decoded observations, the summary records **2,187 artifact checks**. All relevant
prior model, preprocessing/decoder, chain, assessment, audio/model compilation and
input sources verify against g035/g036/g038. The external guitar-nn commit and clean
tree, environment lock and dependency versions, config, model, installed package Python
source and retained upstream snapshots are checked. The original 384 non-noise
examples/labels are unchanged; the noise label's evaluated fields are verified against
its prior pair record before reattachment across guitars. No prior decoded @2 result
is reused. Frozen incumbent/baseline behavior is preserved by source/evidence identity;
no sine, held-out guitar, reserved/final evidence or Winner bars 5–8 is executed.

The synthetic policy checks cover lowest-bin ties, preserved winning activation and
contour, nonmutation, prefix locality, invalid shapes, and a decoder case where the
strong C4 survives and the weaker concurrent G2 disappears. The downstream adapter
check passes for matching notes, unrelated pitches and empty evidence; the bench
TypeScript check passes. The pre-registration landing gate passed **509 bench tests**,
37 targeted root tests, static checks and build. The final rebased landing gate is
recorded separately in the private run directory; it must pass before landing results.
No new evaluator oracle or timing seam requires an audit from this experiment.

| Artifact | Path / SHA-256 |
|---|---|
| Public summary | [g039](../runs/g039-challenger-dominant-pitch/summary.json); `05cfdb597d7c9d92ea1ed9252b0db1961648e30465ee08e0278489d3a67775a0` |
| Frozen amended guitar/noise manifest | `/home/williao/dev/mnx-listening-data/contract2-challenger-guitar-noise-v1/manifest.json`; `961d5dce4a152af17da006c2f86dfdd48fee32acae74f38b9def988462b229e8` |
| Assessment index | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g039-challenger-dominant-pitch/results.json`; `34705618523dd21ed3838b2d569ebcd5108962008edbb0c84ef9fe6870b74a25` |
| Reuse validation | Same private directory, `validation.json`; `3ae617de84362ea30c9527679de819f686416df03990e5f49b13a31bd5c06031` |
| Diagnostics and former failures | Same private directory, `details.json`; `6f1455b23fc65ad81c82caeefd51106330e023a61af0ee879b34e4ec3094918b` |

Individual transformed maps, decoded events and assessment records are named by
path/hash in the public summary's indexes. Execution and landing-check logs are kept
beside those private artifacts; the run's record never refuses a measured result for size.

## Against the predictions

| # | Outcome | Evidence |
|---|---|---|
| 1 | Held | 192/192 w2 reject; every former Martin claim removed |
| 2 | Held for correctness | 192/192 performances pass, 1,152 notes matched, zero false findings; timing fields change within gates |
| 3 | Held within these controls | 192/192 quiet-noise assessments reject, null tempo and no intervals/flags; lower pitches still decoded |
| 4 | Held | Every input/label/relevant source checked; all 576 assessed under unchanged audited instruments; no protected evidence access |

## Decision

**D1 applies.** Carry the fixed **basic-pitch-chain@2 offline policy** to question 30.
Question 26 is answered on these frozen development examples. The incumbent stays
**event-chain@3**; no suite status, sentinel, evaluator, live policy or promotion changes.
The @1 spike's cost/deadline limits remain. No formal guitar substage is cleared by
this offline-only evidence, and this author neither starts question 30 nor audits it.

### Resulting stopping count, budgets and evidence access

Main stopping **0**, **3 versions/11 comparisons**, unchanged. Challenger **2
versions/3 comparisons**, exploration spent. As fixed in the pre-registration, its
stopping count is conservatively **1 uncleared version**: the lowest open guitar
substage still lacks its live output. This counts incomplete stage clearance, not an
observed offline failure; D1 remains the component verdict. Qualification **6
versions/12 slots** unused; held-out guitars, reserved/final evidence and Winner bars
5–8 untouched. Sines retired; guitar sweeps begin at the first guitar-stage claim.
Batch **3 of 6 completed**, continuing to question 30 with 34. This session stops
when the results are landed and the worktree retired.

## Next

**Question 30 with 34:** build the separately versioned streaming producer with its
compute-inclusive clock, complete observation-seam@3 rules/cases and independent audit,
then measure the cursor. Reuse this fixed offline component's evidence only while its
sources, inputs and adapter remain unchanged by hash. Both outputs and all controls
on all four guitars must pass before question 31's formal stage claim, then question
32's one-shot held-out confirmation; the user promotes after independent batch review.

**Awaiting the user:** no new decision from 039. Promotion, future microphone-stage
gates, qualification and Studio product choices remain theirs, as do the standing R10
sentinel tie-break/pool and baseline-sweep questions. The conservative stopping charge
is explicit for the reviewer; it is not a request to loosen the stopping rule. No
questions were asked.

**Direction of travel.** The unchanged event sequence aligner and tempo/interval
accounting remain useful on simple monophonic guitars. Strongest-pitch competition is
intentionally monophonic: it will suppress genuine chord tones and must be replaced
or separately versioned before chords. Lower-register noise, repeated articulations,
additional sounds and microphone performances need new evidence. The expensive live
producer is still a separate unresolved component.

## Attribution

Pre-registered, implemented, executed and recorded by **GPT-6.1-Sol (high) in Codex**.
Independent seam audits and the closing process review remain other sessions' work.
