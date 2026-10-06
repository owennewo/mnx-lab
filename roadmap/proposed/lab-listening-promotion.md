# Promote the Basic Pitch listener, then make the listening loop fast

**Status: proposed 2026-10-06, awaiting the user's decision.** Written at the user's request
by Claude Opus 5.5 in Claude Code, the parent session of the listening batches 037–051. Nothing
here is adopted until the user says so; on adoption, step 1 records their words in
[development contract 2](../../experiments/performance-listening/contracts/development-contract-2.md),
as every earlier amendment did.

The user, after 051:

> I kind of feel its obvious that this is going to be promoted - and I also feel that the
> tests are taking a long time.  We've been at this for over 2hrs!
> Thoughts - keep me honest

## Why promote now

The contract's promotion rule
([2026-10-04 amendment, decision 5](../../experiments/performance-listening/contracts/development-contract-2.md#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule))
has three conditions, and all three are met:

| Condition | Evidence | Result |
|---|---|---|
| (a) The challenger passes guitar stage 1 and silent hesitation on all four development guitars | [050](../../experiments/performance-listening/reports/050-challenger-optimized-stage.md), `basic-pitch-chain@5-note-output`, quiet host | 576/576 on cursor, assessment and cost; lag median 109 ms, max 163 ms; cost max .200 |
| (b) The incumbent fails the same examples | 036, 043, 045, 050 | event-chain@3 passes no guitar performance cursor; 10/192 performance assessments |
| (c) One-shot held-out confirmation | [051](../../experiments/performance-listening/reports/051-challenger-heldout-confirmation.md), three untouched guitars, criterion fixed before rendering | 432/432; lag max 185 ms; cost max .164 |

The two remaining pre-promotion steps don't bear on the choice of listener. The **sentinel
instrument** (question 43) decides which examples a routine run repeats: a speed tool. The
**outside review** was to check the evidence and the process. The evidence has had two
process reviews (R12, R13), the 041 implementation review and five seam audits. What an
outside review would still add is a verdict on whether the process has grown too heavy,
which needn't gate promotion. So this plan **decouples both from promotion, on the record**
rather than dropping them quietly.

## What promotion claims, and what it doesn't

It claims: on sampled guitar (four development and three held-out sample sets), on the two
short single-note scores s1 and s2, perfect and with one silent hesitation, the Basic Pitch
listener follows and assesses the playing within the approved gates, and the incumbent
can't, on this host.

It does not settle, and the next work has to:

- **Lag margin on real devices.** 185 ms against a 200 ms gate on `shinyguitar`, on an i7,
  before microphone, audio-driver, browser and UI delay.
- **The unexplained stalls.** 043 and 045 had 280–340 ms stalls on feeds with no inference;
  traced runs (044, 046) never did; 050 had a 270 ms backlog that missed every event.
- **Chords.** The Martin repair (039) keeps only each frame's strongest pitch, which cannot
  carry into stage 3's chords.
- **Real playing**: microphones, rooms, timing as a person plays.

## The plan

### 1. Promote (one parent session, no experiment)

- Record the user's decision as a third amendment to contract 2: promotion on 050 and 051;
  decision 7's sentinel selection and outside review decoupled from promotion (step 3 and
  step 5 below).
- `basic-pitch-chain@5-note-output` becomes the incumbent. `event-chain@3` freezes as a
  comparator and is never developed further. The two tracks become one again.
- **No post-promotion sweep.** 050 and 051 are complete sweeps of exactly this listener on
  every guitar example; the new incumbent's suite record cites them by hash.
- Research log: current state, the suite states (guitar stage 1 and silent hesitation
  passed), the open questions re-ranked for the next direction.

### 2. A routine run takes minutes, not an hour

Today a formal claim reruns everything: 576 challenger examples, the incumbent on all 576,
four frozen baselines, 1,200–1,600 prefix checks, under the quiet-host rule. 043, 045, 046,
050 and 051 took 16 to 50 minutes each. From promotion on:

- **Routine runs** evaluate the substage being attempted plus the sentinels of passed
  substages: a few dozen examples. Target: **under five minutes**.
- **Frozen comparators are cited, not rerun.** `event-chain@3` and the four baselines run
  once on a new set's examples, the first time that set is used, and are cited by hash
  afterwards.
- **Offline observations are reused by hash** whenever the model, decoder and input are
  unchanged.
- **The quiet-host rule and full sweeps apply only to formal stage claims** and to the
  full-sweep cadence the contract already sets.
- **Audits happen only when an instrument or seam actually changes.** Observation-seam@5
  stays until something forces a version.

### 3. The sentinel instrument (first experiment of the next batch)

R10's rule, adopted on 2026-10-05: sentinels from deviation examples only, ties broken by
severity toward difficulty before name. One experiment writes it as a new stage-gates
version with hand cases; a session on a different model audits it; the first routine run
uses it. This is what makes step 2's routine runs small.

### 4. Model roles

Following [CLAUDE.md → Conventions → Model choice](../../CLAUDE.md): experimenters run on
**Claude Opus on high effort**; audits and reviews use a cheaper model that is genuinely
different from the author's (Sonnet, or GPT-6.1-Sol in Codex); Claude Fable and GPT-6-Astra
are not used without a very strong reason. One cost of that choice should be visible: when
Opus authors, an Opus parent is no longer independent of it, so audits and reviews go to
Sonnet or Sol.

### 5. The outside process review, later and in parallel

By a model new to the loop (GPT-6.1-Sol, GPT-6-Astra, GPT-6-Sol, Sonnet 5.5, Fable 5.1 and
Opus 5.5 have all worked in it; GPT-5.6-Sol has not). Its brief: **slim the process**.
Which rules earned their place across 022–051, which cost more than they caught (the four
seam versions and their audits, the per-run ceremony), and what a lighter loop keeps. It
gates nothing and runs alongside the next batch.

### 6. The next direction (the user chooses)

- **Chords: stage 3, Winner bars 1–4.** Needs a polyphonic replacement for strongest-pitch
  masking that still rejects ghost notes (Martin's G2, the low pitches Basic Pitch hears in
  quiet noise).
- **Toward real playing: stage 4, microphone recordings.** Needs gates proposed from
  evidence first, and the device question: the same listener in a browser, on a target
  device, with microphone and UI delay measured.

## Decisions for the user

1. Promote now on 050 and 051, with the sentinel instrument and outside review decoupled
   (step 1)?
2. Adopt step 2's speed rules?
3. Which direction next: chords or real playing (step 6)?

Nothing in this plan changes a gate, a pre-registration, a recorded verdict or frozen
evidence.
