# Observation seam 4 — independent audit

2026-10-05. **GPT-6-Astra (high) in Codex**.

## Scope and independence

Audit of observation-seam@4, frozen SHA-256
`f631324dd192d9c008d9e27336a09ce1385a130a367e85add6152b9ade8e0167`
(51 cases; independently hashed bytes match the freeze).
Rules: [development contract 2](../../contracts/development-contract-2.md), including
its 2026-10-04 amendment, and [observation seam 4](../../contracts/observation-seam-4.md),
which inherits [seam 3](../../contracts/observation-seam-3.md) and
[seam 2](../../contracts/observation-seam-2.md) except where expressly superseded.
Inherited samples also use [seam 1](../../contracts/observation-seam-1.md)'s T3/T8.

I read the research log's Current state and Open questions, not its Findings table.
No audit of version 4 or competing worktree existed. I read no implementation,
evaluator tests, experiment report or run results, and ran no evaluator, listener
or test during derivation. Question 37's request to assess native run evidence cannot
be satisfied within AUDITING_AN_ORACLE's explicit prohibition on reading any run's
results or implementation: the native-adoption obligations below are **not audited**.
Hand-case agreement must not be reported as independent native adoption approval.

I extracted only IDs, operations and inputs from the JSON files, excluding `expected`
and hand arithmetic, and wrote the derivations below before opening those fields.
Python's standard-library rational arithmetic and IEEE binary32 packing were used as
calculators for selected fractions/bits, not as an implementation of the seam or an
oracle runner. T3/T8 are a combined input/answer table in seam 1, so their printed
answers were visible when that definition was read; their arithmetic is nonetheless
shown independently below. The earlier audit files were not read during derivation.

Precision: exact integers/IDs/booleans/null; physical values exact binary32 bits;
abstract activations stay binary64; rational/time comparisons at 1e-12 seconds.
`v4:`, `v3:`, `v2:` identify the source oracle file, avoiding ID collisions.
Inherited v2 freeze SHA-256:
`1a353ed0e56f4b2e3b765832c8b373d9147f02002238cab4efcc34d6fccddcac`;
v3 freeze SHA-256:
`83f48b1c37199a58f4d646bffb9986fac21bd7f122f4d89296c9c53d3f8bd0dc`.

## Case comparison

**90 cases: 90 agree, 0 disagree, 0 ambiguous.** All 51 v4 cases, all36 v2 cases,
v3:I3 and v1:T3/T8. This counts case agreements, not uncovered rules.
The oracle column normalizes equivalent rational forms; physical hexadecimal values
are exact. For batches F denotes both availableAt and madeAt; audioTime is q/22050.
`H` means historyUnchanged=true. `R` means reset completion/work .003,
samples/generated/retained input/retained model0, next schedule4800, watermark null,
history empty. Those are all the frozen lifecycle reset fields. E1 tuples are
(onset,end,MIDI,confidence). `invalid` corresponds to expected true in rejecting cases.

| Case | Rules exercised | My answer | Frozen oracle answer | Verdict |
|---|---|---|---|---|
| v4:I1 | right-neighbor existence | N=0 | N=0 | agree |
| v4:I2 | minimal output prefix | N=1 | N=1 | agree |
| v4:I3 | physical interpolation | 0x41479e7a | 0x41479e7a | agree |
| v4:I4 | absent right neighbor | null | null | agree |
| v4:K1 | complete work, inclusive gate, shared load | work=.25; ratio=.25; pass; shared=.5 | work=.25; ratio=.25; pass; shared=.5 | agree |
| v4:K2 | unrounded gate | work=ratio=.250001; fail; shared=.5 | work=ratio=.250001; fail; shared=.5 | agree |
| v4:K3 | audio denominator | work=.25; ratio=.125; pass; shared=0 | work=.25; ratio=.125; pass; shared=0 | agree |
| v4:K4 | zero duration | invalid | invalid | agree |
| v4:D1 | runner stamp, retrospective time | refersTo=.08; madeAt=.145; payload unchanged | refersTo=.08; madeAt=.145; payload unchanged | agree |
| v4:D2 | future refersTo | invalid | invalid | agree |
| v4:D3 | negative refersTo | invalid | invalid | agree |
| v4:F1 | variable-wall-time prefix | equal=true | equal=true | agree |
| v4:F2 | payload difference | equal=false | equal=false | agree |
| v4:F3 | emitting-index selection | equal=false | equal=false | agree |
| v4:S1 | irregular cadence | calls at5000,20000,24000 | calls at5000,20000,24000 | agree |
| v4:S2 | latest window eviction | start1; pad0; first1; last43844 | start1; pad0; first1; last43844 | agree |
| v4:S3 | left padding | start-43842; pad43842; first0; last1 | start-43842; pad43842; first0; last1 | agree |
| v4:S4 | null-frame watermark | q89..2137 and2294..4342 step256; final4342 | q89..2137 and2294..4342 step256; final4342 | agree |
| v4:S5 | setup/feed/finish/reset | F=[.02,.03,.035]; calls0; work.035; ratio3.5; H; R | F=[.02,.03,.035]; calls0; work.035; ratio3.5; H; R | agree |
| v4:O8 | fractional trim/window tail | windows1; retained86; first tail17904 | windows1; retained86; first tail17904 | agree |
| v4:O9 | busy offline lane | completion13 | completion13 | agree |
| v4:O10 | long stitched axis | w36/raw63; g=1314192/22050; t=1315320/22050-.054; delta=-209/73500 | w36/raw63; g=1314192/22050; t=1315320/22050-.054; delta=-209/73500 | agree |
| v4:O11 | previously consumed schedule | offline/live pad3840; scheduled=false | offline/live pad3840; scheduled=false | agree |
| v4:P6 | float32 threshold | MIDI60; confidence0x3e99999a; pitched | MIDI60; confidence0x3e99999a; pitched | agree |
| v4:E1 | onset/MIDI sorting, preservation | (.1,.2,60,.9),(.1,.3,62,.7),(.2,.4,64,.8) | (.1,.2,60,.9),(.1,.3,62,.7),(.2,.4,64,.8) | agree |
| v4:E2 | frame/event distinction | unpitched frame; decoded pitchless0; dead assertions0 | unpitched frame; decoded pitchless0; dead assertions0 | agree |
| v4:N1 | toy normalization | [0,.5,1] | [0,.5,1] | agree |
| v4:N2 | changed global extremum | [0,.25,1] | [0,.25,1] | agree |
| v4:O12 | irregular first crossing | offline/live pad3840; scheduled=true | offline/live pad3840; scheduled=true | agree |
| v4:P7 | physical maximum | MIDI62; confidence0x3f666666; pitched | MIDI62; confidence0x3f666666; pitched | agree |
| v4:P8 | physical tie | MIDI60; confidence0x3f4ccccd; pitched | MIDI60; confidence0x3f4ccccd; pitched | agree |
| v4:P9 | low bin, physical threshold | MIDI21; confidence0x3e99999a; pitched | MIDI21; confidence0x3e99999a; pitched | agree |
| v4:P10 | high bin | MIDI108; confidence0x3f000000; pitched | MIDI108; confidence0x3f000000; pitched | agree |
| v4:P11 | physical subthreshold | null; confidence0x3e991687; unpitched | null; confidence0x3e991687; unpitched | agree |
| v4:N3 | constant normalization | [0,0,0] | [0,0,0] | agree |
| v4:S6 | populated reset, empty feed cost | F=[.02,.145,.149,.154]; calls1; work.074; ratio.74; H; R | F=[.02,.145,.149,.154]; calls1; work.074; ratio.74; H; R | agree |
| v4:S7 | chunk/pending-neighbor trace | N=[1,2,2,3]; new=[0x00000000],[0x41479e7a],[],[0x422e2650]; retained=[1,0,0,0]; offsets=[2,4,4,6] | N=[1,2,2,3]; new=[0x00000000],[0x41479e7a],[],[0x422e2650]; retained=[1,0,0,0]; offsets=[2,4,4,6] | agree |
| v4:S8 | ring wrap/global indices | N44100; input0; ring43844; start256; first0x440b51da; last0x47bb7ee9; byteEqual=true | N44100; input0; ring43844; start256; first0x440b51da; last0x47bb7ee9; byteEqual=true | agree |
| v4:S9 | pending-neighbor reset | F=[0,.0010625,.0030625]; calls0; work.003; ratio48; H; R | F=[0,.0010625,.0030625]; calls0; work.003; ratio48; H; R | agree |
| v4:F4 | paired prefix/cost recurrence | equal=true; A=[.145,.26]; B=[.3,.4] | equal=true; A=[.145,.26]; B=[.3,.4] | agree |
| v4:D4 | nonfinite delivery | invalid | invalid | agree |
| v4:D5 | nonfinite service | invalid | invalid | agree |
| v4:D6 | nonfinite refersTo | invalid | invalid | agree |
| v4:D7 | nonfinite prior completion | invalid | invalid | agree |
| v4:D8 | start refersTo0 | invalid | invalid | agree |
| v4:O13 | zero-length geometry | windows1; retained0; first tail40004 | windows1; retained0; first tail40004 | agree |
| v4:O14 | exact-hop exclusion | windows1; retained126; first tail7680 | windows1; retained126; first tail7680 | agree |
| v4:O15 | just-past-hop inclusion | windows2; retained126; first tail7679 | windows2; retained126; first tail7679 | agree |
| v4:O16 | negative offline length | invalid | invalid | agree |
| v4:O17 | fractional offline length | invalid | invalid | agree |
| v4:O18 | two actual padded tensors | start0/tail7679/nonzero3841..36164/values1..32324; start36164/tail43843/nonzero0..0/value32324 | start0/tail7679/nonzero3841..36164/values1..32324; start36164/tail43843/nonzero0..0/value32324 | agree |
| v2:R0 | empty input | N=0 | N=0 | agree |
| v2:R1 | integral right index absent | N=147 | N=147 | agree |
| v2:R2 | integral right index present | N=148 | N=148 | agree |
| v2:R3 | ordinary input chunk | N=221 | N=221 | agree |
| v2:R4 | first scheduled prefix | N=2205 | N=2205 | agree |
| v2:R5 | one-second prefix | N=22050 | N=22050 | agree |
| v2:R6 | zero-weight neighbor required | exists; left320; right321; ramp value320 | exists; left320; right321; ramp value320 | agree |
| v2:R7 | missing zero-weight neighbor | absent | absent | agree |
| v2:L1 | first edge0 batch and clock | j163..171; q89..2137 step256; D=.1; F=.145 | j163..171; q89..2137 step256; D=.1; F=.145 | agree |
| v2:L2 | next batch, strict watermark | j163..171; q2294..4342 step256; D=.2; F=.245 | j163..171; q2294..4342 step256; D=.2; F=.245 | agree |
| v2:L3 | all-negative edge15 batch | no frames; D=.1; F=.145 | no frames; D=.1; F=.145 | agree |
| v2:L4 | first nonnegative edge15 batch | j155,156; q246,502; D=.2; F=.245 | j155,156; q246,502; D=.2; F=.245 | agree |
| v2:L5 | edge15 advancement | j148..156; q659..2707 step256; D=.3; F=.345 | j148..156; q659..2707 step256; D=.3; F=.345 | agree |
| v2:L6 | equality excluded, empty-call backlog | no frames; D=.2; F=.25 | no frames; D=.2; F=.25 | agree |
| v2:W1 | cadence before boundary | false | false | agree |
| v2:W2 | cadence at boundary | true | true | agree |
| v2:W3 | onset/cadence waiting | .099999 seconds | .099999 seconds | agree |
| v2:C1 | idle lane | .145 | .145 | agree |
| v2:C2 | compute crosses deadline | .201 | .201 | agree |
| v2:C3 | carried backlog | .30 | .30 | agree |
| v2:C4 | cleared backlog | .24 | .24 | agree |
| v2:C5 | setup backlog | .03 | .03 | agree |
| v2:C6 | finish backlog | .37 | .37 | agree |
| v2:C7 | offline availability | 12 | 12 | agree |
| v2:P1 | abstract maximum | MIDI62; confidence.9; pitched | MIDI62; confidence.9; pitched | agree |
| v2:P2 | abstract tie | MIDI60; confidence.8; pitched | MIDI60; confidence.8; pitched | agree |
| v2:P3 | abstract inclusive threshold | MIDI21; confidence.3; pitched | MIDI21; confidence.3; pitched | agree |
| v2:P4 | abstract high bin | MIDI108; confidence.5; pitched | MIDI108; confidence.5; pitched | agree |
| v2:P5 | abstract subthreshold | null; confidence.299; unpitched | null; confidence.299; unpitched | agree |
| v2:O1 | long trim | retained5160; available5254; discarded94 | retained5160; available5254; discarded94 | agree |
| v2:O2 | short trim | retained86; available142; discarded56 | retained86; available142; discarded56 | agree |
| v2:O3 | initial offline axis | w0/raw15; g=t=delta=0 | w0/raw15; g=t=delta=0 | agree |
| v2:O4 | stitched-window boundary | w1/raw15; g=36164/22050; t=36352/22050; delta=188/22050 | w1/raw15; g=36164/22050; t=36352/22050; delta=188/22050 | agree |
| v2:O5 | first upstream correction | w1/raw45; g=43844/22050; t=g-.0018; delta=-.0018 | w1/raw45; g=43844/22050; t=g-.0018; delta=-.0018 | agree |
| v2:O6 | second upstream correction | w2/raw75; g=87688/22050; t=g-.0036; delta=-.0036 | w2/raw75; g=87688/22050; t=g-.0036; delta=-.0036 | agree |
| v2:O7 | independent endpoint conversion | onset=36352/22050; end=43844/22050-.0018 | onset=36352/22050; end=43844/22050-.0018 | agree |
| v3:I3 | inherited abstract interpolation | 1834/147 | 1834/147 | agree |
| v1:T3 | edge-policy nominal gaps | edge0 gap68/22050; edge15 gap3908/22050; times1-gap | edge0 gap68/22050; edge15 gap3908/22050; times1-gap | agree |
| v1:T8 | onset peak plus uncertain pitch | no pitched observation; no pitchless event; no dead verdict | no pitched observation; no pitchless event; no dead verdict | agree |

## Independent derivations (written before comparison)

### Interpolation, storage and retained state

An output exists precisely when floor(320j/147)+1 < M. For integer M >= 2 this
is j < (M-1)*147/320, hence N=ceil((M-1)*147/320). For M=0 or 1, N=0.
Next j=N; its left neighbor is k=floor(320N/147). Retain that input if it exists,
and any still-needed suffix, with global indices intact. Tensor storage rounds to
binary32, ties to even; mathematical fractions are explanatory, not tensor values.

- **v4:I1**: M=1 cannot supply input index 1, so N=0.
- **v4:I2**: M=2 supplies indices 0 and 1: only j=0 exists, N=1, next j=1 needs index3.
- **v4:I3**: j=1, p=320/147=2+26/147; k=2, right=3.
  Value=10*(121/147)+24*(26/147)=1834/147=262/21.
  Binary32 is `0x41479e7a` = 6541117/524288 = 12.476190567016602.
  The contract's 13082234/1048576 is the same reduced fraction.
- **v3:I3**: the explicitly abstract pre-storage helper returns 1834/147;
  the physical value above does not replace this historical helper's answer.
- **v4:I4**: right index3 is absent from three supplied samples, so no value.
- **v4:S2**: length43845 exceeds the 43844 ring by1. Window start1, no padding,
  chronological sample indices1..43844; first/last of an index ramp are1/43844.
- **v4:S3**: length2 gives start -43842, left padding43842 then indices0,1.
- **v4:S7**: chunk [0,0,10] gives M3, N1, new sample j0=0; next j1 needs k2/right3,
  retain offset2/value10, one input. Appending24 gives M4,N2, new j1=`0x41479e7a`;
  next j2 needs k4/right5, so no input remains, offset4. Empty chunk changes nothing.
  Appending40,50 gives M6,N3, j2 p=640/147=4+52/147:
  value40+10*52/147=6400/147, stored `0x422e2650` =43.53741455078125.
  Next j3 needs k6/right7; input empty at offset6. Generated deltas1,1,0,1;
  total counts1,2,2,3 and next j1,2,2,3. Ring lengths1,2,2,3.
- **v4:S8**: M96000, N=ceil(95999*147/320)=44100. Ring drops256 resampled values,
  retains43844; global start256. First p=256*320/147=81920/147, stored
  `0x440b51da`=557.2789306640625. Last p=44099*320/147=14111680/147, stored
  `0x47bb7ee9`=95997.8203125. Next j44100 needs k96000/right96001; input empty,
  offset96000. Each j depends only on the same two global samples in either chunking,
  so 480-sample chunks and one prefix give bit-identical ring contents. Generated
  count44100 is global, not the retained count43844.
- **v2:R0**: M0 => N0.
- **v2:R1**: M321 => ceil(320*147/320)=147, j0..146. j147 needs right321, absent.
- **v2:R2**: M322 => ceil(321*147/320)=148, j147 now exists.
- **v2:R3**: M480 => ceil(479*147/320)=221. j220 needs right479; j221 needs482.
- **v2:R4**: M4800 => ceil(4799*147/320)=2205. j2204 needs4798;
  next j2205 needs4801, absent.
- **v2:R5**: M48000 => ceil(47999*147/320)=22050. j22049 needs47998;
  next j22050 needs48001, absent.
- **v2:R6**: j147 p=320 exactly, k320, right321 exists at M322; fraction0,
  nevertheless the right sample is required. On the case's ramp the value is320.
- **v2:R7**: identical position at M321 lacks right321; no interpolation.

### Selection, cadence and watermark

q=N-43844+256j. Require q>=0, q/22050<=M/48000, and q>watermark;
edge0 ends at j171, edge15 at j156. All emitted q, including unpitched frames,
advance the watermark. Complete calls share their measured completion stamp.

- **v4:S1**: deliveries4799,5000,5001,20000,20001,24000 yield inference at
  5000,20000,24000 only. next starts4800, then9600,24000,28800; missed boundaries
  are consumed once, not replayed. Six flags: false,true,false,true,false,true.
- **v4:S4**: M4800 gives N2205,start-41639; j163..171 produce
  [89,345,601,857,1113,1369,1625,1881,2137]. M9600 gives N4410,start-39434;
  q>2137 selects j163..171, [2294,2550,2806,3062,3318,3574,3830,4086,4342].
  Watermarks2137,4342, even with null pitches.
- **v4:O11**: ceil(87083*147/320)=40004; start=-3840. Delivery87084<next91200:
  not scheduled; geometrically equal leading pad, but differing resamplers.
- **v4:O12**: same N/start, now87084>=86400: scheduled once; next becomes91200.
  This establishes geometry, not offline/live signal parity.
- **v2:L1**: first S4 batch above,9 frames, q89..2137 step256, j163..171;
  D=.1, F=max(.1,0)+.045=.145. Every audioTime=q/22050.
- **v2:L2**: second S4 batch,9 frames q2294..4342 step256, j163..171;
  F=max(.2,.145)+.045=.245; all audioTime=q/22050.
- **v2:L3**: M4800 edge15 max q=-41639+39936=-1703<0: no frames; F=.145.
- **v2:L4**: M9600 edge15 j155,156 give q246,502, two frames; F=.245.
- **v2:L5**: M14400 N6615,start-37229. q>502 begins j148 at659;
  j148..156 => q659..2707 step256,9 frames. F=max(.3,.245)+.045=.345.
- **v2:L6**: M9600 edge0 max q4342 equals watermark4342: no frames,
  F=max(.2,.245)+.005=.250. Strictly-greater eliminates equality and older coordinates.
- **v2:W1**: 4799<4800: not due.
- **v2:W2**: 4800>=4800: due.
- **v2:W3**: .2-.100001=.099999 seconds waiting for the next inference.
- **v1:T3**: M48000 gives N22050/start-21794. q171=-21794+43776=21982;
  q156=-21794+39936=18142. Times21982/22050 and18142/22050; nominal gaps
  1-these =68/22050=.003083900226757 and3908/22050=.177233560090703 seconds.
  These are grid gaps, not acoustic latency or compute-inclusive delay.

### Clocks, work, emissions and lifecycle

For every call F=max(D,previous F)+service; work is setup+all feed service+finish,
not the sum of completion stamps or shared loading. Ratio=work/audio duration.
An empty feed still counts. Reset starts a new lane and work counter at its setup.

- **v4:K1**: .02+.18+.04+.01=.25; duration1 gives ratio .25,
  inclusive pass. Shared load .5 separately.
- **v4:K2**: work .250001, duration1 => .250001>.25: fail, without rounding.
- **v4:K3**: work .25 over2 => .125: pass; shared0.
- **v4:K4**: duration0: refuse, ratio undefined.
- **v4:D1**: max(.1,0)+.045=.145 overwrites madeAt .001; refersTo .08 remains.
- **v4:D2**: .11>.1 delivery: invalid, although .11<completion .145.
- **v4:D3**: refersTo -.01<0: invalid.
- **v4:D4/D5/D7**: nonfinite delivery/service/previous completion respectively: invalid.
- **v4:D6**: infinite refersTo: invalid.
- **v4:D8**: start refersTo .001 is not0: invalid even though setup .02 is later.
- **v4:S5**: start decision refersTo0,madeAt.02. Feed M480,D=.01,
  F=max(.01,.02)+.01=.03. N221, no cadence hit, no model calls/watermark.
  Finish max(.01,.03)+.005=.035; work=.035,duration=.01,ratio3.5 (fail).
  Only start remains in immutable history. Reset setup .003 leaves history empty,
  M=N=ring=input=0,next output0,next schedule4800,watermark null; clock/work .003.
- **v4:S6**: start F.02; feed M4800,D.1,F.145 emits one decision at .145,
  refersTo.1, and9 zero-confidence null frames at q89..2137, audioTime q/22050,
  deliveryAt.1,availableAt.145. Model calls1,watermark2137,N/ring2205,
  no pending input (next output2205 needs index4800). Empty feed F.149;
  finish F.154, no new inference/tail output. Work .02+.045+.004+.005=.074,
  /.1=.74 fail. History=start(.02),feed(.145), unchanged by finish/reset.
  Reset setup .003 clears populated ring/watermark/history/cadence/clock/work as in S5.
- **v4:S9**: M3,D=3/48000=.0000625; N1 sample0; pending left index2/value10
  for next j1. Feed F=.0010625; finish F=.0030625; work=.003;
  ratio .003/.0000625=48 fail. No model calls/emissions, no finish flush,
  ring1/input1 persist until reset. Reset .003 clears that pending neighbor.
- **v2:C1**: max(.1,0)+.045=.145; backlog .045.
- **v2:C2**: max(.1,0)+.101=.201; backlog .101.
- **v2:C3**: max(.2,.24)+.060=.300; backlog .100.
- **v2:C4**: max(.2,.13)+.040=.240; backlog .040 (idle gap cleared prior work).
- **v2:C5**: max(.01,.02)+.010=.030; backlog .020 (setup backlog).
- **v2:C6**: max(.3,.35)+.020=.370; backlog .070.
- **v2:C7**: max(10,0)+2=12; backlog2 (whole-clip availability).
- **v4:O9**: max(10,11)+2=13; backlog3 (busy lane).

### Prefix equality

Selection is by emitting delivery index <= cutoff, never by completion time;
only variable measured timings are excluded, not payload/refersTo/audioTime/index.

- **v4:F1**: both selected at4800; same payload60,audioTime.05,refersTo.08.
  .145 versus .6 completion does not change equality: true. These inputs alone
  do not prove either recurrence; they omit service history.
- **v4:F2**: MIDI60 versus62 differs: false.
- **v4:F3**: a selected at4800, b at4801 excluded: one record versus none, false.
- **v4:F4**: `samples` here are the emitting delivery counts4800,9600 (not chunk
  lengths); both runs select both records. A: F1=max(.1,.02)+.045=.145,
  F2=max(.2,.145)+.06=.26. B: F1=max(.1,.03)+.2=.3,
  F2=max(.2,.3)+.1=.4. Corresponding IDs/kinds/refersTo .08,.2 and indices match:
  true despite different completion stamps. Each lane separately meets its recurrence.

### Pitch, normalization and event representation

- **v4:P6**: float32(.3)=`0x3e99999a`=5033165/16777216=.30000001192092896,
  >=.3; bin39=>MIDI60,pitched; confidence is that stored value.
- **v4:P7**: float32(.9)=`0x3f666666`=.8999999761581421 beats
  float32(.8)=`0x3f4ccccd`=.800000011920929. bin41=>MIDI62,pitched.
- **v4:P8**: both .8 store identical `0x3f4ccccd`; lower bin39 wins=>MIDI60,pitched.
- **v4:P9**: bin0=>MIDI21, confidence`0x3e99999a`, pitched inclusive threshold.
- **v4:P10**: bin87=>MIDI108, .5 exactly `0x3f000000`, pitched.
- **v4:P11**: float32(.299)=`0x3e991687`=.29899999499320984<.3:
  MIDI null, unpitched, retain this maximum as confidence.
- **v2:P1**: abstract .9>.8: bin41,MIDI62,confidence .9,pitched.
- **v2:P2**: abstract .8 tie: bin39,MIDI60,confidence .8,pitched.
- **v2:P3**: abstract .3 inclusive: bin0,MIDI21,confidence .3,pitched.
- **v2:P4**: bin87,MIDI108,confidence .5,pitched.
- **v2:P5**: abstract .299<.3: null,confidence .299,unpitched.
- **v4:E1**: ascending onset then MIDI yields (.1,.2,60,.9),(.1,.3,62,.7),
  (.2,.4,64,.8), tuples (onset,end,MIDI,confidence). End/confidence unchanged;
  event sort is not a physical frame-map cast.
- **v4:E2**, **v1:T8**: null reduced pitch denotes uncertainty. No decoded pitchless
  onset or dead verdict follows, even from an onset-map peak with subthreshold notes.
- **v4:N1**: (x-min)/(max-min) on [0,1,2]: [0,1/2,1].
- **v4:N2**: same on [0,1,4]: [0,1/4,1]. Changing a future extremum changes
  an earlier normalized value; a cached normalized frame is not automatically valid.
- **v4:N3**: range2-2=0: explicit constant-vector rule gives [0,0,0].
  None of these toy log-power inputs exercises native x ->10log10(x²+1e-10).

### Offline lengths, padding and the two time axes

Window starts are h*36164<L+3840; count ceil((L+3840)/36164). Trim30 raw
frames/window (15 each end), concatenate142/window, retain floor(L*86/22050).
For stitched i, w=floor(i/142), raw=15+(i mod142), g=(256i-188w)/22050,
t=256i/22050-floor(i/172)*(188/22050+.0018).

- **v4:O8**: L22100,total25940,count1,tail43844-25940=17904;
  retain floor1900600/22050=86. Of142 candidates discard56.
- **v4:O10**: i5160,w36,remainder48,raw63; floor(i/172)=30.
  g=1314192/22050=59.60054421768707;
  t=1315320/22050-.054=59.59770068027211;
  t-g=1128/22050-.054=-209/73500=-.002843537414966 seconds.
  Thus the old illustrative -.0018 lower offset is not a uniform bound.
- **v4:O13**: L0,total3840,count1,retained0,tail40004.
- **v4:O14**: L32324,total36164,count1 (start36164 excluded),
  retain floor2779864/22050=126,tail7680.
- **v4:O15**: L32325,total36165,count2 (start36164 now included),
  retain floor2779950/22050=126,last window tail43843; first window tail7679.
- **v4:O16**: negative length-1 invalid.
- **v4:O17**: fractional length1.5 invalid.
- **v4:O18**: L32325 padded total36165. Window0 starts0; leading3840 zeros
  plus input x0=0 at local3840; first nonzero local3841=1, last input local36164=32324,
  zero tail7679. Window1 starts36164, first sample32324, remaining43843 zeros.
  Exactly two windows; overlap duplicates the final real sample appropriately.
- **v2:O1**: L1323000=60*22050; retain5160, 37*142=5254 after edge trim,
  surplus94; raw37*172=6364, edge removals1110.
- **v2:O2**: L22050 retain86,142 after trim,surplus56; raw172,edge removals30.
- **v2:O3**: i0=>w0,raw15,g=t=0,difference0.
- **v2:O4**: i142=>w1,raw15,g36164/22050,t36352/22050,
  difference188/22050=.008526077097506.
- **v2:O5**: i172=>w1,raw45,g43844/22050,t43844/22050-.0018,
  difference-.0018.
- **v2:O6**: i344=>w2,raw75,g87688/22050,t87688/22050-.0036,
  difference-.0036; the upstream correction is applied twice.
- **v2:O7**: onset t142=36352/22050; end t172=43844/22050-.0018;
  duration=(43844-36352)/22050-.0018=7492/22050-.0018.
  Applying t(endIndex-onsetIndex)=7680/22050 would be wrong: each endpoint has
  its own correction count.

## Rules I could not exercise

After the independent derivations above were written and compared with the frozen
answers, I read **only the
"Rules I could not exercise" section of
[audit 3](audit-observation-seam-3.md#rules-i-could-not-exercise)** as the inherited
coverage checklist. I did not use its arithmetic or case verdicts to choose mine.

Seam 4 resolves the previous representation/lifecycle-input/scheduling/toy-formula
problems: physical I3 and P6–P11 have exact-bit answers; the old helper/abstract
activations have an explicit layer; S5/S6/S9 provide inputs and reset answers;
S7/S8 cover cross-chunk interpolation and wrap; O11/O12 supply scheduling history;
F4 supplies both service traces; D4–D8 cover nonfinite times and start ownership;
O13–O18 cover zero/exact-hop/invalid lengths and actual padded tensors; N1–N3 have
a specified scalar formula. These are substantive improvements, with no arithmetic
correction requested by this audit.

The following are **uncovered or partially covered**, not additional agreements.
No passing implementation test or author's reported native parity fills this table.

| Rule or obligation | What the frozen cases establish | What remains for resolution/adoption |
|---|---|---|
| Finish must not flush interpolation or invoke inference; returned finish emissions are stamped and appended immutably | S5/S6/S9 give completion/work, model-call count, unchanged history and reset totals. S9 starts with a pending neighbor. All three give an empty finish-emission list. | No frozen answer records the generated/ring/pending state immediately before and after finish. S9's resetGenerated=0 cannot distinguish a forbidden flush followed by reset from no flush. No case has a returned finish decision and its expected madeAt/refersTo/history. Freeze these observable answers to exercise the distinct no-flush and nonempty-finish stamping rules. Existing no-model-call and unchanged-old-history answers still agree. |
| Offline length must be a **safe** integer | O13–O17 cover zero, ordinary integers, negative and fractional inputs. | No rejecting case exercises an integer outside the safe range (or a nonfinite length). This boundary is new explicit validation, not proof of DSP behavior. |
| Native NormalizedLog and incremental neural context/slicing | N1–N3 establish only the stipulated toy function; L/S cases establish selected q and window geometry. | No frozen native log-power/map/context case covers float32 10log10(x²+1e-10), global frequency/time extrema, ten-frame left/right context, clipping at original boundaries, right padding or suppressing context outputs. None derives that ten frames are sufficient. These new native obligations require independent evidence; the toy answers cannot certify them. Full DSP is expressly recomputed. |
| Pinned HQ resampler, decoder and full physical representation | P6–P11 establish note-map reductions; E1 establishes sorting/preservation; E2/T8 establish the null distinction; O cases establish geometry/timestamps. | No frozen HQ waveform or full 88/88/264-bin float32 map/event fixture exercises official onset.5/frame.3/min11/inferred/Melodia decoding or map serialization. These are explicitly pinned-producer adoption obligations. Equal padding does not establish HQ/linear equality. |
| Delivery clock inside the live chain, causal sample access and native prefix equality | D1 preserves an explicitly supplied retrospective refersTo while changing madeAt; F4 establishes two correct recurrences and equal synthetic payloads. | No hand case runs a chain whose support clock could accidentally receive completion instead of delivery. Actual score-free arguments, causal input tensors, altered-future native payloads, clipping/selection and all three selected maps against identical whole-model tensors require native inspection. This audit intentionally inspected neither implementation nor run evidence. |
| Timers, source/hash provenance, fresh cost, shared-model lifecycle and reuse | K/S cases correctly sum declared service, including empty calls; reset state and cost fields agree. | Inputs stipulate service; they cannot prove timer boundaries include score compilation/reset, slicing/copies/waits/DSP/reduction/chain/finish exactly once, exclude reference comparisons, or keep shared loading separate without unloading on reset. Model/source/environment/runtime/graph/input/tensor/trace hashes, actual measured costs, reused offline @2 source/adapter/input/label/artifact identity, and diagnostic tolerance/bit reports need a separate independent adoption review. No microphone/UI/cold-start or fresh offline-cost claim follows. |
| Frozen listener behavior/refusals | Semantic null cases assert no dead-note conclusion. | Three-frame confirmation, monophonic/adjacent-pitch refusal, stay/skip transitions and acoustic attack recognition are listener behavior outside this hand timing oracle; no new capability follows from these agreements. |

This is not a demand to reproduce pinned DSP in a scalar oracle. It distinguishes
missing scalar fixture answers from the explicitly separate native-adoption review.
Question 37 combined both jobs, but the audit prompt authorizes the first and expressly
forbids the implementation/results access needed for the second. Record that boundary
and assign the remaining evidence review explicitly; do not silently waive it or call
this audit a review of 041's native evidence.

## Resolution and verdict

**90 agree, 0 disagree, 0 ambiguous.** All 51 seam-4 cases and 39 inherited samples
agree at their declared representation and precision. No oracle, contract, instrument,
implementation, report, result, ledger or gate was changed by this audit.

Question 37 is answered for the independent hand derivations. **Coverage and native
adoption adequacy remain incomplete.** The next numbered challenger resolution,
question 38, must address the uncovered scalar rules above with frozen/audited cases,
and explicitly arrange the independent native context/map/timer/provenance/prefix
review that this audit could not perform, before formal cursor judgment. All agreement
is not a stage pass, a promotion or permission to substitute author parity for that
review. This audit stops here; it runs no numbered experiment.

The audit is committed before the mandatory repository landing gate. That gate is
repository validation only, not audit evidence; no arithmetic or verdict may be revised
from its output. Any resulting issue belongs in a separate resolution record.
