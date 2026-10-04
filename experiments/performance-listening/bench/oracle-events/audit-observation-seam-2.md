# Audit of observation-seam@2

2026-10-04 — **GPT-6-Astra (high) in Codex**.

**38 cases: 38 agree, 0 disagree, 0 ambiguous.** These are all 36 new
seam-2 cases and two inherited seam-1 cases, T3 and T8, under the current
rules. Agreement on these cases is not complete rule coverage or permission to
claim a live pass. The uncovered rules and one cost-wording ambiguity below go
to the next numbered challenger experiment before listener judgment.

## Sources and independence

Rules: [development contract 2](../../contracts/development-contract-2.md), including
its 2026-10-04 amendment and oracle-audit rule; [observation-seam@2](../../contracts/observation-seam-2.md),
SHA-256 `73d0faa966e5f68500a5e749c725f8eddd945fbc7e97c3441b21c105caaafb45`.
The audited [JSON](observation-seam-2.json) matches its [freeze](freeze-observation-seam-2.json):
SHA-256 `1a353ed0e56f4b2e3b765832c8b373d9147f02002238cab4efcc34d6fccddcac`.
Inherited cases come from [observation-seam@1](../../contracts/observation-seam-1.md),
SHA-256 `19e109dce07e04277bd51bd9c1fabce12dd3b32d71ba920dbf07015e59fc5751`.
Hashes were checked as file-integrity checks, not by an evaluator.

I read the research log's current state and questions, not its Findings table;
no experiment report, run result, evaluator, producer, adapter or test code was
read. No evaluator, listener or test was run during re-derivation. The arithmetic
below was written before opening the previous audit. Mandatory repository landing
validation follows the completed audit commit and supplies no audit evidence.

This audit covers the observation seam, not a re-audit of the separately audited
event instruments. The amended 0.2 s deadline is used only to explain the clock's
consequences; no performance, acoustic latency or runtime cost was measured.

## Case comparison

Times are seconds. Fractions are exact. `q` arrays give integer resampled coordinates;
each frame's audioTime is its q divided by 22050. In the batch rows, D is deliveryAt
and F is both availableAt and the stamp for any returned decision's madeAt. An
empty frame array does not assert that a decision exists. `a:256:b` lists both
endpoints with step 256. The oracle column reports the frozen value independently
of the derivations below.

| Case | Rules exercised | My result | Frozen result | Verdict |
|---|---|---|---|---|
| R0 | Empty causal prefix | N=0 | 0 | agree |
| R1 | Right sample is an index, integer position | N=147 | 147 | agree |
| R2 | Right sample arrives | N=148 | 148 | agree |
| R3 | 480-sample causal count | N=221 | 221 | agree |
| R4 | First inference-prefix count | N=2205 | 2205 | agree |
| R5 | One-second causal count | N=22050 | 22050 | agree |
| R6 | Integer-position interpolation still needs right sample | exists; left=320, right=321, value=320 | same four fields | agree |
| R7 | Zero-weight right sample absent | exists=false | false | agree |
| L1 | Padding, nonnegative q, edge0, shared completion | j=163…171; q=89:256:2137; D=.1, F=.145 | same indices, coordinates and stamps | agree |
| L2 | Strict watermark between windows | j=163…171; q=2294:256:4342; D=.2, F=.245 | same indices, coordinates and stamps | agree |
| L3 | Edge15 withholding, empty call still costs | empty; D=.1, F=.145 | empty; .1, .145 | agree |
| L4 | First edge15 emissions | j=155,156; q=246,502; D=.2, F=.245 | same | agree |
| L5 | Edge15 watermark across calls | j=148…156; q=659:256:2707; D=.3, F=.345 | same | agree |
| L6 | Equality rejected; queued empty call | empty; D=.2, F=.25 | empty; .2, .25 | agree |
| W1 | Schedule not reached | false | false | agree |
| W2 | Inclusive schedule boundary | true | true | agree |
| W3 | Cadence waiting only | .099999 | .099999 | agree |
| C1 | Idle lane | F=.145 | .145 | agree |
| C2 | Compute-inclusive completion | F=.201 | .201 | agree |
| C3 | Busy lane | F=.30 | .30 | agree |
| C4 | Idle gap | F=.24 | .24 | agree |
| C5 | Initialization delays feed | F=.03 | .03 | agree |
| C6 | Finish inherits backlog | F=.37 | .37 | agree |
| C7 | Whole-clip offline work | F=12 | 12 | agree |
| P1 | Maximum activation and bin map | MIDI62, confidence .9, pitched | same | agree |
| P2 | Lowest-bin tie break | MIDI60, confidence .8, pitched | same | agree |
| P3 | Inclusive .3 threshold, first bin | MIDI21, confidence .3, pitched | same | agree |
| P4 | Last bin | MIDI108, confidence .5, pitched | same | agree |
| P5 | Below threshold preserves uncertainty | MIDI null, confidence .299, unpitched | same | agree |
| O1 | Trim prefix at 86 fps | retained5160, available5254, tail94 | same | agree |
| O2 | Single-window trim | retained86, available142, tail56 | same | agree |
| O3 | Leading pad cancels raw15 | window0, raw15, grid=decoder=difference=0 | same | agree |
| O4 | 142-frame stitching vs decoder axis | window1, raw15; grid36164/22050; decoder36352/22050; difference188/22050 | same | agree |
| O5 | First 172-frame correction | window1, raw45; grid43844/22050; decoder438043100/220500000; difference−.0018 | same | agree |
| O6 | Second correction | window2, raw75; grid87688/22050; decoder876086200/220500000; difference−.0036 | same | agree |
| O7 | Both event endpoints use decoder axis | onset36352/22050; end438043100/220500000 | same | agree |
| seam1 T3 | Inherited edge gaps at one second | N22050, start−21794; edge0 .996916100, gap .003083900; edge15 .822766440, gap .177233560 | same to nine decimals | agree |
| seam1 T8 | Inherited onset-map peak cannot turn uncertain pitch into dead onset | no pitched observation; no decoded pitchless onset; no dead assertion | same | agree |

## Independent arithmetic

### R0–R7: sample existence and interpolation

Let M be the delivered input count. For nonnegative integer j, existence means
floor(320j/147)+1 < M. Equivalently 320j/147 < M−1. For M≥2,
N=ceil(147(M−1)/320); for M=0 or 1 there is no output. The ceiling comes from
counting integers j starting at zero under a strict upper bound, not from treating
the required index as a sample count.

- **R0:** M=0 supplies neither index0 nor index1. N=0.
- **R1:** 147×320/320=147, so N=147, j=0…146. At j146,
  46720/147=317+121/147, requiring index318, which exists. At j147,
  p=320 exactly, requiring index321, which is absent from indices0…320.
- **R2:** 147×321/320=147+147/320, ceiling148. j147 now has index321;
  j148 has p=47360/147=322+26/147 and needs index323, absent.
- **R3:** 147×479/320=70413/320=220+13/320, ceiling221.
  j220 has p=70400/147=478+134/147, requiring479<480;
  j221 has p=70720/147=481+13/147, requiring482≥480.
- **R4:** 147×4799/320=705453/320=2204+173/320, ceiling2205.
  j2204 has p=705280/147=4797+121/147 and needs4798;
  j2205 has p=4800 and needs4801, absent.
- **R5:** 147×47999/320=7055853/320=22049+173/320, ceiling22050.
  j22049 has p=47997+121/147 and needs47998;
  j22050 has p=48000 and needs48001, absent.
- **R6:** j147 gives p=320, k=320 and fraction0. For the specified ramp x[k]=k,
  interpolation is (1−0)×320+0×321=320. M322 includes the required right index321.
- **R7:** The same p and zero weight do not waive sample existence. M321 ends at
  index320, so exists=false; no interpolated value is claimed.

### L1–L6: windows, watermark and common stamps

Use b=N−43844, q=b+256j, D=M/48000 and F=max(D,Fprevious)+C.
The watermark is updated by every emitted q, not just pitched frames. The listed
q values are all below D×22050, so their audioTime passes the delivered-time bound.
These cases prescribe incoming watermark state; they do not themselves show its
maintenance by a producer.

- **L1:** N2205 gives b=−41639. j162 gives −167; j163 gives89.
  Through j171 the q list is 89,345,601,857,1113,1369,1625,1881,2137.
  All nine satisfy q≥0 and the initial −infinity watermark. D=.1;
  S=max(.1,0)=.1; F=.1+.045=.145. Backlog F−D=.045.
- **L2:** N=ceil(147×9599/320)=4410, b=−39434.
  j155 gives246 but that is below watermark2137. j162 gives2038, also below;
  j163 gives2294. The emitted q list is
  2294,2550,2806,3062,3318,3574,3830,4086,4342.
  D=.2, S=max(.2,.145)=.2; F=.245; backlog=.045.
  Equality-only suppression would incorrectly retain older, unequal coordinates.
- **L3:** Same b as L1; the largest allowed j is156, with
  q=−41639+39936=−1703. Thus every candidate is negative and the list is empty.
  Production still ends at max(.1,0)+.045=.145.
- **L4:** b=−39434; j154 gives−10; j155 and156 give246,502.
  Initial watermark−infinity permits both; max(.2,.145)+.045=.245.
- **L5:** N=ceil(147×14399/320)=6615 and b=−37229.
  j147 gives403≤502; j148 gives659. Through156 the q list is
  659,915,1171,1427,1683,1939,2195,2451,2707.
  F=max(.3,.245)+.045=.345; backlog=.045.
- **L6:** b=−39434 and largest q4342 equals the supplied watermark4342.
  None strictly exceeds it. F=max(.2,.245)+.005=.250; backlog=.050.
  This is a supplied-state selection/clock case; repeating inference at the same
  delivery boundary is not established as an allowed scheduled producer call.

The arrays imply respectively 9,9,0,2,9,0 emitted frames. All frames within each
call share F; their distinct audioTime values are not shifted by C.

### W1–W3: scheduling

- **W1:** 4799/48000=.1−1/48000<.1, so the scheduled4800 threshold is not reached.
- **W2:** 4800/48000=.1, exactly the threshold, so eligibility is true.
- **W3:** .2−.100001=.099999 seconds. This is only waiting until a scheduled
  inference, not detection delay or a bound on the model's receptive field.

### C1–C7: serial clock

Convert costMs to seconds by dividing by1000. The start, finish and backlog
triples (S,F,F−D) follow directly from the recurrence:

- **C1:** S=max(.1,0)=.1; F=.1+.045=.145; backlog=.045.
- **C2:** S=.1; F=.1+.101=.201; backlog=.101. The oracle's ancillary claim that
  this misses a first-event .2 deadline is conditional on a distinguishing onset
  at0. No onset is supplied in this case, so the frozen .201 clock result is
  checked, not an unconditional event-deadline verdict. In general the latency is
  .201−distinguishableAt.
- **C3:** S=max(.2,.24)=.24; F=.24+.060=.300; backlog=.100,
  comprising .040 queued work plus .060 current work.
- **C4:** S=max(.2,.13)=.2; F=.2+.040=.240; backlog=.040.
  The .070 idle gap before delivery is not charged again.
- **C5:** Initialization sets previous completion=.020. S=max(.010,.020)=.020;
  F=.020+.010=.030; backlog=.020 (.010 prior queue plus .010 service).
- **C6:** Finish delivery is clip duration .300. S=max(.300,.350)=.350;
  F=.350+.020=.370; backlog=.070. This checks the clock, not that finish emits
  no new live model window.
- **C7:** Offline D=10, S=max(10,0)=10, F=10+2=12; backlog=2.
  Frame and event musical timestamps do not acquire that two-second shift.

### P1–P5: frame reduction

Treat each case's sparse bins as the supplied activations; none of the omitted
bins is specified as another contender. These cases check scalar reduction,
not physical float32 serialization of decimal confidence values.

- **P1:** .9>.8 and .9≥.3; largest activation is bin41, MIDI21+41=62,
  confidence .9, kind pitched.
- **P2:** Both bins have maximum .8≥.3; 39<41 resolves the tie to bin39,
  MIDI21+39=60, confidence .8, kind pitched.
- **P3:** .3≥.3 is true; MIDI21+0=21, confidence .3, kind pitched.
- **P4:** .5≥.3; MIDI21+87=108, confidence .5, kind pitched.
- **P5:** .299<.3; MIDI null, confidence remains .299, kind unpitched.
  This is a frame, not an event asserting a pitchless onset or silence.

### O1–O7: offline trim, coordinates and endpoint times

Removing raw frames0…14 and157…171 removes15+15=30 from172,
leaving142. Raw frame for stitched i is15+(i mod142); w=floor(i/142).
The raw coordinate is w×36164+256×[15+(i mod142)]−3840.
Since15×256=3840 and142×256−36164=188, it simplifies to256i−188w.
Define h=floor(i/172), g=(256i−188w)/22050 and
`t=(256i−188h)/22050−.0018h`. Thus t−g=188(w−h)/22050−.0018h.

- **O1:** L/22050=1323000/22050=60; retained=floor(60×86)=5160.
  Available=37×142=5254; discarded tail=5254−5160=94. Retain indices0…5159,
  discard5160…5253. For comparison only, floor(1323000/256)=5167 is a
  different rule and would retain seven extra frames.
- **O2:** L/22050=1; retained86. Available1×142=142; tail142−86=56.
  Retain indices0…85, discard86…141. This case alone cannot distinguish the
  prescribed86 fps rule from floor(22050/256)=86; O1 can.
- **O3:** i0 gives w0, raw15, h0. g=(3840−3840)/22050=0; t=0; t−g=0.
- **O4:** i142 gives w1, remainder0, raw15, h0; 142×256=36352.
  g=(36352−188)/22050=36164/22050; t=36352/22050.
  Difference188/22050 seconds, about8.526077 ms.
- **O5:** i172 gives w1, remainder30, raw45, h1; 172×256=44032.
  g=(44032−188)/22050=43844/22050.
  t=43844/22050−.0018
  =(438440000−396900)/220500000=438043100/220500000.
  Difference−.0018 seconds exactly.
- **O6:** i344 gives w2, remainder60, raw75, h2; 344×256=88064.
  g=(88064−376)/22050=87688/22050.
  t=87688/22050−.0036
  =(876880000−793800)/220500000=876086200/220500000.
  Difference−.0036 seconds exactly. Already this is outside the earlier
  illustrative −1.8 ms lower value; the new contract correctly rejects a uniform bound.
- **O7:** Evaluate endpoints independently: onset=t142=36352/22050;
  end=t172=438043100/220500000. Their duration is
  (438043100−363520000)/220500000=74523100/220500000,
  about .337973243 seconds. Adding30×256/22050 to the onset would exceed the
  specified end by188/22050+.0018, about .010326077 seconds.
  The duration is derived commentary; the two endpoint fields are the frozen answers.

### Inherited cases sampled under seam 2

- **T3:** M48000 gives N22050 as in R5; b=22050−43844=−21794.
  Edge0: j171 gives−21794+43776=21982; audioTime21982/22050
  rounds to .996916100, and the nominal gap is(22050−21982)/22050
  =68/22050, rounding to .003083900. Edge15: j156 gives18142;
  audioTime18142/22050 rounds to .822766440; gap3908/22050 rounds to
  .177233560. These are nominal coordinate gaps. They exclude waiting and
  measured compute, which seam2 adds to availability without moving audioTime.
- **T8:** All note activations are below .3. The reduction therefore has MIDI null
  and kind unpitched regardless of an onset-map peak: its selection rule uses
  note activations. The adapter asserts no decoded pitchless onset, so uncertainty
  cannot establish a dead note. This exercises the inherited onset-peak distinction
  that P5's input does not include. No numerical confidence is supplied by T8.

## Rules I could not exercise

The following are uncovered by the frozen cases, not additional agreements.
Cases for gate-relevant rules must be frozen and audited before listener judgment;
a passing implementation test cannot supply the missing oracle. Procedural and
pinned-DSP obligations need explicit coverage boundaries and evidence in adoption,
not invented scalar expected answers here.

| Rule or obligation | What is missing from the frozen cases |
|---|---|
| Prefix causality with measured wall-time variation | Seam1 T7 requires equality of emissions by nominal time but supplies no records or differing durations; its old madeAt-based wording is changed by seam2. No paired-prefix case establishes equal payload/audioTime/refersTo/delivery indices while allowing different wall stamps, or rejects a future-dependent payload. |
| Audio time vs refersTo vs madeAt | No returned-decision case exercises a retrospective refersTo, the bounds 0≤refersTo≤deliveryAt≤madeAt, rejection of backdating, or retention of nominal timestamps while compute changes. L and C cases check stamps, not these decision fields. |
| Cost ratio | No frozen aggregate setup/feed/finish costs, clip duration, ratio or ≤.25 boundary, including empty calls and separately reported shared loading. Clock service costs are not a cost-ratio case. The wording ambiguity below needs resolution too. |
| Start emissions and full lifecycle | C5 tests a feed delayed by setup, not the stamp of an initialization emission. C6 tests finish recurrence, not absence of a new live window, immutability of earlier history, or inclusion of finish work when it emits nothing. No state-reset case for separate examples. |
| Window/cadence lifecycle | W1/W2 check a boundary exactly, not the first irregular delivered chunk past it, skipped/multiple schedule boundaries or no finish flush. All L windows have left padding; none reaches N≥43844 and proves eviction to the latest43844 samples. |
| Watermark carried by unpitched frames | L2/L5/L6 distinguish strict comparison and equality, but their incoming watermark is supplied. No case emits an unpitched frame and then proves that its q advanced the next call's watermark. |
| Fractional interpolation | R6/R7 use integer p; no frozen sample amplitudes at a noninteger p check the two nonzero linear weights. R0 exercises an empty prefix; no M1 or minimal M2 case, and no tail-flush lifecycle case. |
| Offline length and busy availability | O1/O2 have integral L×86/22050, so do not discriminate floor from rounding/ceiling. Window counts are supplied; no case establishes actual zero-tail window construction. C7 has an idle lane, not whole-clip work queued behind later completion, although C3 covers the common recurrence. |
| Long-axis differences and parity | O6 covers a second correction and disproves the old illustrative lower bound, but there is no distant-index frozen case for the long-duration slope difference. No frozen offline/live input pair exercises the claimed first-window mismatch (N40004, different resamplers). |
| Decoder and event shape | No frozen maps/events exercise onset .5, frame .3, minimum11 frames, inferred onsets/melodia, confidence propagation, onset-then-MIDI event sorting or absence of score filtering. P5/T8 establish frame semantics, not a typed event with explicitly detected MIDI null. P cases also lack a fully specified88-bin float32 serialization fixture; decimal scalar arithmetic is not a serialization check. |
| Provenance, DSP and adoption | Model/input/source/producer hashes,88/264-bin float32 shapes, pinned HQ resampling and actual causal sample access need artifact/producer validation. No frozen case checks musical-cache reuse versus fresh measured compute, per-call trace retention, exclusion of labels/score from inference, or refusal of chords/adjacent identical pitches. Seam2 explicitly requires a separately versioned adopting producer/runner; this audit checks no such implementation and grants no runtime claim. |

### Cost wording needs clarification

Under "Measured production and decision time", seam2 says:

> All setup/feed/finish wall time remains in that cost denominator

The contract's sustained cost ratio is at most .25, and the seam distinguishes
elapsed production time from scheduled clip time, but does not write an explicit
aggregate fraction here. Charging setup/feed/finish as **work divided by audio
duration** makes extra work increase the ratio; literally putting that work in the
**denominator** of a reciprocal ratio makes extra work decrease it. Those readings
cannot be interchangeable at a ≤.25 gate. There is no frozen ratio case on which to
assign a case-level ambiguous verdict or derive both numerical answers. The next
numbered resolution should state the numerator and denominator explicitly and freeze
cases including setup, empty feeds, finish and the boundary. I have not repaired
this wording or inferred its implementation from code.

## Prior-audit comparison

After writing all derivations and the uncovered-rule table above to this audit draft,
I opened [audit-observation-seam-1.md](audit-observation-seam-1.md), on 2026-10-04,
for its uncovered-rule list. No case verdict or arithmetic was changed from it.

- Its index/count ambiguity is now explicit and separated by R1/R2/R6/R7.
- Its equality/at-or-before ambiguity is now explicit and separated by L2/L5/L6.
- Shared batch availability is covered by L1/L2/L4/L5; cadence waiting by W3;
  reduction and the bin map by P1–P5; trim count and which end loses frames by
  O1/O2; the second stitched correction by O6; both decoded endpoints by O7.
- HQ resampling/decoder internals, event sorting, score blindness and chain
  constraints remain outside the numerical cases, as the table above records.
  The inherited copied three-frame confirmation and transition costs also have
  no seam hand case: they are listener behavior, not inferred from these timings.
- Seam2 correctly distinguishes frame null from event null and replaces nominal
  availability with measured serial completion. It also explicitly retracts a
  uniform long-clip bound on the grid/decoder offset; O6 demonstrates why.

Question 34 carries the remaining gaps and the cost wording to the next numbered
resolution. **Summary: 38 agree, 0 disagree, 0 ambiguous at case level; rule coverage
incomplete.** No oracle, contract, definition, implementation or experiment ledger
was changed by this audit.
