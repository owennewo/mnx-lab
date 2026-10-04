# Track proposals

Proposals for running more than one line of listener development at once, and the
avenues that would run on a second line. A proposal becomes binding only when the user
directs it and [development contract 2](contracts/development-contract-2.md) quotes that
direction. On 2026-10-02 the user did so for proposal 1 and avenue A2, recorded in
[the contract's challenger section](contracts/development-contract-2.md#the-challenger-track-basic-pitch-observations);
everything else here remains proposed. This file is where the case is made and the
avenues are kept, so that they are not lost between experiments and are not filed as
experiments before the loop can hold them.

Opened 2026-09-30 by the user. Their request:

> can you look at the PROMPT_EXPERIMENTER.md and PROMPT_REVIEWER.md for context. The
> research loop is on a certain trajectory. I wanted to talk about a different
> trajectory (possibly a competitor). Am I right in thinking the current research loop
> favours small tweaks not fundamental changes. I have an alternative approach that I
> suspect won't pop out or even be compatible to current approach.

and, after the discussion recorded below:

> how about we add a TRACK_PROPOSALS.md where we outline the problem of relying on a
> single track and make proposals like this. Can we add this as a future avenue to it

## The problem: the loop has one track, and its rules assume one lineage

The loop is built to answer one question at a time about one listener, honestly. That
design is deliberate and it works: 21 experiments in the first series and seven in the
second were run and reported without a disputed verdict. But several of its rules only
make sense for a single lineage of versions, and together they make a fundamentally
different design hard to start and easy to kill.

| Rule | Where | What it assumes | What it does to a new design |
|---|---|---|---|
| Stopping count: listener versions that fail the lowest open substage, in a row | [Contract 2, Stopping](contracts/development-contract-2.md#stopping) | The versions are refinements of a design that already cleared earlier substages | A new design fails early substages while it matures. Three failures force a research refresh and six stop the work. The incumbent never pays this |
| Change one thing per version | [PROMPT_EXPERIMENTER.md §3](PROMPT_EXPERIMENTER.md#3-choose-and-design) | A result is attributed to a delta from a known parent | A new design has no parent; it can never satisfy the rule, and so can never be attributed |
| Sentinels chosen by the incumbent's margins; gimmes retired on the incumbent's passes | [Contract 2, rising tide](contracts/development-contract-2.md#keeping-the-suite-lean-the-rising-tide), [suite record](bench/suite-record.json) | One listener's weak spots are the suite's weak spots | A different design's weak spots are elsewhere. The routine suite is tuned for someone else |
| The next question is the top of the research log, ranked by the contract's order of work | [PROMPT_EXPERIMENTER.md §3](PROMPT_EXPERIMENTER.md#3-choose-and-design), [RESEARCH_LOG.md](RESEARCH_LOG.md#open-questions) | One staircase of deviations for one listener | A competitor does not answer the top question. Taking another is allowed with a reason, but the reviewer's coherence check reads reverting and retrying as thrash |
| Pre-register numbered predictions before anything runs | [PROMPT_EXPERIMENTER.md §3](PROMPT_EXPERIMENTER.md#3-choose-and-design) | The design is understood well enough to predict | A new design needs a bounded exploration first. The loop has no slot for one except the research refresh that three failures trigger |
| The contract nominates a family | [Contract 2, the fresh experimental context](contracts/development-contract-2.md#the-fresh-experimental-context) | Event-based followers with stay and skip transitions are the design to develop | Anything outside that family is not forbidden, but nothing points the loop at it |

The stages themselves carry the same assumption one level down. Stages 1 and 2 are
sines with a 10 ms linear attack and release ([`bench/src/ladder/render.ts`](bench/src/ladder/render.ts)).
For a pitch-first listener that is the cleanest possible input. For a listener that
finds events in the energy envelope it is nearly the worst: the only energy cue is a
20 ms dip where two notes meet, and a slurred performance would remove it. A stage
order chosen for one design is a handicap for another, and a design that fails on it
has not been shown wrong.

The loop has replaced a design once, when contract 2 froze the time-warp family as
comparators and started the event chain fresh. That was done by rewriting the contract
after the user noticed the objective was wrong, not by anything the loop produced.
There is no mechanism for two live designs, and so no way for the loop itself to
discover that the incumbent should be replaced.

What is **not** biased, and is the asset: the instruments, oracles, gates and frozen
sets judge outputs, not designs. Any listener that emits an event-position live cursor
and an end-of-piece assessment by bar and by note is measured by the same rules as the
incumbent. That is what makes a competitor comparable, and it is the part to share
rather than fork.

## Proposal 1: a challenger track under the same contract

A second line of development, for a listener that emits the same two outputs but is
not a version of the incumbent. It shares the measurement and has its own lineage
rules.

**Shared with the incumbent track**

- The instruments, oracles and gates, at whatever version is current. A challenger is
  never judged by an instrument the incumbent is not.
- The frozen example sets and their controls.
- The ledger, the report numbering, the pre-registration discipline and the landing
  sequence. A challenger experiment is a numbered experiment like any other.
- The inherited lessons. A challenger's first pre-registration states how the design
  answers each lesson that bears on it. The experimenter prompt forbids retrying a
  failed idea without saying what is different, and that rule stands.

**Its own**

- **A stopping count.** Counted the same way, but separately, and not started until
  the challenger's exploration budget (below) is spent.
- **Evaluation by full sweep only.** The sentinels and retired gimmes are the
  incumbent's. A challenger runs every frozen example of every substage it claims,
  with controls, until it has passing evidence of its own from which sentinels can be
  chosen by the same rule.
- **An exploration budget in place of predictions, once.** The challenger's first
  experiment pre-registers what it will build, the sets it will run, a budget in runs
  or hours, and the rule for what counts as worth a second experiment. It records what
  it saw. Numbered predictions begin with the second experiment. This is the one
  relaxation, and it is bounded.
- **Its own stage order, where the design calls for one.** The contract's stages stay
  as the definition of what must eventually pass. The challenger may take them in a
  different order, stating why in its first pre-registration, and it does not claim a
  stage passed until that stage's full set and controls pass under the shared gates.
- **A slug prefix** in its experiment reports and run IDs, so the two tracks read apart
  in the ledger and the log.

**Promotion.** Fixed before the challenger's first run: the challenger becomes the
incumbent when it passes every substage the incumbent has passed, or passes one the
incumbent has failed, in each case under the shared gates and with controls. The
loser freezes as a comparator, never developed further, which is the pattern contract
2 already uses for the time-warp family. (As adopted, [the contract's decision 4](contracts/development-contract-2.md#the-challenger-track-basic-pitch-observations)
reads "one the incumbent cannot attempt" where this says "has failed"; the contract
governs, and R11 asks the user which is meant. Resolved 2026-10-04: the contract's
amendment rewrites the rule around "has failed" on the same examples and a held-out
confirmation.) Until promotion, the incumbent track
continues unchanged and its questions keep their rank.

**Cost.** One more listener in the full sweep, and a second stopping count for the
reviewer to carry. The routine suite is unchanged. The process reviewer checks both
tracks; its direction check ([PROMPT_REVIEWER.md §3.4](PROMPT_REVIEWER.md#34-direction))
gains one question, whether the challenger is still aimed at the same two outputs.

**What needs the user.** Opening the track, its exploration budget, its stage order
and the promotion rule, since together they change the contract's order of work.

## Proposal 2: a challenger contract

For a design whose outputs are not the two the contract names. This is the move
contract 2 made against contract 1: a new contract, new instruments, a new oracle and
its audit, and an archived record. Nothing in the loop's structure needs to change for
it, but nothing is shared either, and the two cannot be compared by the same numbers.
This is the fallback where proposal 1 does not fit, not a first choice.

## Avenues

Designs proposed for a second track, with the case for each and what it must answer.
An avenue stays here until the user opens a track for it; then its first experiment's
pre-registration takes over and this entry links to it.

### A1. Energy first, frequency second

Proposed by the user, 2026-09-30:

> it is energy first approach, frequency second. We track energy levels which are
> correlated to events then analyse the energy peaks for frequencies.

**How it differs from the incumbent.** The incumbent, `event-chain@2`
([`bench/src/listeners/eventChain2.ts`](bench/src/listeners/eventChain2.ts)), is
pitch-first with energy as a gate. Every 10 ms it runs a zero-crossing pitch estimate
over a 20 ms window, and an event is a *change in the detected pitch* that holds for
two windows offline or three live. Energy appears once, as a silence threshold.
Onsets are inferred backwards from the moment the pitch label flipped. Its refusals
follow from that definition: it declines identical adjacent pitches, because a repeated
note produces no pitch change and so no event, and it declines anything but
monophonic scores, because one zero-crossing estimate cannot label a chord.

Energy-first inverts the dependency. An event is an energy transient, an attack, found
in the envelope; frequency content is analysed at or just after the peak as an
attribute of the event. Onset timing comes from the envelope. Pitch is read where
signal-to-noise is best and the decay is ignored rather than fought.

**The case for it, on the direction of travel.**

- Repeated notes fall out for free. Real music repeats notes constantly, and the
  incumbent's refusal is baked into its event definition rather than being a missing
  feature.
- A chord at stage 3 is one energy event with several frequencies; strum spread is an
  energy-domain measurement. The incumbent has no path to chords.
- Recorded guitar at stage 4 is the natural case for onset detection: sharp attacks,
  long decays. Lesson L5, bursts of failure while a bass note decays, is what
  pitch-first does to that signal.
- Onset jitter, a listed stage 2 deviation, is native to the energy domain.

**What it must answer.**

- Lessons L2 and L3: matching the current sound against templates ties in repeated
  harmony and accepts a different piece sharing sustained notes. Energy events must
  still feed a sequence model, as the incumbent's cost chain does. Energy without
  order re-fails those lessons.
- Lesson L6: a steady-tempo assumption hurts real playing. Onset detection is
  tempo-free by construction, but any onset-prediction window it adopts must be
  checked against this.
- Its sound. The sine stages offer only the 20 ms boundary dip as an energy cue. The
  avenue's natural first proving ground is a sound with real attacks, so its proposed
  stage order runs the recorded-guitar sample set early, on the stage 1 and 2 scores,
  before or beside the sines. That reorder is why it needs a track of its own rather
  than an experiment in the incumbent's queue.
- Sustained energy events with no attack: a slur, a hammer-on or a bend changes pitch
  with little or no energy transient. The design should say what it does there, even
  if the answer for the first stages is "refuses".

**Outputs.** The same two. Events map to score positions, and each carries an onset
and a frequency label, so the live cursor and the per-note and per-interval assessment
fit the instruments unchanged. This is a proposal 1 avenue, not a proposal 2 one.

**Status.** Proposed. No track opened, no experiment numbered.

### A2. Basic Pitch observations through the event chain

Proposed by the user, 2026-10-02, after comparing this loop with the score-blind
transcription work in `~/dev/guitar-nn`:

> Lets suppose that Basic Pitch is promising. Perhaps we should consider a new contract
> that is more "midi" based wdyt?

**How it differs from the incumbent.** `event-chain@3`
([`bench/src/listeners/eventChain3.ts`](bench/src/listeners/eventChain3.ts)) reuses @1's
`sinePitch`: a zero-crossing estimate over a 20 ms window every 10 ms, a token when the
label changes and holds for two windows offline or three live, and a 20 ms boundary dip
as its only energy cue. Everything after the token stream, the stay-and-skip cost chain,
the offline `alignPitches`, the intervals, notes and other-bars flags, is front-end
agnostic. A2 keeps all of that and replaces `sinePitch` with observations from Spotify's
Basic Pitch, a 17K-parameter convolutional model over a harmonic constant-Q transform
that emits onset, note and contour activations at 86 frames per second for 88 pitches,
polyphonic and instrument-agnostic, already shipped as ONNX and runnable in a browser.

**The case for it, on the direction of travel.**

- It is the only front end in reach that already hears recorded guitar: 69.7% note F1
  (pitch and onset, 50 ms) on 24 GuitarSet microphone recordings, 79.6% on solos, and
  81.6% pitch-activity F1, measured in `~/dev/guitar-nn` under a frozen policy, with the
  caveat that its training overlap with GuitarSet is unknown. Nothing in this loop has
  passed recorded guitar.
- It is polyphonic, so stage 3's chords stop being a front-end problem.
- It has an onset head: avenue A1's energy-first idea in a learned form.
- The score prior should recover much of what it loses blind: octave ghosts the score
  does not contain are extra notes, same-pitch splits collapse onto one event, and the
  chain decides between a few hypotheses rather than transcribing.

**What it must answer.**

- Lesson L1: develop on exact labels first. Its proving ground is therefore the stage-1
  and stage-2 scores rendered with `sample-render@1`, not GuitarSet.
- Lessons L2, L3 and L8: unchanged, because the chain and the controls are unchanged.
- Lesson L4: thresholds shift per timbre. Any decoder threshold is fitted on the
  development guitars and never on what it is scored on.
- Lesson L5: decay. Basic Pitch's biggest measured guitar failure is a missed
  re-articulation under a same-pitch sustain (462 of 1,043 misses), the same repeated-note
  blind spot the incumbent has; the chain must not make it worse.
- Latency. Upstream trims 15 frames from each window edge, about 174 ms of look-ahead
  before any hop, against a 200 ms cursor gate. The live path has to measure what
  untrimmed edge frames cost in accuracy, and what running overlapping windows costs in
  compute.
- Per-window normalisation: a window of quiet non-zero audio is stretched to full scale
  and hallucinates notes. Digital-zero silence does not. The frozen controls are exact
  zeros; real rooms are not.
- Its 127.7 ms minimum note length against the shortest written note in each score.
- Pure sines are out of distribution for it; a sine result is reported, not judged.

**Outputs.** The same two, through the same chain: a proposal 1 avenue. The seam between
front end and chain is written as `contracts/observation-seam-1.md`.

**Status.** Track opened 2026-10-02 under proposal 1; the terms, budget, stage order and
promotion rule are in the contract's challenger section. First experiment: 035.

## Adding to this file

- A **proposal** changes how tracks are run. Say what rule it shares, what it owns, and
  what it needs the user to decide.
- An **avenue** is a design for a second track. Say how it differs from the incumbent
  by reading the incumbent's code, not its report; make the case on the direction of
  travel; list the inherited lessons it must answer; state whether it emits the same
  two outputs.
- Quote the user's words when the idea is theirs. Do not restate the research log's
  state here; link it.
