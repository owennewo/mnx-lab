# Independent audit of observation-seam@3

2026-10-05. **GPT-6-Astra (high) in Codex**.

**66 cases checked: 57 agree, 1 disagree, 8 ambiguous.** These are all 28 new
cases, all 36 inherited seam-2 cases, and seam-1 T3/T8 under the current rules.
The new seam does not yet establish adequate oracle coverage for a native cursor
verdict. Question 36 carries the findings to the next numbered challenger experiment.
No listener, acoustic accuracy, native cost, or stage verdict follows from this audit.

## Sources and independence

Rules: [development contract 2](../../contracts/development-contract-2.md), including
its 2026-10-04 compute-inclusive-clock amendment;
[observation-seam@3](../../contracts/observation-seam-3.md), inheriting
[observation-seam@2](../../contracts/observation-seam-2.md). The older
[seam 1](../../contracts/observation-seam-1.md) supplies T3/T8, not superseded timing rules.
The authoring experiment is 040, as identified by the research log and seam header.

Frozen inputs checked against their SHA-256 records:

| Oracle | SHA-256 | Freeze |
|---|---|---|
| [Seam 3](observation-seam-3.json) | `83f48b1c37199a58f4d646bffb9986fac21bd7f122f4d89296c9c53d3f8bd0dc` | [freeze 3](freeze-observation-seam-3.json), 28 cases |
| [Seam 2](observation-seam-2.json) | `1a353ed0e56f4b2e3b765832c8b373d9147f02002238cab4efcc34d6fccddcac` | [freeze 2](freeze-observation-seam-2.json), 36 cases |

No seam-3 audit or other audit worktree existed when this session began. I read the
research log's current state and questions, not its Findings table. I read no
implementation, implementation tests, experiment report, or run results. I ran no
evaluator, listener or test while deriving these answers.

I first extracted only each JSON case's id, operation and input, hiding both
`expected` and `arithmetic`. I wrote the independent calculations to a scratch record
before revealing those two fields. Some case inputs are supplemented by their prose:
R6 and S2 identify ramp samples there. I use that as fixture data, not as an expected
answer. S3 shares S2's `window` ramp convention; its index/padding result does not
establish arbitrary waveform equivalence. S5 is still missing reset service and a
complete lifecycle fixture even after reading its prose.

Only after the independent calculations were written and the frozen expectations
compared did I open [audit 2](audit-observation-seam-2.md#rules-i-could-not-exercise),
on 2026-10-05, for its uncovered-rule list and cost-wording discussion. I did not read
its case table or arithmetic. The coverage comparison below is subsequent to my own
derivations. Mandatory repository validation runs only after committing this audit;
its results cannot change these arithmetic verdicts.

Times below are seconds. Rational expressions are exact; time comparisons use the
seam's 1e-12-second precision. Arrays written `a:256:b` contain every integer from a
to b in steps of 256. A pitch tuple is `(MIDI, confidence, kind)`.
The seam specifies exact integer/ID/null/boolean comparison, but does not specify an
amplitude/confidence tolerance or declare inherited decimal cases to be pre-float32
abstractions. That distinction matters in I3 and P1/P2/P3/P5.

## Case comparison

### All new seam-3 cases

| Case | Rules exercised | My answer | Frozen answer | Verdict |
|---|---|---|---|---|
| I1 | Right-neighbor existence, minimal prefix | 0 outputs | 0 | agree |
| I2 | Right-neighbor existence at integer p | 1 output | 1 | agree |
| I3 | Fractional interpolation and float32 tensor rounding | `13082234/1048576 = 12.476190567016602` | `1834/147 = 262/21` before float32 rounding | **disagree** |
| I4 | Fractional sample with absent right neighbor | null | null | agree |
| K1 | Setup/all feeds/finish, separate shared load, inclusive cost gate | work .25, ratio .25, pass true, load .5 | same | agree |
| K2 | Unrounded ratio above gate | work/ratio .250001, pass false, load .5 | same | agree |
| K3 | Audio duration is denominator | work .25, ratio .125, pass true, load 0 | same | agree |
| K4 | Zero-duration refusal | refused | true (refused) | agree |
| D1 | Runner stamp ownership, retrospective refersTo | madeAt .145, refersTo .08, other fields preserved | same | agree |
| D2 | No future refersTo | rejected (.11 > .1) | true (rejected) | agree |
| D3 | No negative refersTo | rejected (−.01 < 0) | true (rejected) | agree |
| F1 | Prefix selected by delivery, variable wall time excluded | equal | true | agree |
| F2 | Payload equality | unequal, MIDI 60 vs 62 | false | agree |
| F3 | Emitting delivery index/prefix membership | unequal, one record vs none | false | agree |
| S1 | Irregular cadence, consume skipped schedules once | [5000, 20000, 24000] | same | agree |
| S2 | Latest window, chronological eviction; prose ramp | start 1, pad 0, first 1, last 43844 | same | agree |
| S3 | Left padding; same window ramp convention | start −43842, pad 43842, first 0, last 1 | same | agree |
| S4 | Unpitched frames advance strict watermark | [89:256:2137], [2294:256:4342]; final 4342 | same | agree |
| S5 | Start/feed/finish/history/reset | prose gives .02/.03/.035, no model calls; reset completion could be .003 or .02 depending on unspecified fresh setup | .02/.03/.035, 0 calls, unchanged history, reset .003/0/null | **ambiguous** |
| O8 | Fractional floor, actual window count/tail | 1 window, 86 retained, tail 17904 | same | agree |
| O9 | Busy offline lane | 13 | 13 | agree |
| O10 | Distant stitched index, grid vs decoder axis | w36/raw63; grid 1314192/22050; decoder 1314129300/22050000; difference −6270/2205000 | same | agree |
| O11 | Equal leading pad vs scheduling/parity | pads 3840 each; scheduled false under regular-only reading, true at a permitted first irregular delivery 87084 reaching next 86400 | pads 3840 each, scheduled false | **ambiguous** |
| P6 | Physical float32 confidence, inclusive threshold/bin map | (60, .30000001192092896, pitched) | same | agree |
| E1 | Onset/MIDI ordering, end/confidence retention | input events ordered 3, 2, 1, all fields unchanged | same | agree |
| E2 | Uncertain frame is not a detected pitchless event/dead note | unpitched frame, 0 decoded pitchless onsets, 0 dead assertions | same | agree |
| N1 | Nonlocal normalization; numerical mapping absent from rules | [0, .5, 1] for unit-range min/max; [−1, 0, 1] for symmetric-range min/max | [0, .5, 1] | **ambiguous** |
| N2 | Changed extremum changes retained normalized value | [0, .25, 1] for unit-range; [−1, −.5, 1] for symmetric-range | [0, .25, 1] | **ambiguous** |

New cases: **23 agree, 1 disagree, 4 ambiguous**.

### All inherited seam-2 cases under seam 3

For L cases, a time pair is `(deliveryAt, availableAt = madeAt)`.

| Case | Rules exercised | My answer | Frozen answer | Verdict |
|---|---|---|---|---|
| R0 | Empty prefix | N0 | 0 | agree |
| R1 | Right index absent at integral p | N147 | 147 | agree |
| R2 | Right index just arrived | N148 | 148 | agree |
| R3 | Ordinary 480-sample prefix | N221 | 221 | agree |
| R4 | First cadence prefix | N2205 | 2205 | agree |
| R5 | One-second prefix | N22050 | 22050 | agree |
| R6 | Integral interpolation still needs right sample; prose ramp | exists, left320/right321, value320 | same | agree |
| R7 | Integral interpolation, absent zero-weight neighbor | does not exist | false | agree |
| L1 | Negative exclusion, edge0, common batch stamps | j163–171, q89:256:2137, (.1,.145) | same | agree |
| L2 | Strict watermark across shifted windows | j163–171, q2294:256:4342, (.2,.245) | same | agree |
| L3 | Edge15, no eligible frame, service still counted | empty, (.1,.145) | same | agree |
| L4 | Edge15 first nonnegative frames | j155–156, q246/502, (.2,.245) | same | agree |
| L5 | Edge15 strict watermark | j148–156, q659:256:2707, (.3,.345) | same | agree |
| L6 | Equality excluded, empty batch with backlog | empty, (.2,.25) | same | agree |
| W1 | Before cadence | false | false | agree |
| W2 | Inclusive cadence boundary | true | true | agree |
| W3 | Nominal waiting, not acoustic latency | .099999 | .099999 | agree |
| C1 | Unqueued feed clock | .145 | .145 | agree |
| C2 | Compute included in decision deadline | .201 | .201 | agree |
| C3 | Backlog serializes | .30 | .30 | agree |
| C4 | Idle delivery clears backlog | .24 | .24 | agree |
| C5 | Setup delays first feed | .03 | .03 | agree |
| C6 | Finish uses duration and backlog | .37 | .37 | agree |
| C7 | Whole-clip offline availability | 12 | 12 | agree |
| P1 | Maximum bin, physical vs abstract confidence | (62, .8999999761581421, pitched) physically; (62, .9, pitched) abstractly | (62, .9, pitched) | **ambiguous** |
| P2 | Lowest-bin tie, physical vs abstract confidence | (60, .800000011920929, pitched) physically; (60, .8, pitched) abstractly | (60, .8, pitched) | **ambiguous** |
| P3 | Lowest bin/threshold, physical vs abstract confidence | (21, .30000001192092896, pitched) physically; (21, .3, pitched) abstractly | (21, .3, pitched) | **ambiguous** |
| P4 | Highest note bin, exact float32 | (108, .5, pitched) | same | agree |
| P5 | Uncertain null/confidence, physical vs abstract confidence | (null, .29899999499320984, unpitched) physically; (null, .299, unpitched) abstractly | (null, .299, unpitched) | **ambiguous** |
| O1 | Trim prefix at 86 fps, surplus tail discarded | retained5160, available5254, discard94 | same | agree |
| O2 | Short offline trim | retained86, available142, discard56 | same | agree |
| O3 | Leading pad cancellation | w0/raw15, grid0, decoder0, difference0 | same | agree |
| O4 | 142-frame stitch boundary | w1/raw15, grid36164/22050, decoder36352/22050, difference188/22050 | same | agree |
| O5 | First 172-index correction | w1/raw45, grid43844/22050, decoder438043100/220500000, difference−.0018 | same | agree |
| O6 | Second correction | w2/raw75, grid87688/22050, decoder876086200/220500000, difference−.0036 | same | agree |
| O7 | Both decoded endpoints use stitched axis | onset36352/22050, end438043100/220500000 | same | agree |

Inherited seam-2 cases: **32 agree, 0 disagree, 4 ambiguous**. The P verdicts concern
the representation layer newly made explicit in seam 3, not pitch selection. All four
MIDI/kind decisions agree. This does not rewrite the prior audit's historical verdicts.

### Earlier inherited samples

| Case | Rules exercised | My answer | Oracle | Verdict |
|---|---|---|---|---|
| T3 | Both nominal edge gaps | N22050; edge0 21982/22050, gap68/22050; edge15 18142/22050, gap3908/22050 | same rationals; displayed decimals rounded to 9 places | agree |
| T8 | Onset-map peak cannot turn uncertain pitch into a dead assertion | null pitched observation, no decoded pitchless onset/dead verdict | same | agree |

T3 is compared to its exact rational fields, not a falsely precise reading of its
nine-decimal display. T4/T7's old nominal madeAt/prefix rules are superseded; current
clock and prefix cases above exercise their replacements.

## Independent arithmetic and interpretation

### I1–I4 and R0–R7: causal interpolation

For M delivered samples, right index `floor(320j/147)+1` must be less than M.
Equivalently `j < (M−1)147/320`, so the count is
`N = max(0, ceil((M−1)147/320))` for these nonnegative prefixes.

| Case | Count/existence derivation |
|---|---|
| I1 | M1: upper bound0, so no j exists. |
| I2 | M2: upper bound147/320, so only j0; its right neighbor is index1. |
| R0 | M0: no input or output. |
| R1 | M321: upper bound147, strict, hence j0–146, count147. |
| R2 | M322: upper bound47187/320 =147.459375, hence count148. |
| R3 | M480: upper bound70413/320 =220.040625, hence count221. j220 needs right479; j221 needs482. |
| R4 | M4800: upper bound705453/320 =2204.540625, hence count2205. |
| R5 | M48000: upper bound7055853/320 =22049.540625, hence count22050. |
| R6 | j147 gives p320, weights1/0, but both indices320/321 must exist. With M322 they do; the prose ramp gives value320, exactly float32. |
| R7 | With M321, right index321 is absent, so no output even though its weight is zero. |

**I3 disagreement.** `p=320/147=2+26/147`. The unrounded interpolant is
`(121×10 + 26×24)/147 =1834/147 =262/21`. Seam 3's streaming rule then says to
“round it to float32 exactly as the frozen NativeModel input tensor does.” At this
magnitude the float32 step is `2^-20`. In units of that step,
`262×1048576/21 =13082233 +19/21`; round to integer13082234. The stored answer is
`13082234/1048576 =12.476190567016602`, exceeding the frozen rational by
`1/11010048`, approximately `9.08×10^-8` sample-amplitude units. These are different
representations, not a timing discrepancy. The contract explicitly requires the
rounded sample; the oracle supplies only the interpolant. If `values` was intended
to test a pre-storage helper, that layer must be stated and a rounded-tensor case
must cover the actual rule. Implementation agreement cannot choose that layer.

**I4.** The same j1 needs indices2/3. M3 has only0/1/2, so the result is null;
neither interpolation nor finish may manufacture index3.

### K1–K4, D1–D3 and C1–C7: work and serial completion

The current cost definition resolves the old numerator/denominator wording:
`work = setup + sum(feeds) + finish`; `ratio = work / duration`.

- K1: `.02+.18+.04+.01=.25`; `.25/1=.25`, passing the inclusive gate. Shared load
  `.5` is reported separately, not added to per-example work.
- K2: changing `.18` to `.180001` makes work/ratio `.250001`, which fails.
- K3: the K1 work over two seconds is `.25/2=.125`, which passes.
- K4: division by zero audio duration is refused; there is no ratio/pass.

Completion is `F=max(D,previous)+service`. Setup initializes previous; availableAt
and every returned decision's madeAt equal F. Delivery remains D, not F.

| Case | Substitution | Completion | Backlog F−D |
|---|---|---|---|
| C1 | max(.1,0)+.045 | .145 | .045 |
| C2 | max(.1,0)+.101 | .201 | .101 |
| C3 | max(.2,.24)+.060 | .300 | .100 |
| C4 | max(.2,.13)+.040 | .240 | .040 |
| C5 | max(.01,.02)+.010 | .030 | .020 |
| C6 | max(.3,.35)+.020 | .370 | .070 |
| C7 | max(10,0)+2 | 12 | 2 |
| O9 | max(10,11)+2 | 13 | 3 |

C2's .201 completion exceeds a .2 deadline from an onset at zero, despite nominal
.1 delivery. This is arithmetic, not a newly measured deadline case. C6 is finish
behind a busy lane; C7/O9 contrast idle/busy offline availability. Neither offline
answer licenses a causal cursor.

D1 uses C1's .145, replacing the listener's .001 while retaining refersTo .08:
`0≤.08≤.1≤.145`. D2 violates `.11≤.1`; D3 violates `0≤−.01`. Both are rejected.
The frozen cases exercise refersTo rejection, not every other nonfinite/negative field.

### F1–F3: prefix equality

At cutoff4800 retain emitting delivery indices≤4800. F1 retains one record in each
run; MIDI60/audioTime.05/refersTo.08/delivery4800 are equal. Availability/madeAt .145
and .6 are excluded, so equality holds. F2 changes MIDI to62 and fails. F3's second
record is at4801 and is excluded: lengths1 and0 differ. These compare nominal
records; they do not themselves provide enough service data to check each clock's
recurrence or actual sample access.

### S1–S5, L1–L6, W1–W3 and T3: windows and state

S1 starts next4800. Delivered4799 does nothing. Delivered5000 runs once, next9600;
5001 does nothing. Delivered20000 consumes9600/14400/19200 once, next24000;
20001 does nothing. Delivered24000 runs once, next28800. The resulting delivery
list is `[5000,20000,24000]`.

S2: `43845−43844=1`; retain chronological ramp indices1…43844, pad0. S3:
`2−43844=−43842`; prepend43842 zeros, then ramp values0/1. Thus first tensor value0,
last1. These check simple window coordinates, not a multi-chunk ring/resampler trace.

For each L case, `start=N−43844`, `q=start+256j`, retain q≥0 and q>watermark,
with maximum j171 for edge0 and j156 for edge15. AudioTime is q/22050; all listed
q are before nominal delivery and each batch shares its clock completion.

| Case | Boundary calculation | Surviving coordinates | Clock |
|---|---|---|---|
| L1 | N2205, start−41639; j162→−167, j163→89 | 89:256:2137, 9 frames | max(.1,0)+.045=.145 |
| L2 | N4410, start−39434; j162→2038≤2137, j163→2294 | 2294:256:4342, 9 | max(.2,.145)+.045=.245 |
| L3 | N2205, last permitted j156→−1703 | none | .145 |
| L4 | N4410; j154→−10, j155→246, j156→502 | 246,502, 2 | .245 |
| L5 | N6615, start−37229; j147→403≤502, j148→659 | 659:256:2707, 9 | max(.3,.245)+.045=.345 |
| L6 | N4410, largest q4342 equals watermark4342 | none | max(.2,.245)+.005=.250 |

L5's full coordinates are `[659,915,1171,1427,1683,1939,2195,2451,2707]`.
S4 uses the same first/second arrays as L1/L2, all unpitched:
`[89,345,601,857,1113,1369,1625,1881,2137]` then
`[2294,2550,2806,3062,3318,3574,3830,4086,4342]`.
The first batch advances the watermark to2137 despite null pitch; the second ends
at4342. Equality-only de-duplication would incorrectly admit earlier coordinates.

W1:4799<4800, false. W2:4800≥4800, true.
W3:.2−.100001=.099999 seconds until the next scheduled window, with no assertion
that the window detects that onset.

T3: N22050, start−21794. Edge0 j171 yields21982, so audioTime21982/22050 and
gap `(22050−21982)/22050=68/22050`, about .003083900 seconds. Edge15 j156 yields18142,
gap `(22050−18142)/22050=3908/22050`, about .177233560 seconds. These are nominal
coordinates; compute, waiting and acoustic context are additional considerations.

**S5 ambiguity.** The JSON input is `{}`. Its arithmetic prose supplies setup .02,
feed delivery .01/service .01 and finish delivery .01/service .005. Using those as
fixture inputs gives start .02, feed max(.01,.02)+.01=.03, finish
max(.01,.03)+.005=.035. A .01-second prefix is480 input samples, below4800, so no
model call occurs and finish cannot add one. Old history must be unchanged.
But neither inputs nor prose supplies the *second* start's measured setup. If it is
.003, resetCompletion=.003; if .02, resetCompletion=.02. Both satisfy the reset
rule, with samples0 and watermark null. The frozen .003 cannot be independently
selected. Returned start/feed/finish payloads and before/after history are also
unspecified. Freeze the complete fixture, including an emission-free finish case;
expected fields are not substitute inputs.

### O1–O11: offline length, timestamps and parity

O1: `L=1323000=60×22050`; retained `floor(L×86/22050)=5160`.
Available `37×142=5254`; discard the last94. Current window-count rule independently
gives `ceil((1323000+3840)/36164)=37`, since36 hops are1301904 and37 are1338068.
O2: `L=22050` retains86 of142, discarding56; total25890 gives one window.
O8: `L=22100`, total25940, one window; `22100×86/22050=86+4300/22050`, floor86;
first-window tail `43844−25940=17904`. The available142 leave56 surplus frames.

For index i, `w=floor(i/142)`, raw `15+(i mod142)`, grid
`g=(256i−188w)/22050`, and decoder
`t=(256i−188 floor(i/172))/22050 − .0018 floor(i/172)`.

| Case | i; w/raw; correction count | Grid | Decoder and difference t−g |
|---|---|---|---|
| O3 | 0;0/15;0 | 0 | 0; difference0 (raw15×256 cancels pad3840) |
| O4 | 142;1/15;0 | (36352−188)/22050 | 36352/22050; difference188/22050 |
| O5 | 172;1/45;1 | (44032−188)/22050 | 43844/22050−.0018 =438043100/220500000; difference−.0018 |
| O6 | 344;2/75;2 | (88064−376)/22050 | 87688/22050−.0036 =876086200/220500000; difference−.0036 |
| O10 | 5160;36/63;30 | (1320960−6768)/22050 | (1320960−5640)/22050−.054 =1314129300/22050000; difference−6270/2205000 |

For O10, `5160=36×142+48=30×172`. Its difference is
`1128/22050−.054 =−62.7/22050 =−.002843537414966…` seconds.
It agrees with the frozen rational. A fixed illustrative −1.8-ms lower bound would
already fail O6; neither a short nor a long case proves a uniform bound.

O7 uses *both* endpoints from the table: onset `36352/22050`, end
`43844/22050−.0018`. Duration is `7492/22050−.0018`, not `30×256/22050`.
O9's busy-lane availability13 was derived above; neither endpoint shifts with compute.

**O11 ambiguity.** `N(87084)=ceil(87083×147/320)=ceil(12801201/320)=40004`.
Thus live padding `43844−40004=3840` equals the offline leading pad.
The oracle's scheduling reason is “M87084 is not a multiple of4800.” Under ordinary
480-sample deliveries it is not even a delivery boundary (`87084=181×480+204`),
and under a nominal-boundary-only reading `scheduled=false`.
But seam 3 expressly allows the first delivered chunk crossing a schedule:
a delivered history ending at81600 then87084 has next86400; at87084 it **must**
infer once, advancing next to91200. A history already delivered through86400 has
next91200, and87084 does not infer. Both histories obey seam 3; neither is frozen
by O11. `scheduled` is therefore not a function of total input count alone. Specify
history/next and reconcile the inherited unconditional “N=40004 is not an inference
boundary” claim with irregular delivery. Equal padding still does not prove HQ/linear
resampler parity or identical input tensors.

### P1–P6, E1/E2 and T8: representation and reduction

On abstract decimal activations, P1 selects max.9 at bin41→MIDI62; P2's .8 tie
chooses bin39→60; P3's inclusive .3 at bin0→21; P4 bin87→108 with .5;
P5's .299 is below .3, giving `(null,.299,unpitched)`.

Seam 3 also explicitly says maps are float32 and confidence is physical float32.
For values in [.5,1), the step is2^-24; in [.25,.5), it is2^-25:

| Case | Scaling and nearest integer | Physical confidence |
|---|---|---|
| P1 | .9×16777216=15099494.4 →15099494 | 15099494/16777216 =.8999999761581421 |
| P2 | .8×16777216=13421772.8 →13421773 | 13421773/16777216 =.800000011920929… |
| P3/P6 | .3×33554432=10066329.6 →10066330 | 10066330/33554432 =.30000001192092896 |
| P4 | .5 is exactly binary | .5 |
| P5 | .299×33554432=10032775.168 →10032775 | 10032775/33554432 =.29899999499320984 |

**P1/P2/P3/P5 ambiguity.** Seam 3 explicitly preserves inherited cases, whose
`pitch` operations use literal decimal confidences, and adds a `floatPitch` P6.
If `pitch` is a declared abstract pre-conversion helper, the old answers agree. If
it represents the physical maps required by the current contract, the table above
is the answer. No written operation-layer distinction or confidence comparison
precision selects between those readings. Pitch ordering, threshold side, MIDI and
kind agree either way; confidence representation does not. Specify the abstraction
and preserve separate physical coverage rather than infer it from adapter code.
P6 explicitly exercises physical .3, selecting MIDI60 and preserving its rounded
confidence, so agrees. P4 is representation-independent and agrees.

E1 sorts by onset then MIDI: the .1/MIDI60 event (end.2/confidence.9), then
.1/MIDI62 (end.3/confidence.7), then .2/MIDI64 (end.4/confidence.8). Sorting preserves
the already supplied decoded-event fields; it does not purport to convert map floats.
E2: null reduced pitch means uncertain, so decoded pitchless onset count0 and dead
assertion count0. T8 adds an onset-map peak without an above-threshold note bin;
the same semantic conclusion follows. Neither case validates official event decoding.

### N1/N2: nonlocal dependency versus a specified normalization

The rules say NormalizedLog reduces over frequency **and time** and altered extrema
can change retained features. They do not write its numeric formula, range, epsilon
or constant-range policy. With min0, max2, conventional unit-range normalization
`(x−min)/(max−min)` gives N1 `[0,1/2,1]`; with max4, N2 `[0,1/4,1]`.
An equally extrema-dependent symmetric normalization
`2(x−min)/(max−min)−1` gives `[-1,0,1]` and `[-1,−1/2,1]`.
Both change the retained middle feature when the last value changes. The oracle's
arithmetic supplies its chosen unit-range formula, but the rule text does not;
reading the pinned implementation to choose it is explicitly outside this audit.
Thus the illustrative *dependency* agrees, while the two scalar expected arrays are
ambiguous as independent numerical oracles. Put the illustrative formula in the
rules (or explicitly define it as a toy independent of the pinned layer); actual
NormalizedLog/ONNX parity remains separate adoption evidence.

## Rules I could not exercise

These are uncovered or only partially exercised, not additional agreements. The
seam's explicit DSP/procedural boundaries are useful, but do not themselves supply
evidence of compliance. None was checked against implementation in this audit.

| Rule/obligation | Coverage now and remaining resolution/adoption requirement |
|---|---|
| Rounded streaming samples and inherited confidence representation | I1/I2/I4 and R/L cases cover counts/coordinates. I3 omits the required rounded result; P6 covers one physical confidence, P1/P2/P3/P5 leave the abstraction unstated. Resolve those case findings before claiming complete representation coverage. |
| Start/feed/finish, empty-call aggregate cost, fresh reset | K1–K3 settle work/audio and the inclusive gate, but do not label emission-free calls. S5 is under-specified and never reaches cadence, so cannot prove clearing populated watermark/ring/cadence/history or a pending interpolation neighbor. Freeze full input/emission/service sequences, including an empty finish whose work is charged, and a nonempty prior state followed by reset. |
| Live resampler state across chunks/eviction | I3/I4 are isolated interpolation cases; S2/S3 are completed-window ramps. No frozen chunked input trace shows a pending fractional output emitted exactly once when its neighbor arrives, eviction retaining the needed input neighbor, global indices after wraparound, or equality to a single-prefix tensor. This is an explicit streaming rule, not native neural DSP. |
| Irregular cadence and first-window parity | S1 covers scheduling alone. O11 lacks delivery history and uses a regular-grid reason no longer sufficient. No frozen HQ/live waveform pair establishes tensor parity; equal leading pad is only geometry. Resolve scheduling separately from resampler adoption evidence. |
| Prefix equality and time validation | F1–F3 cover changed payload, wall variation and a moved delivery. D1–D3 cover ownership/retrospection and negative/future refersTo. Nonfinite rejection, start refersTo0, and each run's measured recurrence/causal sample access still require cases or adoption evidence. No frozen case gives a complete paired-run service trace alongside prefix records. |
| Offline window construction and endpoint/trim rules | O1/O8 exercise computed counts and fractional floor; O3–O7/O10 exercise axes/endpoints. No exact-hop-boundary or L0 window-count case, nor an actual multi-window zero-tail tensor. Nonnegative-integer length validation lacks a rejecting case. Cases here establish arithmetic, not the official HQ signal. |
| Normalization and neural caching | N1/N2 demonstrate dependence but lack an independently stated scalar formula. No scalar timing case establishes full NormalizedLog, convolution context, cached maps or selection equivalence. A neural optimization must retain the seam's independent map/selection equivalence obligation. |
| Full official decoder, pinned HQ DSP and map dimensions | No frozen map fixture exercises onset.5/frame.3/min11/inferred-onset/Melodia rules or 88/264-bin float32 serialization. E1 tests sorting/preservation, E2/T8 semantic refusal; these are not decoding/DSP coverage. Seam 3 appropriately requires frozen-producer map/event/input/model/environment/source parity at native adoption. That remains unverified here. |
| Provenance, actual timers, cache reuse, score blindness | K cases distinguish shared load algebraically; none proves once-only accounting of real copies/waits/work or separate load reporting. Model/input/source/adapter hashes, retained hashed per-call traces, fresh costs despite musical-cache reuse, causal input bytes, score-free backend arguments and actual monotonic timing need adoption evidence. Host cost is provisional; no device/cold-start claim follows. |
| Copied listener logic and refusals | Three-frame confirmation, transitions, chord/adjacent-pitch refusal and lack of chord/dead capability remain listener behavior outside this timing oracle. No new capability or timing guarantee is inferred. |

Compared with audit 2's uncovered list, seam 3 now provides substantive frozen cases
for cost fraction/boundary, variable-wall-time prefix comparison, returned-decision
stamps, irregular cadence, a full-window eviction boundary, unpitched watermark,
minimal prefixes, fractional offline length, busy offline availability, a distant
stitched index and event sorting. It also names the DSP/procedural adoption boundary
explicitly. That progress does not resolve the disagreement, the ambiguous case
layers/inputs, or the still-unfrozen state transitions above. Do not replace these
missing oracle inputs with passing implementation tests.

## Resolution and verdict

The next numbered challenger experiment should resolve I3, S5, O11, N1/N2 and the
P1/P2/P3/P5 representation distinction, freeze the remaining gate-relevant state and
cost cases, and carry the procedural/DSP checklist into actual native adoption.
It may demonstrate that an audit reading is wrong by pointing to a sufficient rule;
it must not silently edit a frozen expected answer. Any new/re-versioned oracle
needs a fresh independent audit before listener judgment. This audit changes no
oracle, rules, code, experiment ledger or listener.

**Final case verdict: 57 agree, 1 disagree, 8 ambiguous; coverage incomplete.**
