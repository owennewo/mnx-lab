# First assessment campaign: a causal listener on synthesized sources

Date: 2026-09-25. Status: proposed plan; no implementation or results yet.
Serves: the implementation/research loop, not an MNX spec proposal.

This campaign implements the first slice of [APPROACH.md](APPROACH.md) and
[EXPERIMENT_HARNESS_STRUCTURE.md](EXPERIMENT_HARNESS_STRUCTURE.md): generate a small
labelled performance, feed it to a causal listener, and independently explain what
that listener got right, got wrong, could not determine, and decided too late.
The first deliverable is the measurement instrument. The first algorithm comes after it.

**Recommended first question:** can a simple audio-driven follower locate a clean
monophonic performance and withdraw unsupported claims, where a score-tempo clock
cannot? Here “assessment” means following, uncertainty and unsupported following.
Note-level accusations are a later milestone. Controlled note changes belong in the
first sources, but their presence does not authorize a note-assessment success claim.

The endpoint is a reproducible first report, including failures and a mechanically
chosen next action. A synthetic pass establishes the harness and this narrow profile.
Retaining a useful listener requires the real-source checks in the parent approach.
Writing this plan does not approve an experimental contract: the numerical proposal
below is ready for human review before candidate selection begins.

## 1. Shared contract and first score

Use a local, validated MNX fixture with two 4/4 bars, one part, one sequence per bar,
and eight quarter-note events:

```text
bar 1: C4 D4 E4 F4
bar 2: G4 A4 B4 C4
```

The suggested upstream `vendor/mnx/docs/static/examples/json/two-bar-c-major-scale.json`
contains C4 D4 E4 F4 / G4 A4 B4 C5. It has no tempo marking, and its final C5 exceeds
the approach's initial C4–B4 range. Copy its musical structure into an experiment-owned
`.mnx.json`, change only the last pitch to C4, and record the upstream submodule commit,
path, input hash and transformation. Keep the original as a separate range-extension
probe. Neither edit the vendor file nor make the experiment require an initialized
submodule. Do not put these audio goldens in the engraving scenario corpus.

Assign stable local event IDs; retain measure, beat and event references. The repeated
C4 is intentional: known-start, continuous traversal disambiguates its two occurrences;
pitch alone does not. The adapter rejects unsupported score constructs explicitly
instead of silently flattening repeats, chords, ties or tuplets.

The first profile is exactly declared: C-major pitches in C4–B4 at A4=440 Hz, monophonic,
no overlap, sine timbre, fixed level, no modulation, quarter notes at 60 BPM, half-beat
sound with silent gaps, no repeated sections, known start and continuous traversal.
The runner supplies start position and nominal tempo as declared public conditions.
The nominal tempo belongs in those conditions, not in invented standard MNX fields.

Synthesize mono 24,000 Hz PCM. The eight scheduled onsets are samples
`0, 24000, …, 168000`; each sound occupies 12,000 samples. Use peak amplitude 0.25,
5 ms raised-cosine attack/release inside that interval, zero phase at each onset,
and digital silence outside it. End the musical span at sample 192000; append one
second for observing withdrawal/end behavior. Score duration is one beat; sounding
duration is half a beat. Label schedule onset, envelope support and score duration
separately. A scheduled boundary is sample-exact, not a claim that a listener can
recognize the note at its first sample.

Freeze generated audio bytes as well as the recipe and labels; their hashes, generator
version and runtime identify a set. Reproduction compares hashes in the pinned runtime;
a platform's floating-point difference cannot silently replace the frozen source.
Manually check the eight event mappings and inspect/listen to the first WAV. Verify
silence intervals, duration, peak level and a few independently calculated frequencies.
An independent generator sanity check is separate from running the candidate on itself.

## 2. Contracts before algorithms

Use TypeScript for the local harness, JSON for versioned fixtures/manifests, NDJSON
for append-only decisions, WAV for inspectable audio, and JSON plus Markdown reports.
Keep contracts small; prefer a CLI and files over a service, database or dashboard.
These are proposed paths under `experiments/performance-listening/`, not existing APIs:

```text
contracts/       listener-v1, golden-v1, evaluation-v1, synthetic-contract-v1
fixtures/       local MNX scores and handwritten evaluator-oracle cases
sets/           frozen manifests, actual labels, expected assessments, provenance
src/            score adapter, generator, runner, evaluator, report, retention rule
candidates/     clock-v1, spectral-follow-v1, yin-follow-v1
research/       bounded questions, sources and resulting experiment decisions
ledger/         append-only experiment records and reserved-access registry
runs/           ignored bulky audio/traces; retained manifests and report snapshots
```

Retain or content-address every asset needed to replay a reported result; “ignored”
means uncommitted, not disposable. Experiment code may consume `src/model/` and
`src/audio/` within the existing boundaries. Production must not import the experiment.
Use root Vitest harness tests for contracts and the oracle; do not create a second
production score model or inherit the archived experiment's contracts and thresholds.

### Listener exchange

Construct a listener with only the intended score and public delivery/profile conditions.
Feed `push({startSample, pcm})` in order, then `finish()` after the final chunk.
The runner releases 240 samples every 10 ms of logical time; a causal analysis window
ends at the last released sample. No centered windows with future padding, full-clip
normalization or end-of-file duration hint before `finish()`.

A decision has an ID, optional superseded ID, a musical reference time, a runner-stamped
release time and a runner-stamped wall completion time. The listener declares its
latest consumed sample; the runner checks it. The payload is one of:

- `position`: one or more score-position intervals, including occurrence identity,
  probability per alternative and explicit unresolved probability mass;
- `unsupported`: a reason such as no evidence, mismatch or lost position;
- a reserved note-verdict variant, disabled in this campaign.

Probabilities including unresolved mass sum to one. Confidence means probability of
being inside the stated positional tolerance, not spectral peak strength. Record raw
acoustic strength separately. Multiple alternatives cannot become a single “certain”
position merely because one is the eventual hindsight route.

No emission is counted as unavailable coverage, never as an implicit correct abstention.
The live estimate persists until replaced; a stale confident claim therefore accrues
wrong exposure. Historical corrections append records and never rewrite what was shown.
A historical correction does not update the live estimate unless it also supplies a
current-time decision. Keep live correctness and retrospective correctness separate.

The candidate process receives neither golden paths nor source IDs/recipes/labels.
The runner decodes and streams audio; a separate evaluator reads private goldens.
Use a narrow process protocol with an explicit asset allowlist, rather than handing
an in-process candidate a complete source object and relying on unused properties.

### Golden and evaluator

Each golden contains three separate objects: intended score; actual sounding events
and performed route; expected following assessment. Also record all eight complexity
dimensions, recording conditions, provenance, label precision, source-family ID,
partition and version. Reserve note-correspondence/verdict fields without scoring them.

Reference regions may be exact, bounded, ambiguous or unknown. For this source the
hindsight route is exact, but evidence becomes answerable only after an observation
interval. Freeze an initial 150 ms allowance after the first onset and after a new
contradiction/recovery cue. Report these intervals as pending with their duration;
do not silently exclude them or reward confident guesses within them. Ordinary
half-beat gaps permit position prediction under the declared fixed tempo. An absent
expected onset becomes answerable 150 ms after its scheduled time. The final musical
boundary plus 150 ms starts the trailing-silence control region.

On a single omitted/substituted note the performed route still exists: a musician's
mistake does not imply a different piece. Evaluate following coverage/recovery, allowing
abstention where acoustic support has gone. Sustained incompatible notes are a negative
control. Label that distinction in advance, independently of candidate behavior.

Evaluate on a fixed 10 ms grid using the decision actually available by each tick.
Also measure each decision at its claimed reference time, so a backdated accurate
estimate cannot hide a late live cursor. Freeze these counting rules:

| Quantity | Numerator and denominator / accounting |
|---|---|
| Position correctness | Time with a supported position within 0.20 beats of the eligible reference / answerable positive time; report position-error quantiles separately |
| Coverage | Time with a position claim / answerable positive time; abstention and absent output remain separate |
| False following | Time claiming any supported position / answerable negative-control time; additionally report confident false following at probability ≥0.8 |
| Wrong exposure | Seconds of the live displayed claim outside tolerance, plus longest continuous episode; revisions stop future exposure, never erase past exposure |
| Loss/recovery | Loss episodes after acquisition; recovery delay from first subsequent distinguishing onset; unrecovered episodes stay in the denominator |
| Ambiguity | Exact supported alternative-set agreement and unsupported singleton claims / ambiguity-labelled time; a set containing every position is not automatically correct |
| Confidence | Fixed probability-bin reliability counts and Brier score against eligible correctness; use exact labels, report ambiguous/unknown support separately |
| Timeliness | Correct decisions by onset/cue +150 ms / eligible cues; absent and wrong decisions are missed deadlines, not missing latency observations |
| Unassessed evidence | Unknown and pending seconds, each / full duration, with reasons |

Also report timing residuals in milliseconds using the labelled score-to-audio map.
Pitch matching at ±35 cents is a candidate proposal, not the following evaluator's
truth rule. Note onset/duration error thresholds are **not applicable** until the
separate note-assessment contract exists. Never report their unmeasured accuracy as zero.

Build an evaluator oracle by hand before a listener exists: perfect track, shifted
track, permanent abstention, silent output, false following on silence, delayed correct
decision, incorrect decision later revised, ambiguous alternatives, unknown region,
and loss with no recovery. Include a simple arithmetic case: over an answerable 1 s
span, correct for 0.4 s, wrong for 0.2 s, unsupported for 0.4 s means 60% claim coverage,
40% correct-position coverage, 0.2 s wrong exposure and 40% abstention. A revision
arriving afterward leaves those live counts unchanged. Define half-open intervals so
boundary counts are reproducible. The report must render these cases before real runs.

## 3. First synthesized set

Freeze `sine-dev-v1` with the following ten cases. They are related cases from one
generator and one score family, not ten independent recordings.

| Case | Actual performance | What it establishes |
|---|---|---|
| clean | Exact recipe above | Basic acquisition, tracking through gaps and completion |
| silent | All zero samples for the same duration | A clock cannot prove following |
| wrong-pitches | Same rhythm, every pitch raised one semitone | Reject rhythmic coincidence; profile records altered actual pitch range |
| wrong-order | Reverse the eight-note order, same rhythm | Reject incorrect sequence; label any locally indistinguishable prefixes as pending/ambiguous |
| omit | Omit event 4, retain the schedule | Loss/abstention and recovery without a missing-note verdict |
| substitute | Replace event 4 with F-sharp4 | Local discrepancy without declaring the whole route unrelated |
| extra | Insert D-sharp4 during event 4's gap, for 200 ms | Resistance to an extra sound; preserve the route |
| diverge | First three notes correct, then repeat F-sharp4 | Withdrawal after previously supported following |
| recover | Replace events 4 and 5 with F-sharp4, resume at event 6 | Bounded forward reacquisition after contradictory evidence |
| delayed-start | 500 ms leading silence, then the correct sequence | Out-of-contract diagnostic of dependence on start timing; not part of the fixed-start pass |

Add evaluator-only ambiguity fixtures immediately; defer audio repeated-phrase navigation
until its contract exists. Pair identical PCM prefixes with different tails at several
cut points (inside a tone, at an onset and inside a gap). Include different total lengths.
Prefix decisions must agree byte-for-byte after removing measured wall times, including
revision IDs and abstentions; no future-dependent output may appear before divergence.
Also test the same prefix delivered through independent fresh candidate instances.

Once the sine pipeline stands, render the same cases with a declared harmonic generator:
partials 1–5, amplitudes proportional to `1/k`, same envelope, normalized to the same
RMS as its sine counterpart without clipping. This is a harmonic-profile probe, not a
new independent source or evidence of real-instrument transfer. Keep it separate in
reports. A later weaker/missing-fundamental probe specifically challenges peak picking.

All these visible recipes are **development evidence**. No final acceptance set is
consumed. Before a synthetic reserved comparison, freeze two additional distinct
C-major phrase families and their variants in a manifest; keep every variant of a
family in one partition. They test transfer within this generator only. Log every
reserved access. Once inspected failures guide a change, those families become dev;
stop if no fresh evidence remains. More seeds do not repair source independence.

## 4. Baselines, first algorithm and research

Implement `clock-v1` first: advance from the declared starting beat at 60 BPM, ignore
PCM, emit a confident position. It should look excellent on clean playback and fail
negative controls. Add an always-unsupported diagnostic to expose any evaluator that
mistakes low false-following time for useful performance. Neither is the oracle.

The first real hypothesis, `spectral-follow-v1`, is deliberately small:

1. From a trailing 2,048-sample Hann window and 240-sample hop, obtain RMS, dominant
   spectral peak and peak concentration. Reject low-energy/unclear frames; interpolate
   the peak frequency. Do not search only score pitches, which would force wrong audio
   onto the nearest expected note.
2. Accept a pitch observation after two consistent hops, initially within ±35 cents.
   Detect note starts from energy transitions; map accepted observations onto candidate
   events in a bounded forward window (current event and next two events). The temporal
   prior is the declared 60 BPM schedule with an initial ±0.20-beat window.
3. Maintain alternatives when pitch and temporal evidence cannot distinguish positions.
   Project briefly through expected gaps. An incompatible observation, or a missed
   expected onset beyond the allowance, withdraws support rather than advancing on
   elapsed time alone. Permit reacquisition within the forward window after matching
   evidence; no arbitrary jumps or restart support is claimed.
4. Emit current position, alternatives or unsupported. Freeze energy, stability,
   confidence mapping and expiry parameters on dev evidence; retain them in candidate
   configuration. Do not describe uncalibrated signal strength as a probability.

This tests whether acoustic support improves the complete following result over a clock.
Its predictable weaknesses are repeated material, changing tempo, harmonics and weak
fundamentals. Those are reasons to run discriminating probes, not hide difficult cases.

Use `yin-follow-v1` as the first **external-method comparator**: aubio's explicit `yin`
pitch method, with the same chunk policy and the same local following policy. This is
a complete listener with an external acoustic component, not an independently designed
score follower. It isolates whether the peak detector limits the first result; it cannot
establish that our alignment method is better than external score-following methods.
Pin the actual dependency version, license, window/hop configuration and wrapper hash
before use; measure wrapper/process costs as well as algorithm costs.

Initial bounded research, consulted 2026-09-25:

| Source | Reported fact and limit | Local consequence (our inference) |
|---|---|---|
| [aubio pitch API, version 0.4.0](https://aubio.org/doc/0.4.0/pitch_8h.html) | Documents frame input, explicit YIN/YINFFT choices, silence controls and pitch confidence. This is API documentation, not evidence of following accuracy; its confidence is acoustic. | An aubio YIN wrapper supplies an informative alternative pitch front end. Verify the installed version; evaluate position confidence independently. |
| [Dixon, DAFx 2005: Live Tracking of Musical Performances using On-Line Time Warping](https://dafx.de/paper-archive/details/o-kAKlRZ1QVrnYxd28nF0g) | The proceedings abstract describes incremental audio alignment with positive spectral-difference features, tested on piano performances. It does not establish mismatch rejection or guitar transfer. | On-line time warping is a candidate alignment comparator if failures concern timing/alignment. Do not turn ordinary whole-clip DTW into a “causal” comparator by relabelling its output. |

The alternate hosted Dixon PDF timed out during this planning search; only the proceedings
abstract supports the note above. Read the full method and pin a reproducible implementation
before claiming a Dixon comparator. Each later research note records question, source/version,
claim, limitations, inference and experiment ID, including unsuccessful searches.
Search negative explanations too: an apparent pitch gain may be an alignment issue;
a bad onset score may be label precision; good synthetic spectra may conceal transfer loss.

## 5. Proposed numerical contract and decision rule

These are experimental starting choices, not measured performance or approved Studio
requirements. Freeze and obtain human approval of `synthetic-contract-v1` before any
candidate-selection batch; the contracts/oracle work can proceed to make that review
concrete. The parent approach requires approval for the first milestone contract and
later loosenings. This plan does not request approval merely to write the document.

| Item | Initial proposed requirement |
|---|---|
| Claim scope | Known-start, fixed-60-BPM, monophonic synthetic following; local omissions/substitutions/extras and forward recovery as specified above |
| Clean sources | ≥95% correct-position coverage; ≥95% claim coverage; no confident wrong-position episode over 100 ms |
| Local-error sources | ≥75% correct-position coverage; recovery within 1.15 s of the first resumed distinguishing onset, including unrecovered episodes as failures |
| Negative sources | ≤1% false-following time after the answerability allowance, and no confident false-following episode over 100 ms, per case |
| Deadlines | ≥95% eligible acquisition/tracking cues decided correctly within 150 ms; show exact counts when eight-note clips make percentages coarse |
| Confidence | For occupied bins, absolute gap between mean confidence and observed correctness ≤0.10 on synthetic labelled time; show denominators and mark sparse bins inconclusive |
| Causality/replay | No differing logical prefix decisions; repeated pinned run has identical logical trace |
| Cost | Current Linux development workstation, one listener process/one compute thread; record hostname, exact CPU, RAM, OS and Node/dependency versions before the run; this is the named provisional device, not a mobile-device claim |
| Resource envelope | Processing/audio duration ≤0.25; p99 chunk processing ≤10 ms; maximum queued-audio backlog ≤50 ms; no upward backlog trend over 60 s of separately labelled continued material; peak RSS ≤512 MiB |

Every mandatory case must pass its applicable gate; delayed-start and harmonic probes
report diagnostics separately and never raise the clean-profile score. Confidence-bin
checks are descriptions over labelled time, not independent statistical trials.

Compare all three listeners on identical cases. For a synthetic candidate to qualify,
it must pass the applicable absolute gates and reduce false-following time against the
clock by at least 50 percentage points on the silent and wrong-pitch controls, without
losing more than 2 percentage points of clean correct-position coverage. Report the
paired differences against YIN too; no claim of superiority if those differences are
inconclusive. If both pass, use the lower wrong-exposure total, then higher correct
coverage, then lower p99 cost, with ties explicitly recorded as ties.

Separate **synthetic qualification** from **retention under APPROACH.md**. These related
sources cannot supply a population confidence interval or establish real-source
improvement. Report exact paired case differences, family-level ranges and the lack of
independent evidence; never bootstrap audio frames as independent performances.
Formal retention remains inconclusive until the real-evidence branch has an approved
contract, an informative comparator, independent reserved sources and uncertainty rules.
A failed absolute gate is a rejection for this profile even if average metrics improved.

Budgets: at most three frozen spectral-follower configurations developed on dev data,
one reserved synthetic batch for the selected configuration and comparators, two hours
of measured experiment compute, and two 30-minute research passes. Stop on a pass,
budget exhaustion, two dev revisions without the declared worthwhile gain, or invalid
labels/evaluator. Do not relax a gate to obtain a pass. These budgets govern research
runs, not the ordinary work of implementing and testing the harness.

## 6. Campaign index and execution order

The items below share this document's contracts. They are the campaign index; future
implementation items should reference this plan. No separate roadmap proposals are
created by this planning change.

| Item | Depends on | Concrete output and done condition |
|---|---|---|
| C1 — freeze the instrument | — | Versioned vocabulary, source schema, counting rules, proposed contract and independent oracle; oracle tests pass; report renders without a listener |
| C2 — first source | C1 | Local MNX, sine generator, ten frozen dev cases, provenance/partition registry and manual sanity record; recipe reproduces the frozen assets |
| C3 — first assessment | C1, C2 | Clock and abstainer run through chunked runner; persisted decisions, report, cost and prefix checks; controls expose their expected limitations |
| C4 — audio hypothesis | C3, contract approval | Spectral follower and YIN comparator; bounded dev experiments; all failures categorized and ledgered; no reserved access during tuning |
| C5 — first comparison | C4 | Candidate frozen; single reserved batch if evidence exists; paired report and explicit qualify/reject/inconclusive result; next action selected by rule |
| R1 — evidence supply | Starts once C3 stands; runs alongside C4/C5 | Inventory eligible solo library recordings and one re-amplification session; record score/route compatibility, anchor precision, rights/access, calibration needs and missing evidence; harmonic probe supplies an early acoustic warning only |

“Alongside” describes dependencies, not a requirement to use multiple agents. The first
reviewable implementation change should be C1 alone: contracts, a few hand-worked oracle
fixtures and the first report. Then land C2/C3 as the smallest end-to-end result. Do not
build a general generator framework or multiple alignment families before that report.

Proposed CLI responsibilities are `generate`, `validate-set`, `run`, `evaluate`,
`compare` and `next`; choose exact commands during C1. They must work headlessly from
pinned local artifacts. Validation rejects malformed probabilities, inaccessible assets,
unknown contract versions, inconsistent sample coordinates and unsupported score shapes.

Each run manifest pins git commit, candidate/config hash, input/label/contract/evaluator
hashes, randomness, delivery mode and machine conditions. A deterministic logical replay
is distinct from real-time paced cost measurement. In the latter, release chunks at
wall-clock deadlines even if processing falls behind; measure the queue instead of
slowing the audio clock to flatter the listener. Record cold start separately and three
warm cost runs with variability. Include feature-window delay and scheduling delay in
reported decision latency; microphone-to-feedback latency remains unmeasured.

Reports lead with per-source timelines and counts: expected/estimated position, audible
events, alternatives, abstention, confidence, release/decision times and wrong exposure.
Then show categories, profile summaries and comparator differences. A ledger entry has
question, predicted gain, disconfirming result, research, all version pins, resource use,
result, decision and next action. A driver resumes from the last completed entry and
chooses mechanically: instrument defect → fix/version instrument; causality breach →
reject candidate; false following → investigate support withdrawal; coverage/recovery →
investigate alignment versus acoustics; cost failure → profile processing; all sine gates
pass → examine harmonic/real-source failures. Budget exhaustion or absent independent
evidence produces an explicit stop, not another unbounded tuning round.

## 7. What the first report can conclude, and what follows

Completion means another checkout can recreate the source, replay the pinned candidate,
pass the evaluator oracle and prefix checks, reproduce logical decisions, and see an
honest result and next action. The campaign can complete with a rejected hypothesis;
its success is obtaining a trustworthy first assessment, not engineering a pass.

R1 makes the next useful milestone concrete before expanding algorithms: propose a
real-instrument-through-microphone following contract, initially solo guitar, known
start, continuous route, 50–70 BPM, fixed named workstation and the same 150 ms decision
budget. Draft targets are ≥90% supported bar-position coverage, ≤1% false-following
time, no confident wrong-bar episode over 500 ms, and recovery within two beats after
an allowed short interruption. Pin allowed room/noise conditions and player population
from actual eligible sources, then approve the complete contract before that batch.
Do not claim sub-beat precision from sparse bar anchors or note-level correctness from
click timing. Calibration uncertainty must fit inside the tested timing tolerance.

Plan development, reserved and untouched final evidence by piece, performer and session;
keep variants together. Require at least five independent reserved performance groups
for an initial comparison, report paired group-level intervals and each failing case,
and mark broad retention inconclusive if that supply or label precision is insufficient.
The real contract must freeze its worthwhile improvement, regression limits and interval
procedure before those sources are opened. Re-amplification diagnoses recording transfer;
independent human performances are still required for useful following acceptance.

A later Studio decision separately needs the intended player/device population, actual
microphone capture and feedback latency, independent final acceptance evidence, and its
own approved integration limits. Note-level assessment needs independently labelled
actual notes and an expanded oracle. None is silently granted by a sine-wave pass.

## Progress and learnings log

- 2026-09-25 — Planning only. Read the two governing experiment documents and inspected
  the suggested MNX. Chose a locally adapted C4–B4 phrase, following as the first
  assessment, an oracle before algorithms, and explicit controls against clock-only
  success. No source set, candidate, approved contract or experimental result exists yet.
- On each item landing, append its commit/run IDs, what passed or failed, the new
  understanding, and the implication for the next item. Preserve rejected experiments.
