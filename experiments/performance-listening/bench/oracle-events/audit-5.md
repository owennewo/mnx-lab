# Audit of event-oracle@5

Independent audit on 2026-10-06 by **GPT-6.1-Sol (high) in Codex**, a different
session and model from the oracle's author, Claude Opus 5.5 (high) in Claude Code.
Following [the audit brief](../../AUDITING_AN_ORACLE.md) and
[contract 2](../../contracts/development-contract-2.md#auditing-an-oracle).

**30 fresh cases: 30 agree, 0 disagree, 0 ambiguous.** This is agreement on the
frozen margin/selection/refusal cases, not a claim of complete inherited rule coverage
or a listener verdict. Remaining coverage obligations are listed below.

## Sources and independence

Audited [oracle-5.json](oracle-5.json), `event-oracle@5`, implementing
`stage-gates@3`. Its SHA-256 is
`de432ac584f04c051d3812cbbc9fd9467af2fdb5b5f1bfd62ae9800dc81842fb`, matching
[freeze-5.json](freeze-5.json). There was no prior audit of version 5 and no competing
worktree when this audit started. Version 5 adds 12 margin cases (G3 has two clocks),
10 selection cases and 8 refusal cases; all are freshly derived here.

Read the research log's Current state and Open questions by line range, without its
Findings table; root CLAUDE.md; contract 2 including its amendments; instruments 3,
4 and 5; the oracle README and freeze. Rules worked from:

| File | Version / SHA-256 | Scope |
|---|---|---|
| [event-instruments-5.md](../../contracts/event-instruments-5.md) | v5, `5659bf274c1e2d803dfe677cb947b8f1c4128f0d0ae8cdf1e24d3c8e4fb56de8` | candidate pool, guitar margin, severity, ordering, refusals and provisional record |
| [event-instruments-4.md](../../contracts/event-instruments-4.md) | v4, `979558c55f267a0c78bf5a366020568109891aaf6e4fea01431a97bf24c1f6dd` | inherited shorthand, refused binary/missing evidence, interval gate and procedural limits |
| [event-instruments-3.md](../../contracts/event-instruments-3.md) | v3, `e23580eb99305ff6f8095d3c0a2efd240e8185544fc0be6f70570f74e362d024` | normalised headroom, suite states, plans and retirement |
| [development-contract-2.md](../../contracts/development-contract-2.md) | contract 2 amended through 2026-10-06, `7bb4cf84d324cad63df3da6b3f16b2d245939551e687e2c949b29169e32f37d3` | approved budgets, compute-inclusive deadline, adopted severity rule and audit obligations |

For all 30 fresh cases I first displayed only the inputs, suppressing `expected`,
`reject` and `arithmetic`. I wrote my complete derivations and selections to
`/tmp/lab-oracle-5-independent-derivations.md` **before** displaying those answer
fields or opening [audit-4.md](audit-4.md). The arithmetic below preserves those
pre-comparison derivations. I then opened audit 4 to identify its uncovered rules and
inherited coverage. Audit 4's later provenance note is retained in that record; this
audit's derivations preceded reading any earlier audit.

No evaluator code (`bench/src/events/`), its tests, experiment report or run result was
read. JSON parsing and hashing only inspected frozen data; no evaluator, listener or
test ran during derivation. Dependency installation was preparation for the repository
gate, not audit evidence. The mandatory landing gate is run after committing this
completed audit; its output cannot change the arithmetic or verdicts.

## Fresh case verdicts

For selections, `P` is the ordered performance list and `C` the ordered control list.
Each of the 30 frozen records is one case, even where it has two output lists.

| Case | Rules exercised | My result | Oracle result | Verdict |
|---|---|---|---|---|
| G1-delay | delay, overall, interval, cost, fractions | 0.2 (second delay) | 0.2 | agree |
| G2-cost | cost beats delay and interval | 0.16 (sustained cost) | 0.16 | agree |
| G3a-p99-absent | guitar excludes p99 | 0.2 (second delay) | 0.2 | agree |
| G3b-p99-present | chunk-p99 stage retains p99 | 0.01 (p99) | 0.01 | agree |
| G4-control-cost | control applicability and cost | 0.44 (sustained cost) | 0.44 | agree |
| G5-control-rejection | rejection, exposure, episode | 0.4 (rejection) | 0.4 | agree |
| G6-episode | episode limit, no overall expectation | 0.1 (episode) | 0.1 | agree |
| G7-unreached | unreached event headroom | 0 (second delay) | 0 | agree |
| G8-failed-gate | binary evidence | refuse: failed gate | refuse | agree |
| G9-failed-prefix | every prefix must pass | refuse: failed prefix | refuse | agree |
| G10-no-prefix | mandatory prefix evidence | refuse: no prefix | refuse | agree |
| G11-late-event | negative headroom outside slack | refuse: delay headroom −0.05 | refuse | agree |
| K1-deviation-only | candidate filter; controls from all candidate parents | P [h-b, h-c, h-a]; C [sil-h-d, w2-h-d] | same ordered P and C | agree |
| K2-pause-then-tempo | pause then slower tempo; margin before severity | P [h-s1-45-2000, h-s1-90-2000, h-s1-63-700]; C [sil-h-s1-45-2000, w2-h-s1-90-300] | same ordered P and C | agree |
| K3-base-tempo | clean base pool; slower tempo; both performed scores | P [s2-99, s1-45, s1-63]; C [sil-s1-45, w2-s1-90, sil-s2-45, w2-s2-99] | same ordered P and C | agree |
| K4-margin-beats-severity | margin first; severity second for performances/controls | P [h-x, h-y, h-w]; C [sil-h-y, w2-h-y] | same ordered P and C | agree |
| K5-name-last | pooled guitars; ASCII ID last | P [fender-h-s1-45-2000, martin-h-s1-45-2000, spanish-h-s1-45-2000]; C [noise-fender-h-s1-45-2000, w2-martin-h-s1-45-2000] | same ordered P and C | agree |
| K6-slowed-bar | double-precision extremity then tempo; parent severity | P [sb-s2-99-b2-50, sb-s2-45-b2-70, sb-s2-90-b2-70]; C [sil-sb-s2-99-b2-50, w2-sb-s2-99-b2-50] | same ordered P and C | agree |
| K7-rushed-bar | extremity then tempo; control margin first | P [rb-d, rb-b, rb-c]; C [sil-rb-a, w2-rb-d] | same ordered P and C | agree |
| K8-fewer-every-score | fewer than three; score order; kind order | P [h-s1, h-s2]; C [sil-h-s1, w2-h-s1, sil-h-s2, w2-h-s2] | same ordered P and C | agree |
| K9-input-order | input-order independence | P [h-s1-45-2000, h-s1-90-2000, h-s1-63-700]; C [sil-h-s1-45-2000, w2-h-s1-90-300] | same ordered P and C | agree |
| K10-parent-score | performed score through parent | P [h-p]; C [sil-h-p, w2-h-p] | same ordered P and C | agree |
| Z1-undefined-severity | severity must be defined | refuse: wrong-note has no row | refuse | agree |
| Z2-missing-field | all candidates require severity fields | refuse: missing pause | refuse | agree |
| Z3-no-candidate | nonempty filtered performance pool | refuse: zero candidates | refuse | agree |
| Z4-absent-parent | parent must be evaluated | refuse: h-gone absent | refuse | agree |
| Z5-missing-kind | candidate controls of both kinds per score | refuse: zero candidate wrong-score controls | refuse | agree |
| Z6-duplicate | IDs unique across performances/controls | refuse: h-a occurs twice | refuse | agree |
| Z7-negative-margin | margin nonnegative | refuse: −0.1 | refuse | agree |
| Z8-nonfinite-margin | margin finite | refuse: NaN | refuse | agree |

## Arithmetic for each fresh case

All times are seconds, p99 is milliseconds, tempo is quarters/minute. Headrooms are
unitless. The arithmetic is shown as exact decimal/rational expressions where possible;
the frozen comparison tolerance is 1e-12. Selection margin ties are **exact double
equality**, not that comparison tolerance. Factor subtractions below explicitly retain
their double-precision values. Positive roundoff does not change any limiting entry.


### G1

binary/prefix=1. onEvent=(1-.95)/.05=1; ahead=1;
exposure=1; episode=1; delays=(.2-.11)/.2=.45 and (.2-.16)/.2=.2;
overall=(.05-.01)/.05=.8; interval budget=max(.1*1.2,.03)=.12,
headroom=(.12-.03)/.12=.75; sustained=(.25-.15)/.25=.4.
minimum .2, limiting delay index1.

### G2

binary/prefix=1; onEvent=(.99-.95)/.05=.8; ahead/exposure/episode=1;
delays=.4,.25; overall=1; interval budget=.06, headroom=(.06-.02)/.06=2/3;
sustained=(.25-.21)/.25=.16. minimum .16, cost.

### G3a

G1 entries; p99=9.9 ignored under compute-inclusive. minimum .2 delay1.

### G3b

G1 entries plus p99=(10-9.9)/10=.01. minimum .01 p99.

### G4

control has rejection=(1-.95)/.05=1, exposure=1, episode=1,
binary/prefix=1, cost=(.25-.14)/.25=.44. No performance entries. min .44 cost.

### G5

rejection=(.97-.95)/.05=.4; exposure=(.05-.01)/.05=.8;
episode=(.5-.1)/.5=.8; sustained=(.25-.05)/.25=.8; binary/prefix=1.
minimum .4 rejection.

### G6

onEvent=(.98-.95)/.05=.6; ahead=(.01-.002)/.01=.8;
exposure=(.05-.02)/.05=.6; episode=(.5-.45)/.5=.1;
delay=(.2-.05)/.2=.75; cost=(.25-.1)/.25=.6; binary/prefix=1.
No expected overall and no intervals: omit those. min .1 episode.

### G7

same perfect fractions and binary/prefix1; cost=.6;
first delay=.75 and null second delay0. overall1; no intervals. min0 delay1.
Read gates=true as supplied aggregate evidence: unreached event is permitted
when by-event fraction passes (>=20 answerable events). Case does not derive gate
pass from the short illustrative delay list; instruments3 explicitly retains0
headroom even when by-event fraction permits omission.

### G8

refuse, gates=false; otherwise G1 numeric headrooms.

### G9

refuse, prefix [true,false]; otherwise G1 numeric headrooms.

### G10

refuse, prefix length0, explicit mandatory evidence rule; otherwise G1.

### G11

second delay=(.2-.21)/.2=-.05 < -1e-12; refuse despite gates=true.

For selections, P=top3 performance order, C=silence then wrong-score per score,
not restricted to selected top3 parents. Candidate counts exclude controls.

### K1

candidates h-a (.3,(.3,-90)), h-b (.2,(2,-45)),
h-c (.25,(.5,-63)), h-d (.4,(1,-99)); clean p-s2-45 and its controls excluded.
P=[h-b,h-c,h-a], count4. silence margins h-d .1<a .5<b .6<c .9;
wrong margins h-d .2<b .3<a .7<c .9. C=[sil-h-d,w2-h-d].

### K2

equal .25 margins. Severity descending (2,-45)>(2,-90)>(.7,-63)>
(.3,-45)>(.3,-90). P=[h-s1-45-2000,h-s1-90-2000,h-s1-63-700], count5.
Silence all .5 gives sil-h-s1-45-2000. Wrong h-s1-90-300 .4 beats .5,
so C=[sil-h-s1-45-2000,w2-h-s1-90-300].

### K3

exclude hesitation .01; candidates6. s2-99 .1 first; equal s1 .3
severity (-45)>(-63)>(-90)>(-99); s2-45 .5 last.
P=[s2-99,s1-45,s1-63]. Scores s1 then s2.
s1 silence equal .6 chooses45; wrong .45 at90 beats .5 at63.
s2 silence equal .7 chooses45; wrong .2 at99 beats .8 at45.
C=[sil-s1-45,w2-s1-90,sil-s2-45,w2-s2-99].

### K4

h-x .1 first regardless of weak (.3,-99); equal .2 ranks
h-y (2,-45)>h-w (2,-63)>h-z (1,-45).
P=[h-x,h-y,h-w], count4. All control margins .9; max parent severity h-y.
C=[sil-h-y,w2-h-y].

### K5

all .25 and (2,-45); ASCII fender<martin<spanish<tonejs-acoustic.
P=[fender-h-s1-45-2000,martin-h-s1-45-2000,spanish-h-s1-45-2000], count4.
Silence equal .5: noise-fender before noise-martin. Wrong martin .4<fender .5.
C=[noise-fender-h-s1-45-2000,w2-martin-h-s1-45-2000].

### K6

all .3; extremities |.9-1|=.09999999999999998,
|.5-1|=.5, |.7-1|=.30000000000000004 (both records).
Severity (.5,-99)>(.30000000000000004,-45)>
(.30000000000000004,-90)>(.09999999999999998,-45).
P=[sb-s2-99-b2-50,sb-s2-45-b2-70,sb-s2-90-b2-70], count4.
Controls all .5: choose parent .5 extremity.
C=[sil-sb-s2-99-b2-50,w2-sb-s2-99-b2-50].

### K7

all .2; |1.05-1|=.050000000000000044;
|1.3-1|=.30000000000000004; |1.15-1|=.1499999999999999.
Severity d (.30000000000000004,-45)>b (.30000000000000004,-99)>
c (.1499999999999999,-45)>a (.050000000000000044,-99).
P=[rb-d,rb-b,rb-c], count4. silence rb-a .3 beats .6 others;
wrong all .6 chooses d by severity. C=[sil-rb-a,w2-rb-d].

### K8

two candidates; margins .2<.4: P=[h-s1,h-s2], count2.
Scores s1<s2; each has exactly one each kind.
C=[sil-h-s1,w2-h-s1,sil-h-s2,w2-h-s2].

### K9

K2 same input records in reverse order; own comparator orders again
(2,-45)>(2,-90)>(.7,-63)>(.3,-45)>(.3,-90).
P=[h-s1-45-2000,h-s1-90-2000,h-s1-63-700], count5;
C=[sil-h-s1-45-2000,w2-h-s1-90-300].

### K10

one candidate h-p, severity(1,-90), margin .2, score s1.
P=[h-p], count1; C=[sil-h-p,w2-h-p]. Wrong handed w2 does not add score w2.


### Z1

refuse; wrong-note deviation has no severity rule.

### Z2

refuse; h-b is candidate but lacks pause, so (pause,-90) undefined.

### Z3

refuse; clean s1-90 is excluded, count0.

### Z4

refuse; w2-h-gone parent h-gone absent from evaluated performances,
even though other controls are complete and this margin .1 is smallest.

### Z5

refuse; only h-a candidate; clean parent s1-90 and its wrong control excluded,
so candidate s1 controls have silence1, wrong0.

### Z6

refuse; performance h-a and wrong-score control h-a duplicate IDs (count2).

### Z7

refuse; margin -.1 is negative.

### Z8

refuse; NaN shorthand not a finite numeric margin.


## Inherited audited coverage

This table is **reused coverage, not fresh derivation**, and is not included in the
30-case count. Oracle 4 and oracle 2 bytes, and instruments 3 and 4 bytes, were checked
against commit `f68858784ca50ed3505a583f5dd2b6ff9093ecb7`, which first landed audit 4:
all are unchanged. The oracle hashes also match their freeze records.

| Frozen source / SHA-256 | Reused rules and cases | Prior audit / verdict | Basis for reuse |
|---|---|---|---|
| oracle-4.json, `6fe74176cc66daeec5fccd3e07c0c8cb84051293fedd78a6b3641fb628103c02` | B1–B15, R1–R8, P1–P4: bar references, eligibility, flags, reports and pools | [audit 4](audit-4.md#verdicts): agree | no assessment rule or input/answer changed |
| same oracle 4 hash | S1–S13, E-* required evidence, retirement cases, T1–T5 plans | [audit 4](audit-4.md#s1s13-and-e-): agree | suite states, retirement and run plans explicitly unchanged in instruments 5 |
| same oracle 4 hash | individual headrooms, M-negative/M-nonfinite, I1–I4, X1–X7 | [audit 4](audit-4.md#headroom): agree | headroom budgets, 30 ms floor, 1e-12 clamp and zero-answerable refusal unchanged; fresh G cases check their guitar composition |
| same oracle 4 hash | C2-every-score: controls for a performed score absent from top three | [audit 4](audit-4.md#selection-c1c8): agree | every candidate score still requires both kinds, independent of selected top three; K1 additionally exercises an unselected parent |
| oracle-2.json, `e29ba389170181cffdf6f67fd51052f5ca58709927a1767e42819ccf3f157a2c` | unchanged following, note and control semantics, as sampled and enumerated in audit 4 | [audit 4](audit-4.md#inherited-following-samples) and its cited [audit 2](audit-2.md) coverage: agree | neither following-evaluator@2 nor these note/control rules changed; prior clarification remains part of the definitions |

Audit 4's S13 wording concern remains: an attempted formerly passed substage whose
own evidence fails is open under contract 2's definition of passed; the instruments'
transition list could say this explicitly. There is no new state composition here;
the checked-in S13 and its rule text are unchanged, so its prior verdict is inherited,
not counted as a fresh agreement. Audit 4's binary-headroom wording tension is resolved
for this version explicitly: instruments 5 says refuse, rather than contribute 0, and
G8–G10 freshly agree with that rule.

## Rules I could not exercise

No new numerical rule of instruments 5 lacks a case: its pool, margin, severity,
ordering and refusal rules are exercised above. That does **not** fill inherited gaps.
I read audit 4 only after writing all fresh derivations and checked each of its listed
gaps against the current frozen cases. Their disposition is:

| Rule / obligation | Coverage disposition and why |
|---|---|
| By-event gate on 20 or more distinguishable events (95% suffices), composed with unreached-event headroom | **Uncovered end-to-end**, carried from audit 4. G7 freezes the supplied passing `gates=true` and the margin for an unreached event; it supplies no count or decision record establishing the 95% gate. X2 had the same limitation. Neither is an oracle for that gate. Freeze and audit a count-bearing case before a listener is judged using the ≥20 allowance. |
| A flag on a bar whose ratio is null | **Uncovered**, carried from audit 4. The null-reference/null-ratio cases have no such reported flag; oracle 5 has no assessment cases. Freeze and audit this before relying on that finding rule. |
| A flag on a bar the score does not have | **Uncovered**, carried from audit 4. Current report cases do not exercise unplaced bar flags; oracle 5 adds none. Freeze and audit before relying on that finding rule. |
| Rechoose only at a full sweep; a failing sentinel reopens rather than being replaced | **Uncovered selection-lifecycle composition**, carried from audit 4. States pin reopening and G/K cases pin stateless margins/selection; none freezes before/after sentinel identities. A later numbered resolution must freeze the lifecycle case before claiming that property from oracle agreement. |
| Retirement record date/evidence/replacement; hash reuse; baseline policy | **Procedural**, carried from audit 4. Instruments 4 assigns structural checks against historical records; instruments 5 keeps these outside hand arithmetic. Not read or validated as audit evidence here, and not granted agreement. Guitar baselines follow the amendments (stage-1 clean sweep evidence cited by hash for routine reuse), rather than an unqualified historical sine policy. |
| Historical bootstrap keeps old verdict with revalidation pending; time budget | **Procedural**, carried from audit 4, no frozen numerical case. Historical bootstrap is not the new guitar selection; the five-minute routine target is not measured by this audit. |
| New guitar suite-record fields, artifact provenance, full-sweep source and provisional-to-in-force recording | **Procedural**, instruments 5 explicitly assigns structural checks to the writer, not a hand case. No suite record or run evidence was inspected here. This audit agrees with the supplied arithmetic, but does not verify the private artifact hashes, selection from a passing sweep, or activation. |

These are coverage limits, not additional disagreement/ambiguity cases and not passing
implementation tests substituted for oracles. Carry them to the next numbered
instrument-resolution question (research-log question 61), before listener judgment
that depends on them. They do not change the 30 answers or assert that the s1/s2
sentinel selection has used the ≥20-event or bar-flag rules.

## Verdict and boundary

**30 fresh cases agreed, 0 disagreed, 0 ambiguous:** 12 margins (8 numerical answers,
4 refusals), 10 ordered selections and 8 chooser refusals. Agreement satisfies the
version-5 oracle audit condition; the existing suite record's activation and audit
path/hash are the record writer's separate obligation. This audit changes only this
file, the research-log audit question/current state and the oracle README entry.
No oracle, instrument, contract, suite record, code or experiment ledger row changes.
No listener or timing evaluation is authorized or performed by this audit.

Model and tool: **GPT-6.1-Sol (high) in Codex**.
