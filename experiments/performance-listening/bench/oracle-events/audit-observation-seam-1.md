# Audit of observation-seam@1

An independent re-derivation of the hand-worked timing cases of **observation-seam@1**
from the rules alone, under [contract 2's audit rule](../../contracts/development-contract-2.md#auditing-an-oracle)
and [its challenger decision 5](../../contracts/development-contract-2.md#the-challenger-track-basic-pitch-observations)
("the seam's timing arithmetic is audited like an oracle"), following
[AUDITING_AN_ORACLE.md](../../AUDITING_AN_ORACLE.md). Performed 2026-10-02. This file
is named for the seam rather than `audit-1.md`, because the version numbers in this
directory belong to the event oracles and event-oracle@1 has no audit.

**What was audited.** `contracts/observation-seam-1.md`, sha256
`19e109dce07e04277bd51bd9c1fabce12dd3b32d71ba920dbf07015e59fc5751`, as the g035 run
summary's producer-hash list records it and as `sha256sum` reports it on `main` today
(commit `6db69b42`, the only commit that has touched the file). The seam has no separate
frozen JSON: its oracle is the table of cases T1–T8 inside the contract. It was written
by GPT-6.1-Sol (high) in Codex; this audit was not.

**The rule text worked from**, and nothing else:

| File | Version | Used for |
|---|---|---|
| `contracts/observation-seam-1.md` | observation-seam@1, 2026-10-02 | every rule: the common shape, the offline producer (window, hop, pad, trim, stitched time, offline availability, decoder defaults), the live producer (resampling existence rule, window start, local frame time, edge policies, discard rules, availability clock, nominal gaps, inference cadence, madeAt) and the monophonic reduction |
| `contracts/development-contract-2.md` | in force from 2026-09-30, challenger section added 2026-10-02 | what the seam must carry (two times per frame and event, pitchless-onset representation, provenance), and the gates whose deadlines the timing feeds |

Not read during re-derivation: `bench/src/seam/`, `bench/src/challenger/`, their tests,
report 035 beyond its title, any run's results. The research log's current-state
paragraph and the grep that located the seam's hash did show me, in passing, one-line
summaries of 035's live outcome (finding 28 and the "Closed at 1 of 1" sentence) and one
hash line of the g035 summary; no number below comes from them. No evaluator, listener or
test was run during re-derivation; `node` was used only as a calculator, to render my
rational results as decimals. The earlier audits in this directory concern the event
oracles, not this seam, and only the header of `audit-4.md` was opened, for format. The
mandatory landing gate ran only after this file was committed; nothing here was changed
from its output.

**Scope.** observation-seam@1 is a first version, so every case is new: T1–T8, all
checked. Rules without a case are listed under [uncovered rules](#rules-i-could-not-exercise).

## Verdicts

| Case | Rules exercised | My number | Oracle's number | Verdict |
|---|---|---|---|---|
| T1 | resampling existence rule, exact-integer clause, N | j = 0…220 exist; j = 220 needs index 479 (< 480); j = 221 needs 482; N = 221 | the same | agree |
| T2 | existence rule at an exact integer; window start; local frame time; edge0/edge15 ranges; negative-time discard; first inference at .1 s | N = 2205; start −41639; edge0 j171 = 2137/22050 = .096916100 s; edge15 j156 = −1703/22050 = −.077233560 s; edge0 emits j = 163…171; edge15 emits none | the same | agree |
| T3 | existence rule; window start; local frame time; nominal gap formulas; availability clock | N = 22050; start −21794; edge0 j171 = 21982/22050 = .996916100 s, gap 68/22050 = .003083900 s; edge15 j156 = 18142/22050 = .822766440 s, gap 3908/22050 = .177233560 s | the same | agree |
| T4 | availableAt = input clock; causal context; madeAt = delivery clock | availableAt = 1 s; audioTime = .822766440 s; last input sample the window can touch is index 47998 (.99996 s), so "through 1 s, never beyond" holds; madeAt = 1 s | the same | agree (note 1) |
| T5 | leading pad; 15-frame removal; stitched-time formula at i = 0; offline availability | raw frame 15 at (3840 − 3840)/22050 = 0; stitched frame 0 at 0 − 0·offset = 0; availableAt = clip duration | the same | agree |
| T6 | stitched-time formula with the reset term at i = 172 | offset = 188/22050 + .0018 = .010326077097505668 s; time = 44032/22050 − offset = 43844/22050 − .0018 = 1.986590023 s | the same | agree (note 2) |
| T7 | causality of the live producer; non-causality of the offline producer | every live emission at ≤ 1 s depends only on input indices ≤ 47998; offline events depend on the whole clip | the same | agree |
| T8 | monophonic reduction below threshold; no asserted pitchless onset; no dead verdict | reduction yields null; the adapter asserts no `midi:null` event; no dead note follows | the same | agree (note 3) |

**Summary: 8 cases checked, 8 agree, 0 disagree, 0 ambiguous.** Three notes on rule
wording sit beside agreeing verdicts; two rule ambiguities and several uncovered rules
are recorded below for the next numbered experiment.

## Arithmetic

The live producer's rules, as I read them. Input is 48,000 Hz; M delivered samples have
indices 0…M−1 and the input clock reads M/48000 s. Output sample j sits at
p = j·48000/22050 = j·320/147 and **exists only when input index floor(p)+1 has been
delivered**, so the condition is floor(p)+1 ≤ M−1. Because the rule says "including the
exact-integer case", an integer p still needs index p+1. N is the count of existing
output samples, so N = (largest existing j) + 1, and p is monotone in j, so every smaller
j exists too. The window of a run at prefix N starts at resampled index N−43844, and local
frame j describes audioTime = (N−43844+256j)/22050. Edge0 keeps j = 0…171, edge15 keeps
j = 0…156. Negative times are discarded. Every emitted frame is available at the input
clock of the run that produced it. ONNX runs every .1 s at a chunk boundary, so the first
run is at .1 s (M = 4800), not at .01 s.

A reading of "floor(p)+1 is delivered" as a one-based count (M ≥ floor(p)+1) differs
from the index reading only when floor(p)+1 = M. That needs j·320/147 ∈ [M−1, M), which
for M = 480, 4800 and 48000 is j ∈ [220.04, 220.5), [2204.54, 2205) and
[22049.54, 22050): no integer in any of them, so the two readings give the same N in all
three cases. The difference is confined to the rule text, see [ambiguity A](#rules-i-could-not-exercise).

### T1: 480 samples at .01 s

- j = 220: p = 70400/147 = 478.911…; floor 478; +1 = 479 ≤ 479 = M−1. Exists.
- j = 221: p = 70720/147 = 481.088…; floor 481; +1 = 482 > 479. Does not exist.
- N = 221. No inference happens at .01 s, so nothing is emitted. **Agree.**

### T2: 4800 samples at .1 s

- j = 2204: p = 705280/147 = 4797.823…; floor 4797; +1 = 4798 ≤ 4799. Exists.
- j = 2205: 2205 = 147·15, so p = 15·320 = 4800 exactly; the exact-integer clause needs
  index 4801 > 4799. Does not exist. N = 2205, and N/22050 = .1 s = the input clock.
- Window start: 2205 − 43844 = **−41639**.
- Edge0 j171: 256·171 = 43776; −41639 + 43776 = 2137; 2137/22050 = 0.0969160997… =
  **.096916100 s** at nine places.
- Edge15 j156: 256·156 = 39936; −41639 + 39936 = −1703; −1703/22050 = −0.0772335600… =
  **−.077233560 s**.
- Edge0 emission: time ≥ 0 needs 256j ≥ 41639, j ≥ 162.65, so j = 163…171, nine frames
  (j = 162 gives −167/22050 < 0; j = 163 gives 89/22050 > 0). Nothing was emitted before,
  so the already-emitted discard removes nothing. **Edge0 emits j163…171.**
- Edge15: its largest time is j156's, negative, so **edge15 emits none.** **Agree.**

### T3: 48,000 samples at 1 s

- j = 22049: p = 7055680/147 = 47997.823…; floor 47997; +1 = 47998 ≤ 47999. Exists.
- j = 22050: 22050 = 147·150, p = 48000 exactly; needs 48001. Does not exist.
  N = **22050**; N/22050 = 1 s = the input clock.
- Window start: 22050 − 43844 = **−21794**.
- Edge0 j171: −21794 + 43776 = 21982; 21982/22050 = 0.9969160997… = **.996916100 s**.
  Gap to availableAt: 1 − 21982/22050 = 68/22050 = 0.0030839002… = **.003083900 s**,
  and (43844 − 171·256)/22050 = 68/22050, the contract's stated edge0 gap.
- Edge15 j156: −21794 + 39936 = 18142; 18142/22050 = 0.8227664399… = **.822766440 s**.
  Gap: 3908/22050 = 0.1772335600… = **.177233560 s**; (43844 − 156·256) = 3908. **Agree.**

### T4: edge15 frame j156 of T3

- availableAt is the input clock of the run, **1 s**; audioTime is T3's **.822766440 s**.
- Context: the window spans resampled indices −21794…22049. Index 22049 interpolates
  between input indices 47997 and 47998 (p = 47997.82), so the last input sample the frame
  can depend on is index 47998, at .99996 s. It uses audio through 1 s in the sense of "up
  to the input clock", never beyond. Agree.
- madeAt: "runner owns madeAt" and "position refersTo and runner madeAt use that clock",
  the observation delivery clock, so madeAt = **1 s**. **Agree**, with note 1.

### T5: first offline window and stitched frame 0

- Window 0's model input begins with 3840 zeros, then the clip from sample 0. With a
  frame hop of 256 (the contract's nominal analysis grid), raw frame i sits at input
  offset 256i, and 15 frames are removed from each end, so stitched frame 0 is raw frame
  15: (15·256 − 3840)/22050 = (3840 − 3840)/22050 = **0**.
- Upstream stitched formula at i = 0: 0·256/22050 − floor(0/172)·offset = **0**.
- Offline availability: "available only at the end of the complete clip", so
  availableAt = **clip duration**. **Agree.**
- A consistency check the case does not state: the hop 36,164 = 43,844 − 2·3,840, so
  consecutive windows overlap by exactly the 30 removed frames. The pad, hop and removal
  figures agree with one another.

### T6: offline stitched frame 172

- 172 − 43844/256 = (44032 − 43844)/256 = 188/256, so
  offset = (256/22050)·(188/256) + .0018 = 188/22050 + .0018 = 0.0085260770975… + .0018 =
  **.010326077097505668 s** (the double of 188/22050 + .0018, as the oracle writes it).
- floor(172/172) = 1, so time = 172·256/22050 − offset = 44032/22050 − 188/22050 − .0018 =
  43844/22050 − .0018 = 1.9883900226… − .0018 = 1.9865900226… = **1.986590023 s**.
  **Agree**, with note 2.

### T7: same prefix, altered future after sample 48,000

- By T3 and T4, every output sample j ≤ 22049 depends on input indices ≤ 47998, each run
  uses only existing output samples with a left zero pad, the interpolation has no filter
  and so no look-ahead, and frames are immutable once emitted. So every live emission made
  at ≤ 1 s is a function of input indices ≤ 47998 and must be identical whatever follows.
  Agree.
- Offline, the clip is resampled by a filter over the whole signal, windowed with a tail
  pad, and decoded with "inferred onsets" and a minimum length, all over the complete
  clip; events after the alteration can change, and events before it may too. Not causal,
  and the contract claims no causality for them. **Agree.**

### T8: pitched bins below .3 with an onset-map peak

- The live reduction "selects the highest note activation at threshold .3 … or null below
  threshold": with every note bin below .3 it yields null, whatever the onset map shows.
- "This model adapter emits no such onset: lack of a pitch is uncertainty, never an
  asserted dead note." So no `midi:null` event is asserted, and a dead verdict (which the
  assessment instruments reach only from an identified dead note) cannot follow from this
  frame. **Agree**, with note 3.

## Notes beside agreeing verdicts

1. **T4's "even if retrospective refersTo were earlier."** The rule makes both refersTo
   and madeAt the observation delivery clock, so under this seam a refersTo earlier than
   madeAt does not arise; the clause is a hypothetical about the incumbent's hindsight
   mechanics, not a case this seam can produce. The verdict on madeAt is unaffected.
2. **T6's formula is upstream's, not the seam's own grid.** Under the seam's nominal
   grid (raw frame i of a window starting at input offset s describes (s+256i)/22050, the
   convention T5 uses), stitched frame k of window w = floor(k/142) describes
   (256k − 188w)/22050, because each window advances 36,164 = 142·256 − 188 samples.
   Stitched frame 172 is window 1's raw frame 45: (−3840 + 36164 + 45·256)/22050 =
   43844/22050 = 1.988390 s. The upstream formula gives 1.986590 s, 1.8 ms earlier; for
   k = 142…171 it is 8.53 ms later than the grid (the grid steps at 142, the formula at
   172); over a long clip the two staircases have almost the same slope (offset·22050/172 =
   1.3238 samples per frame against 188/142 = 1.3239) and differ by between −1.8 and
   +8.5 ms with a period of about 172 frames. The contract already says the formula is
   historical and "not an exact physical frame centre"; the figure to carry is that
   **offline event times inherit an offset of up to about 8.5 ms against the live frame
   grid**, a third of the ±30 ms interval floor. T6's arithmetic is right for the formula
   as written.
3. **`midi:null` is used for two things.** The common shape says `midi:null` "represents
   a pitchless onset, distinct from no observation" (an event-level meaning), while the
   live reduction returns "null below threshold" (a frame-level "no pitched observation").
   T8's expected outcome is the same under both because the adapter never asserts the
   event-level kind, but a reader of a frame record cannot tell from the value alone
   which was meant. Worth a sentence in the next version.

## Rules I could not exercise

A rule without a frozen hand case is uncovered, not agreed. These go to the next
numbered experiment's resolution question.

- **Ambiguity A: "floor(p)+1 is delivered".** Index (needs M ≥ floor(p)+2) or count
  (needs M ≥ floor(p)+1)? T1–T3 cannot separate the readings (shown above); a case with
  M = floor(p)+1, for instance j = 147 (p = 320 exactly) at M = 321, would: the index
  reading says it does not exist, the count reading says it does.
- **Ambiguity B: "times already emitted are discarded".** Read literally, as equality of
  audioTime, this almost never applies: runs are 2205 resampled samples apart and
  2205 ≡ 157 (mod 256), so a frame time recurs only when the run count is a multiple of
  256, every 25.6 s. Under that reading the run at .2 s (N = 4410, start −39434) emits
  edge0 j = 155…171, seventeen frames whose times start at 246/22050 = .011 s and
  re-describe audio the .1 s run already described, and the run at 1 s emits 86 frames
  back to .01 s. Read as "times at or before the latest emitted audioTime", each run emits
  eight or nine frames: at 1 s, edge0 emits j = 163…171 (times above the .9 s run's
  j171 = 19777/22050 = .8969 s) and edge15 j = 148…156. The two readings give different
  frame streams to the three-consecutive-frame confirmation and so different cursor
  timing. No case covers a second run; this needs a frozen hand case and a sentence.
- **Frames in one batch share availability.** Stated, implied by T2's nine frames, but no
  case states the shared availableAt of a batch.
- **Inference cadence waiting bound.** "Up to 100 ms of waiting" has no case; a sample
  delivered just after a chunk boundary is first seen by the run .1 s later.
- **Monophonic reduction above threshold, and ties by lowest bin.** T8 covers only the
  null branch; no case gives activations and the selected MIDI, or a tie.
- **Bin to MIDI mapping** (88 bins, MIDI 21–108, so bin b is MIDI 21+b): no case.
- **Offline trim to floor(length·86/22050) frames.** No case gives a clip length and the
  resulting count; note that 86 is not 22050/256 = 86.13, so a 60 s clip keeps 5160 of a
  nominal 5168 frames, and which end loses them is not stated.
- **Stitched-time reset beyond i = 172.** T6 covers floor = 1; a case at i ≥ 344 would
  pin the multiplicative term. Note 2 gives the comparison with the seam's own grid.
- **Librosa HQ resampling, the official decoder** (onset .5, frame .3, minimum 11 frames,
  inferred onsets, melodia) **and how a decoded event's onset and end are placed on the
  frame-time axis.** These cannot be applied by hand without reading upstream code; the
  contract pins them by name and model hash, not by rule. That is a limit of the rule
  text, recorded here, not a disagreement.
- **Events sorted by onset then MIDI; no score filtering; the chain's refusal of
  polyphonic and adjacent identical-pitch scores; the copied three-frame confirmation and
  transition costs.** Listener and ordering rules, not timing; no case, and outside what
  an oracle of timing cases can carry.

## Limits the question asked me to check

Question 25 names three. From the rules alone:

- **Nominal availability versus CPU and wall time.** availableAt is the input clock of
  the run (N/22050 = M/48000), so a frame is "available" at the chunk boundary whose input
  it used, whatever the inference took. A physical listener would have it later by the
  inference time, which the seam says executeSeam measures separately as cost. So a
  deadline judged on availableAt is a lower bound on real latency, and the contract's
  cost gates are the only place the inference time is seen. The contract says so
  ("frame-coordinate gaps, not measured acoustic latency"); I record it as the standing
  limit of any live-cursor claim from this seam.
- **First-window runtime parity.** Offline window 0 is 3840 zeros then 40,004 real
  samples, resampled by Librosa HQ; a live run at prefix N is 43844−N zeros then N real
  samples, resampled by linear interpolation, and runs only at N = 2205k. The layouts
  match only at N = 40004, which is not a multiple of 2205 (40004/2205 = 18.14), and the
  resamplers differ, so exact parity between the first offline window and any live run is
  unreachable under the rules; agreement can only be approximate and measured, never
  derived. Frame times also differ by note 2's offset.
- **Resampling and padding.** T1–T3 and T5 cover the arithmetic; the left zero pad and
  the window start are consistent between the two producers (both place raw frame i of a
  window at (s+256i)/22050).

**Model and tool:** Claude Fable 5.1 in Claude Code (effort unknown).
