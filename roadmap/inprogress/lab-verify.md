# lab-verify — the standing verification ledger

> **Status: STANDING — opened 2026-08-22. This doc does not move to `complete/`.**
> It is a living contract plus a debt register, not a work item. It closes only if the
> corpus stops being verified by hand.

Every other roadmap doc describes something that gets built and then stops. This one
describes an obligation that never stops, because `verified` is a **human assertion** and
code lands faster than a human can look at it.

## Why it exists

Verification is the one gate an agent cannot pass on its own. `npm run update:primitives`
demotes `verified` → `rendered` the moment a golden moves, which is correct — but it means
any change to `model/`, `engine/` or `scenarios/` leaves a pile of scenarios waiting on
someone's eyes, and the work item that caused the pile cannot honestly call itself done
while the pile stands.

The result was a coupling nobody chose:
[core-ink-measured-gaps.md](../complete/core-ink-measured-gaps.md) had all four of its
stages built and still said stage D was "taken only once A–C are verified, on their
evidence" — the engineering finished, the doc pinned open by 33 scenarios nobody had
reviewed. [core-ragged-last.md](../complete/core-ragged-last.md) was blunter still:
*"BUILT, awaiting the `/verify` sweep"* was its entire remainder. Worse, two
spec-conformance fixes (`fab5a85`, `ff5ae78`) moved goldens without an owning roadmap
doc at all, so their debt was recorded nowhere but the queue.

Both items closed on 2026-08-22 the day this ledger opened, owing nothing but the
approvals below — which is the ledger working as intended, on its first day.

This doc decouples the two. **An item may reach `complete/` owing verification, provided
the debt is registered here with its cause.** The build work and the looking are separate
kinds of work with separate rhythms; the only thing they must share is a ledger.

## What this is not

**It is not the queue.** The queue is derived from committed provenance and is always
current:

```bash
npm run verify:scenarios -- --list          # blocked → stale → never-seen; current counted
npm run verify:scenarios -- --list --json   # the same, machine-readable
```

Never hand-copy per-scenario status into this file. A checked-in table of 107 scenarios is
wrong the next time anyone runs `update:primitives`, and a stale ledger is worse than no
ledger. What the queue **cannot** record — and what belongs here — is *why* a batch went
stale, *who* owes it, and *what a reviewer should be looking at* when they open the page.

Provenance answers "did this change?". This doc answers "should it have?".

## The handoff contract

1. **A work item may close with verification outstanding.** Landing the code and earning
   the approvals are separate obligations. Do not hold a doc in `inprogress/` for want of a
   human's eyes.
2. **Closing with debt requires registering a batch here** — in *Open debt* below, before
   the doc moves to `complete/`. The register entry states: the cause (roadmap doc and/or
   commit), the scenario set, which goldens moved, and **what a reviewer should look for**.
   That last field is the whole point: the person approving six months from now did not
   write the change, and "the primitives hash moved" tells them nothing.
3. **The closing doc names the batch; the batch names the closing doc.** Two-way link, so
   neither half can be found without the other.
4. **Debt with no owning roadmap doc is registered here directly.** A standalone
   conformance fix that moves goldens still owes the corpus a look — `fab5a85` is the
   worked example, and it is in the register below precisely because it had nowhere else
   to go.
5. **Registration is not pre-approval.** Writing an entry records that a change is
   *expected* to have moved the output. It does not assert the new output is right. Only
   `harness/verify/verify-scenarios.mjs`, driven by the **`/verify`** skill with a human in
   the loop, may write `status: verified` or a `verification` record. Never hand-edit
   either — that forges a human assertion, and the rule holds identically when resolving a
   rebase conflict.
6. **A batch is retired only when its scenarios leave the queue.** Move the entry to
   *Settled* with the sweep's date and anything the review taught. If the review **rejects**
   the output, the batch stays open and the finding goes to its own roadmap item — never
   approve to clear a row.
7. **Sweeps are batch-shaped, not scenario-shaped.** Review a whole cause at once: the
   scenarios in a batch moved for one reason, so a reviewer who has understood the reason
   once can spend the rest of the sweep checking whether each scenario obeys it.

## Open debt

*Counts below are the queue as of 2026-08-22 (0 blocked, 37 stale, 8 never-seen, 62
current). Batches are grouped by cause; the commit named for each sub-set is the one that
**last moved** those goldens, which is not always the one that demoted them.*

### 1. `core-ink-measured-gaps` — vertical distance measured ink to ink — **33 stale**

Owner: [core-ink-measured-gaps.md](../complete/core-ink-measured-gaps.md) (stages A–D all
built 2026-08-21; **closed 2026-08-22 owing these approvals**). This is the doc the
ledger exists to unpin, and it is unpinned.

**Second owner, same batch:** [core-ragged-last.md](../complete/core-ragged-last.md)
(`7ebcdab`, also closed 2026-08-22) demoted `lab/document/navigation-playground`,
`lab/durations/rest-gallery` and `spec/tie-targets`. Stage D (`018073d`) then moved
those same three goldens again, so the table below files them under stage D by the
last-moved rule. **A reviewer approving those three settles both items at once** — and
must read both rationales: the last system should sit at its page's texture *and* the
gap above it should be ink-measured.

| Sub-set | Last moved by | Scenarios |
|---|---|---|
| Stage A — score text placed one clearance above the ink under it | `da6534c` | 5 — `spec/tempo-markings`, `lab/score-text/{rehearsal-marks, sections, sections-with-rehearsal-marks, labels-with-navigation}` |
| Stage C — every display gap ink-measured via the probe pass | `ddbf5d7` | 6 — `spec/{grand-staff, organ-layout, parts}`, `lab/score-text/{directions-across-parts, directions-multi-staff}`, `lab/layout/group-barline-individual` |
| Stage D — inter-system gaps ink-measured too | `018073d` | 9 — `spec/{multimeasure-rests, multiple-layouts, orchestral-layout, system-layouts, tie-targets}`, `lab/document/{navigation-playground, twelve-bar-blues}`, `lab/durations/rest-gallery`, `lab/dynamics/all-dynamic-marks` |
| Tab row pads 4/4 → 2/2 → 3/3 | `3393bd3` → `f42230d` | 13 — `lab/document/empty-tab-canvas`, `lab/tab-part/standard-tuning-both`, `lab/tab-positions/open-strings-chord`, all 10 of `lab/tab-derivation/*` |

**What a reviewer should look for.** The claim under test is that *nothing collides and
nothing floats* — the same two clearance constants everywhere: cohesion (a label to its own
staff, ≈1sp) and separation (staff to staff, system to system, ≈3sp). Concretely:

- **Stage A**: a section or rehearsal label sits one clearance above the tallest ink
  actually beneath its footprint — not above a geometric staff line. It must not crowd a
  treble stem, and must not float over a stemless tab staff.
- **Stage C/D**: gaps between staves and between systems track the ink, so a sparse system
  closes up and a busy one opens out. Uneven row pitch down a page is the *expected*
  outcome here, not a bug — check that each gap is justified by what is in it.
- **Tab pads**: 6sp between bare tab systems. The tuning was settled by eye (4/4 read as
  abandoned, 2/2 as crowded), so this sub-set is the one most worth disagreeing with.
  `tightenRows` still widens any row whose ink overruns the pad — a collision here is a
  bug, not a taste question.

Both goldens (`expected.both.svg`) moved for the tab sub-set. Approving stamps a hash per
golden, so **every projection a scenario pins must actually be looked at** — notation, tab
and both.

### 2. Barline defaults — **4 stale**, no owning roadmap doc

Cause: `fab5a85` (2026-08-15), "The barline stops being a fact about position and becomes
one the document states". The old code drew thin-unless-last and never read
`measure-global.barline`, inverting the spec's "if not provided" clause — the default was
applied even when the document had spoken.

Scenarios: `spec/{hello-world, three-note-chord-and-half-rest, two-bar-c-major-scale,
measure-repeats}`.

**What a reviewer should look for.** All four are spec-mirrored, so the CG's reference
engraving in the compare pane is the verdict, not a matter of taste. The first three
declare `regular` and should draw a plain barline where we previously drew thin+thick;
`measure-repeats` declares `double` at bar 4 and should draw a double barline where we
previously drew a plain thin line. If our render and the reference disagree, the render is
wrong.

### 3. Never reviewed since authoring — **8 never-seen**

| Cause | Scenarios |
|---|---|
| `75e566b` (2026-08-10) — corpus closure, nine new lab categories | 7 — `lab/tab-fingering/{left-hand-fingers, right-hand-pima}`, `lab/tab-techniques/{bend-and-release, slides, hammer-pull-chain, vibrato-and-palm-mute, natural-harmonics}` |
| `ff5ae78` (2026-08-15) — score-wide marks stop belonging to the notation staff | 1 — `lab/score-text/labels-on-a-tab-staff` |

**What a reviewer should look for.** These have no approved hash at all, so there is no
diff to reason from — this is a first reading, and the question is the ordinary one: does
the engraving say what the scenario's `description` claims it says? The technique set is
the most likely to surface renderer gaps rather than regressions (bends are curves of
`{position, alter}` in semitones; harmonics, slides and palm mute each have their own
notation), and an amber renderer-gap badge is a legitimate thing to approve — the golden
pins what we draw today, including that we do not yet draw something.

## Settled

*Entries move here from* Open debt *when their scenarios leave the queue. Format: date of
the sweep, the batch, the counts, and anything the review taught that the next sweep should
know.*

- **2026-07-17 — the initial 57/57 sweep.** Predates this ledger; recorded in
  [lab-spec-approval.md](../complete/lab-spec-approval.md), which remains the recipe for
  verifying a renderer feature.

## Running a sweep

Drive it through the **`/verify`** skill — the conversational approval loop
(`.claude/skills/verify/`). It builds the queue, publishes one stable side-by-side review
page (our render, the spec's reference engraving where one exists, and a what-changed note
for stale items), takes verdicts as ordinary sentences, and records them through the
harness script. There is no human-facing CLI and no checkbox page, by design.

Point the sweep at a batch from the register rather than at the raw queue, and read that
batch's *what a reviewer should look for* first. When the sweep ends, update this file:
retire what settled, and adjust the counts in *Open debt* with the date you took them.
