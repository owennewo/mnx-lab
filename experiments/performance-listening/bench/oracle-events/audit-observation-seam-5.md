# Independent audit of observation-seam@5

2026-10-05 — **GPT-6-Astra (high) in Codex**.

## Scope, sources and independence

Question 40 requests the independent audit of the five cases frozen by experiment
042. No audit of this version and no other audit worktree existed at the start.
The definitions are [development contract 2](../../contracts/development-contract-2.md)
(including its compute-inclusive guitar amendment), [seam 5](../../contracts/observation-seam-5.md),
and its inherited [seam 4](../../contracts/observation-seam-4.md),
[seam 3](../../contracts/observation-seam-3.md), [seam 2](../../contracts/observation-seam-2.md)
and [seam 1](../../contracts/observation-seam-1.md). Later clarifications govern.
This audits the observation seam, not the separate, unchanged event evaluators.

The frozen SHA-256 values, checked against their freeze records, are:

| File | SHA-256 |
|---|---|
| [observation-seam-5.json](observation-seam-5.json) | `001fdee43d19ebb89bef83cecdcb0922c36669e7f21ce3f7f7ecd854c756e1de` |
| [observation-seam-4.json](observation-seam-4.json) | `f631324dd192d9c008d9e27336a09ce1385a130a367e85add6152b9ade8e0167` |
| [observation-seam-3.json](observation-seam-3.json) | `83f48b1c37199a58f4d646bffb9986fac21bd7f122f4d89296c9c53d3f8bd0dc` |
| [observation-seam-2.json](observation-seam-2.json) | `1a353ed0e56f4b2e3b765832c8b373d9147f02002238cab4efcc34d6fccddcac` |

Access disclosure: an initial broad `rg` over the research log inadvertently displayed
Findings-table summaries, including the author's seam-5 agreement claim. I then
restricted log reads to Current state and Open questions. I did not open an experiment
report, run record, implementation or test. The README and definitions themselves
also reveal some historical verdicts and example values. This is therefore independent
re-derivation, not a claim of complete blindness to prior agreement claims.

For the JSON files I first displayed only identifiers, operations and inputs, hiding
`expected`, `arithmetic` and other prose fields. I wrote all the derivations below to a scratch document before
opening expected answers or earlier audits. Small standard-library rational/IEEE-754
calculations were used as an arithmetic calculator; no evaluator, listener or test ran.
No case answer was obtained by executing the implementation. The comparison and
coverage sections were added afterward. Case labels below include the source version:
`5/S10`, for example. Precision is exact for integers/IDs/null/booleans and physical
float32 bits; time and rational comparisons use 1e-12 seconds.

## Case-by-case comparison

**95 cases: 95 agree, 0 disagree, 0 ambiguous.** Five are new; 90 sample inherited
rules (all36 seam-2 cases, all51 seam-4 cases, seam-3's abstract I3, and seam-1's
T3/T8). Times below are seconds. `f32:...` denotes exact physical bits. Coordinate
ranges use step256. Compact state rows refer to the complete arithmetic below;
every frozen field was compared, including counts, booleans and preserved payloads.

| Case | Rules exercised | My result | Oracle result | Verdict |
|---|---|---|---|---|
| 5/S10 | Pending neighbor, no finish flush, decision ownership/history, work | Before=after (M3,N1,pending1,ring1,next4800,watermark null); model0→0; F=[0,.0010625,.0030625]; work.003,ratio48; finish@.0030625/refersTo0; history2 immutable; continuation f32:41479e7a | Same state/counts, clocks, work/ratio, stamped decision and bits; all preservation checks true | agree |
| 5/S11 | Populated finish state, null watermark, stamps/history, cost | Before=after (M4803,N2206,pending1,ring2206,next9600,watermark2138); model1→1; F=[.02,.1450625,.1500625]; work.07,ratio1120/1601; finish@.1500625/refersTo.08; history3 immutable | Same; feed F=.14506249999999998 differs only below1e-12; preservation true, no frames/continuation | agree |
| 5/O19 | Safe integer length | reject2^53 | rejection true | agree |
| 5/O20 | Finite length | reject Infinity | rejection true | agree |
| 5/O21 | Finite length | reject NaN | rejection true | agree |
| 2/R0 | Empty prefix | N0 | 0 | agree |
| 2/R1 | Strict right index | N147 | 147 | agree |
| 2/R2 | Integral right neighbor arrived | N148 | 148 | agree |
| 2/R3 | Ordinary chunk | N221 | 221 | agree |
| 2/R4 | Cadence prefix | N2205 | 2205 | agree |
| 2/R5 | One-second prefix | N22050 | 22050 | agree |
| 2/R6 | Integral interpolation, zero right weight | exists; indices320/321; ramp value320 | true,320/321,320 | agree |
| 2/R7 | Integral interpolation, missing neighbor | absent | exists false | agree |
| 2/L1 | Negative filter, edge0, shared stamp | j163–171;q89–2137;D.1,F.145 | same9 coordinates;D.1,F.145 | agree |
| 2/L2 | Strict retained watermark | j163–171;q2294–4342;D.2,F.245 | same9 coordinates;D.2,F.245 | agree |
| 2/L3 | Edge15 with no eligible frame | empty;D.1,F.145 | empty;D.1,F.145 | agree |
| 2/L4 | Edge15 first frames | j155/156;q246/502;D.2,F.245 | same2 coordinates;D.2,F.245 | agree |
| 2/L5 | Edge15 later watermark | j148–156;q659–2707;D.3,F.345 | same9 coordinates;D.3,F.345 | agree |
| 2/L6 | Equality discarded, empty call cost | empty;D.2,F.25 | empty;D.2,F.25 | agree |
| 2/W1 | Pre-cadence boundary | false | false | agree |
| 2/W2 | Inclusive cadence boundary | true | true | agree |
| 2/W3 | Waiting | .099999 | .099999 | agree |
| 2/C1 | Serial production | .145 | .145 | agree |
| 2/C2 | Long service | .201 | .201 | agree |
| 2/C3 | Backlog | .30 | .30 | agree |
| 2/C4 | Idle gap | .24 | .24 | agree |
| 2/C5 | Setup backlog | .03 | .03 | agree |
| 2/C6 | Finish recurrence | .37 | .37 | agree |
| 2/C7 | Offline availability | 12 | 12 | agree |
| 2/P1 | Abstract largest activation | MIDI62,.9,pitched | MIDI62,.9,pitched | agree |
| 2/P2 | Abstract tie | MIDI60,.8,pitched | MIDI60,.8,pitched | agree |
| 2/P3 | Abstract inclusive threshold/low bin | MIDI21,.3,pitched | MIDI21,.3,pitched | agree |
| 2/P4 | Highest bin | MIDI108,.5,pitched | MIDI108,.5,pitched | agree |
| 2/P5 | Uncertain abstract reduction | null,.299,unpitched | null,.299,unpitched | agree |
| 2/O1 | Offline trim | keep5160/available5254/discard94 | 5160/5254/94 | agree |
| 2/O2 | Offline short trim | keep86/available142/discard56 | 86/142/56 | agree |
| 2/O3 | First stitched frame | w0/raw15;g=t=0 | w0/raw15;g=t=0 | agree |
| 2/O4 | First window join | w1/raw15;g36164/22050;t36352/22050;Δ188/22050 | same fractions | agree |
| 2/O5 | First decoder correction | w1/raw45;g43844/22050;t=g-.0018 | t438043100/220500000;Δ-.0018 | agree |
| 2/O6 | Repeated decoder correction | w2/raw75;g87688/22050;t=g-.0036 | t876086200/220500000;Δ-.0036 | agree |
| 2/O7 | Decode both endpoints | onset36352/22050;end43844/22050-.0018 | onset36352/22050;end438043100/220500000 | agree |
| 4/I1 | Minimal prefix | N0 | 0 | agree |
| 4/I2 | Minimal right neighbor | N1 | 1 | agree |
| 4/I3 | Physical fractional interpolation | f32:41479e7a | f32:41479e7a | agree |
| 4/I4 | Missing fractional neighbor | null | null | agree |
| 4/K1 | Inclusive cost gate/shared load | work.25,ratio.25,pass,shared.5 | .25,.25,true,.5 | agree |
| 4/K2 | Unrounded failing cost | work.250001,ratio.250001,fail,shared.5 | .250001,.250001,false,.5 | agree |
| 4/K3 | Audio denominator | work.25,ratio.125,pass,shared0 | .25,.125,true,0 | agree |
| 4/K4 | Zero-duration cost | reject | true | agree |
| 4/D1 | Overwrite madeAt, preserve refersTo | a@.145,refersTo.08 | a@.145,refersTo.08 | agree |
| 4/D2 | Future refersTo | reject | true | agree |
| 4/D3 | Negative refersTo | reject | true | agree |
| 4/F1 | Variable wall time excluded | equal | true | agree |
| 4/F2 | Payload equality | unequal | false | agree |
| 4/F3 | Delivery-index prefix | unequal | false | agree |
| 4/S1 | Irregular/missed cadence | [5000,20000,24000] | [5000,20000,24000] | agree |
| 4/S2 | Latest window eviction | start1,pad0,first1,last43844 | 1,0,1,43844 | agree |
| 4/S3 | Left padding | start-43842,pad43842,first0,last1 | -43842,43842,0,1 | agree |
| 4/S4 | Unpitched watermark | q89–2137 then2294–4342;watermark4342 | same coordinate arrays,4342 | agree |
| 4/S5 | Empty finish/setup/reset/history | F=[.02,.03,.035],calls0,work.035,ratio3.5;reset clock/work.003,otherwise fresh | same, unchanged history true | agree |
| 4/O8 | Fractional trim product/tail | windows1,keep86,tail17904 | 1,86,17904 | agree |
| 4/O9 | Busy offline lane | 13 | 13 | agree |
| 4/O10 | Long decoder axis | w36/raw63;g1314192/22050;t4380431/73500;Δ-209/73500 | w36/raw63;same g;t1314129300/22050000;Δ-6270/2205000 | agree |
| 4/O11 | Scheduling history, equal pad | leading3840/3840;scheduled false | 3840/3840,false | agree |
| 4/P6 | Physical .3 at bin39 | MIDI60,f32:3e99999a,pitched | same | agree |
| 4/E1 | Onset/MIDI ordering; preserve end/confidence | (.1,.2,60,.9),(.1,.3,62,.7),(.2,.4,64,.8) | same ordered events | agree |
| 4/E2 | Null semantics | unpitched;0 pitchless events;0 dead assertions | unpitched,0,0 | agree |
| 4/N1 | Toy normalization | [0,.5,1] | [0,.5,1] | agree |
| 4/N2 | Global maximum dependency | [0,.25,1] | [0,.25,1] | agree |
| 4/O12 | Irregular inference at equal pad | leading3840/3840;scheduled true | 3840/3840,true | agree |
| 4/P7 | Physical maximum | MIDI62,f32:3f666666,pitched | same | agree |
| 4/P8 | Physical tie | MIDI60,f32:3f4ccccd,pitched | same | agree |
| 4/P9 | Physical threshold/low bin | MIDI21,f32:3e99999a,pitched | same | agree |
| 4/P10 | Physical high bin | MIDI108,f32:3f000000,pitched | same | agree |
| 4/P11 | Physical subthreshold confidence | null,f32:3e991687,unpitched | same | agree |
| 4/N3 | Constant toy vector | [0,0,0] | [0,0,0] | agree |
| 4/S6 | Populated reset, empty-call cost | F=[.02,.145,.149,.154],calls1,work.074,ratio.74;reset clock/work.003,otherwise fresh | same, unchanged history true | agree |
| 4/S7 | Chunk/empty-chunk interpolation retention | N=[1,2,2,3];new bits[0],[41479e7a],[],[422e2650];retained[1,0,0,0];offset[2,4,4,6] | same counts, physical arrays, retention and offsets | agree |
| 4/S8 | Ring wrap/global coordinates | N44100,input0,ring43844,start256,first440b51da,last47bb7ee9;byte equality | same, byteEqual true | agree |
| 4/S9 | Pending neighbor reset | F=[0,.0010625,.0030625],calls0,work.003,ratio48;reset clock/work.003,otherwise fresh | same, unchanged history true | agree |
| 4/F4 | Prefix equality plus distinct valid clocks | equal;A[.145,.26],B[.3,.4] | true;A[.145,.26],B[.3,.4] | agree |
| 4/D4 | Nonfinite delivery | reject | true | agree |
| 4/D5 | Nonfinite service | reject | true | agree |
| 4/D6 | Nonfinite refersTo | reject | true | agree |
| 4/D7 | Nonfinite previous completion | reject | true | agree |
| 4/D8 | Start refersTo exactly0 | reject | true | agree |
| 4/O13 | Empty offline geometry | windows1,keep0,tail40004 | 1,0,40004 | agree |
| 4/O14 | Exact hop excludes next window | windows1,keep126,tail7680 | 1,126,7680 | agree |
| 4/O15 | Past hop includes next window | windows2,keep126,first tail7679 | 2,126,7679 | agree |
| 4/O16 | Negative offline length | reject | true | agree |
| 4/O17 | Fractional offline length | reject | true | agree |
| 4/O18 | Offline tensor construction | w0:start0,tail7679,nonzero3841–36164,values1–32324;w1:start36164,tail43843,nonzero0,value32324 | same two window records | agree |
| 3/I3 | Abstract pre-storage helper | 1834/147 | 1834/147 | agree |
| 1/T3 | Both edge coordinate gaps | edge0:21982/22050,gap68/22050;edge15:18142/22050,gap3908/22050 | .996916100/.003083900 and .822766440/.177233560 (9-place historical display) | agree |
| 1/T8 | Onset peak is not pitchless-event detection | no asserted pitchless onset/dead verdict | no asserted pitchless onset/dead verdict | agree |

T3 is compared at its historical nine-decimal display precision; its exact fractions
are the current-rule derivation. For all JSON timing cases the stated1e-12 applies.
S11's .14506249999999998 is within3e-17 of .1450625, so it is agreement, not a
float32 issue. R6's ramp convention was only visible when I subsequently read its
`arithmetic` field: x[k]=k gives320*1+321*0=320. Its existence/indices had already
been derived independently; that additional value derivation was not blind to the
expected field. S2/S3's ramp convention, assumed in my derivation, is also confirmed
by their fixture prose. This is a disclosure of fixture shorthand access, not a new
rule or an implementation-based answer.

## Derivations written before comparison

### General arithmetic

The two required input indices are k=floor(320j/147) and k+1. With M delivered
samples, k+1<M, equivalently j<147(M-1)/320. Thus N=0 for M<2, otherwise
N=ceil(147(M-1)/320). This remains strict even when the right weight is zero.
The live window starts at N-43844; frame coordinate q=N-43844+256j. Filter by
q>=0, q/22050<=D and q>watermark, in increasing j. Edge0 ends at171, edge15 at156.
Each whole call ends at F=max(D,Fprevious)+C, stamps all its returned emissions,
and has backlog F-D. Work is setup+every feed+finish; ratio=work/audio duration,
including empty calls and excluding separately reported shared loading.

### New 5/S10: pending interpolation and returned finish decision

Input [0,0,10] has M=3, D=3/48000=1/16000=.0000625 and
N=ceil(294/320)=1. Only output j0 exists; it equals zero. Next j1 has
p=320/147=2+26/147 and requires unavailable index3. Index2, value10, must remain
pending. Ring size1, generated1, delivered3, next cadence4800, watermark null;
the 43844-sample model window is entirely zero (one generated zero plus43843 pad).
No model call is scheduled. Finish cannot change any of these quantities or window
bits, cannot produce a frame, and cannot increment model calls. The returned
`finish` cursor is an explicitly supplied decision, not a new live model frame.

Setup completion is0. Feed completion=max(1/16000,0)+.001=.0010625.
Finish completion=max(1/16000,.0010625)+.002=.0030625.
Work=.003, duration=1/16000, ratio=.003*16000=48. Start's supplied madeAt=-1
is replaced by0; finish's supplied .001 is replaced by .0030625; both refersTo
remain0. Old history [start@0] stays identical; append [finish@.0030625]. Mutating
the returned decision must not mutate the stored clone.

Only after the finish snapshot, supplying [24] makes j1 exist:
10*(121/147)+24*(26/147)=1834/147=262/21. Binary32 spacing here is2^-20;
(262/21)*2^20=13082233+19/21, rounding upward to13082234/1048576,
bits `41479e7a`. This diagnostic continuation proves the pending10 survived;
it grants no permission to resume a finished listener.

### New 5/S11: populated ring/watermark and nonempty finish emission

M=4803, D=4803/48000=.1000625. N=ceil(4802*147/320)=ceil(2205.91875)=2206.
Last existing j2205 has p=4800 exactly and reads indices4800/4801, both0.
Next j2206 has p=4802+26/147 and lacks index4803. The sole nonzero input10
at4802 is pending; every generated sample and the entire padded window is zero.
Ring2206, generated2206, delivered4803, pending1. First cadence is reached once,
next=4800*(floor(4803/4800)+1)=9600. Window start=-41638.
Nonnegative edge0 frames j163..171 have q=90,346,602,858,1114,1370,1626,1882,2138:
nine frames. Their zero maps reduce to uncertain null, confidence0, and advance the
watermark to2138 nevertheless. All audio times q/22050 are below D.

Setup ends .02; feed ends max(.1000625,.02)+.045=.1450625; finish ends
max(.1000625,.1450625)+.005=.1500625. Work=.02+.045+.005=.07;
ratio=.07/(4803/48000)=3360/4803=1120/1601=.6995627732667083.
Start madeAt=.02, feed=.1450625, finish=.1500625; their refersTo are0,.08,.08.
Old [start,feed] history is unchanged, [finish] is appended as a clone, and mutating
the returned object cannot change it. Before/after finish: same generated2206,
ring2206, pending1, delivered4803, next9600, watermark2138, and all-zero window;
model calls stay1 and no new frames return. There is no continuation output.

### New 5/O19, O20, O21: reject before geometry

O19 supplies 9007199254740992=2^53, one above the largest safe integer2^53-1.
It is integral but unsafe: reject. O20's Infinity and O21's NaN are nonfinite,
so neither is a nonnegative safe integer: reject both. No padding, window count,
allocation or purported output length is reached.

### Inherited 2/R0–R7 and 4/I1–I4, 3/I3

R0: M0 gives N0. R1: M321 gives bound147, so j0..146, N147. R2: M322
gives bound147+147/320, so N148. R3: M480 gives bound70413/320=220.040625,
N221. R4: M4800 gives705453/320=2204.540625, N2205. R5: M48000 gives
7055853/320=22049.540625, N22050. For R6/R7, j147 gives p320, indices320/321,
weights1/0: exists at M322 (R6), absent at M321 (R7).

4/I1: one input has no right neighbor, N0. I2: two inputs permit j0, N1.
I3: p=2+26/147, both neighbors10/24 exist; pre-storage result1834/147,
physical result `41479e7a` as derived for S10. I4's M3 lacks index3, so no value.
3/I3 separately checks the abstract pre-storage helper:1834/147, not its binary32
rounding. That layer distinction is expressly inherited from seam4.

### Inherited 2/L1–L6, W1–W3, C1–C7 and 1/T3

L1: N2205, start=-41639; j163..171 yield q89,345,601,857,1113,1369,1625,
1881,2137 (9); F=max(.1,0)+.045=.145, watermark2137.
L2: N4410, start=-39434; strict q>2137 selects j163..171, q2294,2550,2806,
3062,3318,3574,3830,4086,4342 (9); F=max(.2,.145)+.045=.245.
L3: same N/start as L1 but j<=156 gives maximum q=-1703: no frames,
watermark remains null; F=.145. L4: N4410 with edge15 selects j155/156,
q246/502 (2), F=.245, watermark502. L5: N6615, start=-37229;
strict q>502 selects j148..156, q659,915,1171,1427,1683,1939,2195,2451,2707
(9); F=max(.3,.245)+.045=.345. L6 repeats L2's prefix with watermark4342,
so emits nothing; F=max(.2,.245)+.005=.250, watermark4342.
Every listed audioTime is q/22050; all frames in each nonempty batch share its F.

W1:4799<4800, no inference, next4800. W2:4800>=4800, infer once, next9600.
W3: .2-.100001=.099999 seconds waiting, not measured acoustic latency.
C1: F=.145, backlog.045. C2: F=.201, backlog.101. C3: F=.24+.06=.30,
backlog.10. C4: F=.2+.04=.24, backlog.04. C5: F=.02+.01=.03,
backlog.02. C6: F=.35+.02=.37, backlog.07. C7: F=10+2=12, backlog2.
Start S values respectively are .1,.1,.24,.2,.02,.35,10.

T3's M48000 gives N22050 and start=-21794. At j171, q=21982,
time21982/22050=.9969160997732426; gap68/22050=.00308390022675737.
At j156, q18142, time18142/22050=.8227664399092971;
gap3908/22050=.17723356009070295. These are nominal coordinates; availability
is not asserted to equal1 under the current compute-inclusive seam.

### Inherited pitch, null and ordering: 2/P1–P5, 4/P6–P11, E1–E2, 1/T8

2/P1–P5 explicitly operate on abstract binary64 activations: P1 picks bin41's.9,
MIDI62; P2's equal.8 picks lower bin39, MIDI60; P3 includes bin0 at.3, MIDI21;
P4 maps bin87's.5 to MIDI108; P5's maximum.299 is below threshold, so null with
confidence.299 and kind unpitched. The first four kinds are pitched.

4/P6 stores .3 as `3e99999a`=5033165/16777216>.3, yielding MIDI60 at bin39.
P7 picks physical .9=`3f666666`=7549747/8388608 at bin41, MIDI62.
P8's tied physical .8=`3f4ccccd`=13421773/16777216 picks bin39, MIDI60.
P9 includes physical .3=`3e99999a` at bin0, MIDI21. P10 physical .5=`3f000000`
gives MIDI108. P11 physical .299=`3e991687`=10032775/33554432<.3 gives null,
retaining that confidence. No abstract decimal is substituted for a physical sample.
For example, .9*2^24=15099494.4 rounds down to15099494; .8*2^24=13421772.8
rounds up; .299*2^25=10032775.168 rounds down. These yield the bits above.

E1 sorts [(.2,64),(.1,62),(.1,60)] to [(.1,60),(.1,62),(.2,64)], preserving
ends [.2,.3,.4] and confidences [.9,.7,.8]. E2's null reduction is uncertainty,
not a detected pitchless event; no dead verdict. T8 adds an onset-map peak to
subthreshold note bins: reduction still cannot assert a decoded pitchless onset or
dead note. No rule allows the peak to supply a missing pitch.

### Inherited 4/K1–K4, D1–D8 and F1–F4

K1: work=.02+.18+.04+.01=.25, divided by1 gives.25, inclusive pass;
shared load.5 separately. K2: work/ratio=.250001, fail without rounding.
K3: same.25 work divided by2=.125, pass, shared load0. K4: duration0 refuses
ratio; it does not make work free.

D1: F=max(.1,0)+.045=.145 overrides claimed.001; refersTo.08 is retained and
valid (0<=.08<=.1). D2: .11>.1 rejects. D3: -.01<0 rejects.
D4's NaN delivery, D5's NaN service, D6's infinite refersTo and D7's NaN previous
completion each reject on finiteness. D8's start refersTo.001 is not0: reject.
These guards constrain actual times, not an ignored backend madeAt that is overwritten.

F1: both records emit at4800, at the cutoff, with identical audioTime.05,
refersTo.08 and MIDI60. Different completion stamps.145/.6 are excluded: equal.
F2: retained MIDI60 versus62 differs: unequal. F3:4800 included versus4801 excluded:
one record versus none, unequal. F4: both records at4800/9600 included. Run A
completion max(.1,.02)+.045=.145 then max(.2,.145)+.06=.26. Run B gives
max(.1,.03)+.2=.3 then max(.2,.3)+.1=.4. Both ordered payloads a/b with
refersTo.08/.2 match; equal despite those different stamps. Each recurrence is valid.

### Inherited 4/S1–S9: schedule, window, watermark, lifecycle and eviction

S1, starting next4800:4799 does not run;5000 runs and sets9600;5001 does not;
20000 runs once (not once per crossed threshold), sets24000;20001 does not;
24000 runs once and sets28800. Run delivery indices [5000,20000,24000].
S2's43845 resampled ramp entries retain indices1..43844: start1, first1,
last43844, no pad. S3 has two resampled ramp entries [0,1], with43842 left zeros;
start=-43842, first0, last1. S4's zero maps advance watermarks2137 then4342,
with9 frames each, despite every frame being unpitched (L1/L2 arithmetic).

S5: setup.02 stamps start refersTo0 at.02. M480 implies D.01, N221, no
scheduled model call. Feed max(.01,.02)+.01=.03; finish max(.01,.03)+.005=.035.
Work.035/duration.01=3.5. Old start remains identical, no finish emission;
second setup.003 resets M,N,ring,pending,work/history/watermark/cadence/clock,
then leaves completion/work.003, next4800, watermark null, history empty.
No model call before or during finish.

S6: setup.02;4800 samples imply D.1,N2205, nine zero-map frames, watermark2137,
one model call, next9600. Feed F=.145; zero-length call at same D costs.004,
F=.149; finish costs.005, F=.154. Work=.02+.045+.004+.005=.074,
ratio.074/.1=.74. Start@.02/refersTo0 and feed@.145/refersTo.1 are unchanged.
Second setup.003 clears populated state and history, leaves completion/work.003,
next4800/null watermark, no retained ring/input. Finish makes no extra model call.

S7: chunks produce M3,4,4,6. At M3, j0=0 exists, N1, retain input[10] at global
index2, nextj1. At M4, j1=1834/147 stores `41479e7a`, N2; nextk4 has not arrived,
retain nothing, offset4. Empty chunk changes nothing. At M6, j2=4+52/147,
x4=40,x5=50, output40+10*52/147=6400/147. Binary32 stores713317/16384,
bits `422e2650`. N3, nextj3 needs k6/7; retain nothing, offset6. Counts generated
per call [1,1,0,1], physical new arrays [0],[41479e7a],[],[422e2650].

S8: M96000 yields N=ceil(95999*147/320)=ceil(44099.540625)=44100.
The ring retains43844 samples, global output indices256..44099. Next j44100
needs input96000/96001, neither delivered: no retained input neighbor, offset96000.
First ramp output81920/147 rounds to4565229/8192 (`440b51da`);
last14111680/147 rounds to12287721/128 (`47bb7ee9`). Window starts at output256.
At these magnitudes spacing is2^-14 and2^-7 respectively; scaled values round to
9130458 and12287721. Chunked versus one-prefix interpolation uses the same two
neighbors and arithmetic for every global j, so every window bit must agree.

S9: M3,N1 with pending input10 at2, no inference, next4800/null watermark.
Setup0, feed=max(3/48000,0)+.001=.0010625; finish=.0030625.
Work.003/duration(3/48000)=48; no history or finish emissions, no model calls.
Second setup.003 resets ring/pending/counts/history and leaves clock/work.003.
S9 only observes reset; the stronger no-flush snapshots are new S10/S11.

### Inherited offline cases: 2/O1–O7 and 4/O8–O18

O1:37*142=5254 stitched outputs; retain floor(1323000*86/22050)=5160;
discard94 at the tail. O2:142 stitched, retain86, discard56.
For an index i, w=floor(i/142), raw=15+(i mod142), nominal g=(256i-188w)/22050,
and upstream t=256i/22050-floor(i/172)*(188/22050+.0018).
2/O3: i0,w0,raw15,g=t=0. O4: i142,w1,raw15,g36164/22050,
t36352/22050, difference188/22050. O5: i172,w1,raw45,g43844/22050,
t43844/22050-.0018, difference-.0018. O6: i344,w2,raw75,g87688/22050,
t87688/22050-.0036, difference-.0036. O7 uses the O4/O5 upstream endpoints,
onset36352/22050, end43844/22050-.0018; duration7492/22050-.0018
=745231/2205000=.3379732426303855. Do not substitute nominal-grid times.

4/O8: L22100, total25940, one window, tail43844-25940=17904;
retain floor(1900600/22050)=86, discard142-86=56. O9: offline work queues
behind11 at clip end10, F=11+2=13, backlog3.
O10: i5160,w36,remainder48,raw63; correction count30. g1314192/22050;
t1315320/22050-.054=4380431/73500; t-g1128/22050-.054=-209/73500
=-.002843537414965986, demonstrating why a short-clip offset range is not universal.

O11/O12: M87084, N=ceil(87083*147/320)=ceil(40003.753125)=40004,
window start=-3840, padding equals offline first-window geometry. For O11,
M<next91200: unscheduled. For O12, M>=next86400: scheduled once, next91200.
Neither establishes HQ-versus-linear resampler parity.
O13: L0,total3840,ceil(3840/36164)=1 window,tail40004,keep0,discard142.
O14: L32324,total36164,one window (strictly-below rule),tail7680;
retain floor(2779864/22050)=126,discard16.
O15: L32325,total36165,two windows; tails43844-36165=7679 and
43844-1=43843;retain floor(2779950/22050)=126,discard284-126=158.
O16: L=-1 rejects negativity. O17:1.5 rejects non-integrality.

O18's explicit L32325 ramp is zero-padded by3840 at the beginning. First window
global start0: indices0..3839 pad; index3840 is input0=0; index3841 is1;
index36164 is input32324; indices36165..43843 are7679 tail zeros.
Second window global start36164: index0 is32324, indices1..43843 are43843 zeros.
This is exact geometry/float32 input (all integers here are exactly representable),
not evidence about the official HQ resampler.

### Inherited 4/N1–N3: toy normalization

N1: min0,max2 gives [0,.5,1]. N2: min0,max4 gives [0,.25,1], so a retained
log-power1 changes from.5 to.25 when a different sample changes the maximum.
N3: max=min=2, special constant-vector rule gives [0,0,0]. This demonstrates a
global dependency only; it does not implement or validate native NormalizedLog.

## Rules I could not exercise

After writing my derivations and comparing them with the frozen answers, I read only
[the uncovered-rules section of audit 4](audit-observation-seam-4.md#rules-i-could-not-exercise),
as an inherited coverage checklist. I did not open its arithmetic or verdict table,
or the separate implementation review. The current research log reports that native
review's outcome; this audit does not independently endorse it.

The two missing scalar obligations from that checklist now have observable answers:
S10/S11 preserve pending/ring/generated/cadence/watermark state and window bits across
finish, with nonempty stamped decisions and immutable appended history; O19–O21
refuse unsafe integral and nonfinite lengths. Neither change requires loosening a rule.
I found no remaining distinct scalar rule without an applicable frozen case in this
inherited set. This is rule coverage, not exhaustive enumeration of every invalid
input, float32 tie, chunk partition or backend implementation.

The following obligations remain **uncovered by this scalar audit**, not extra
agreements. They belong to the explicit native-adoption evidence boundary. Keep them
in the next numbered resolution's prerequisite check; in the current log that is
question39, with question38's separate native review referenced rather than rerun here.

| Rule or obligation | Scalar evidence checked | What the oracle cannot establish |
|---|---|---|
| Native normalization, ten-frame context and temporal slicing | N1–N3 specify only the toy formula; L/S give geometry and physical input examples | Native float32 log-power operation order and frequency/time extrema; sufficiency of ten frames; clipping/context suppression/right padding; all three cropped maps against the full pinned graph. No neural parity was computed here. |
| HQ resampling, official decoder, complete physical representation | O cases establish lengths, padded tensors and upstream timestamps; P cases establish note reductions; E cases ordering/null semantics | Actual HQ waveform output; full172x88/88/264 maps, ranges and serialization; decoder onset.5/frame.3/min11/inferred/Melodia behavior and source/model identity. Equal padding is not resampler equivalence. |
| Live chain delivery clock, score blindness, actual causal access/prefixes | D/F verify stipulated refersTo, serial clocks and synthetic prefix selection; S supplies causal interpolation examples | A real chain must use delivery rather than completion for support/refersTo, inference must see no score/labels/future audio, and native altered-future records must agree on selected payloads/tensors. |
| Fresh candidate-only timers, provenance, shared loading and reuse | K/S/finish cases sum given service, including setup/empty feeds/finish, and reset state; shared load stays separate | Given durations cannot certify timer boundaries, exclude diagnostic/reference work, establish actual costs or shared-model lifetime, or validate model/source/environment/runtime/graph/input/tensor/trace hashes and offline reuse. The independently reported timer attribution issue remains question39; these synthetic ratios neither resolve nor reproduce it. |
| Frozen listener behavior and acoustic interpretation | T3 gives coordinate gaps; T8/E2 distinguish uncertainty from an asserted pitchless onset | Actual three-frame confirmation, stay/skip behavior, monophonic/adjacent-pitch refusals and onset recognition; no new chord/dead-note capability, measured acoustic/device/UI delay or stage verdict follows. |

No listener or native backend is judged here. These boundaries do not call for new
scalar copies of pinned DSP, nor waive the independent native-adoption requirements.

## Resolution and verdict

**95 agree, 0 disagree, 0 ambiguous: all five new cases and 90 inherited checks.**
The frozen seam-5 scalar answers need no correction. Question40 is answered; the
finish-state/nonempty-finish-emission and safe-length gaps in question38 are closed.
The separately numbered timer-attribution resolution (question39) remains next before
a formal guitar-stage claim. No new numerical gate, oracle version, listener verdict,
ledger row or permission to use held-out evidence is supplied by this audit.

This completed arithmetic and verdict is committed before the mandatory repository
landing gate. That gate validates the documentation change only; any test output is
not audit evidence and must not be used to revise the committed derivation. Any issue
it uncovers belongs in a separate resolution record.
