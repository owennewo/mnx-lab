# Campaign: the player — a reviewer hears what the score asserts

> **A campaign** (see CLAUDE.md → Conventions): this doc is an index over many normal
> proposals, the shared contract they follow, and the running log of progress and
> learnings as items land. Indexed items are ordinary `core-*` (and one `studio-*`)
> proposals that name this campaign. **Opened 2026-09-08; revised the same day on an
> independent review before anything was built** — see the first log entry. Items 1–9 are implemented; the remaining items are proposed.

## The goal

**First, for the reviewer.** A scenario's engraving says what the music *looks* like; a
player says what it *means* — which bars are performed, in what order, how many times,
at what pitch and when. Today a reviewer verifying `repeats-alternate-endings-advanced`
approves an SVG and takes the traversal on trust. The **first reviewer milestone** is
the written score, a performed-order table beside it, and sound with a cursor that
follows the audio clock. The unrolled engraving comes after that, as its own reviewable
layout change, because it is a bigger change than it looks (log entry 1, point 6).

**Then, for practice.** Studio's practice features — loop a selection on its pass,
slow it down, count in, mute a part — are follow-up items in the index, not a second
campaign. None starts until the reviewer items are verified.

Playback is **not in the spec loop** for now. Items will find gaps (no coda or D.C.
vocabulary; grace steal timing loose) and record them in the log; filing a
`spec/proposals/` topic is a separate human decision.

## Baseline at campaign opening

- **A traversal exists.** `src/model/passes.ts` (`linearizePasses`) already walks
  repeats with counts, implied start repeats, numbered voltas, D.S. and D.S. al Fine,
  with a cycle cap, and its header names the player as an intended consumer. The lyric
  tooling (`edit/lyricText.ts`) consumes `soundingPasses`, and `passes.test.ts` pins it.
  It records one deliberate simplification — on a D.S. return it re-enters numbered
  voltas as iteration 1 — and says "revisit with the player". **Item 1 extends it.**
- **A playback seam exists in `elements/`.** `mnxContext.ts` declares a
  `PlaybackState` context (`playing`, `tempo`, `volume`, `playheadTime`,
  `activeNoteIds`) and `<mnx-document-viewer>` already folds `activeNoteIds` into its
  highlight. Nothing provides it. Item 2 replaces its shape; item 7 provides it.
- `src/audio/mnxToAudio.ts` (74 lines) walks events into beat offsets and Tone-style
  pitch names; nothing imports it. It handles no ties, tuplets, grace, repeats, tempo
  marks or dynamics. It retires in item 5.
- The pre-rebuild tag holds a Tone.js controller
  (`git show pre-rebuild:src/controllers/PlaybackController.ts`): a reference, not a
  starting point — it made Tone's Transport the timeline.
- **MNX `pitch` is the sounded pitch** (spec: "The note's sounded pitch"; ottavas and
  clef octaves "only affect display"). The renderer and the Guitar Pro importer already
  follow that. Playback reads `pitch` and applies **no** transposition, clef or ottava
  shift.
- The model's note values run to `4096th`; tuplet and grace containers exist, but
  their content types and `noteWalk.ts` currently support **one** container level.
  Item 5 owns recursive types, identities and their consumer migration.
- The layer order reserves the slot: `audio` is a peer of `engine` over `model`;
  `elements` may import `audio` but **never `edit`**.
- The embed face builds **IIFE and ESM** (`vite.embed.config.ts`), and Vite does not
  code-split an IIFE; `npm run build` does **not** build the embed face
  (`build:embed` does). Any "lazy chunk" claim has to be measured on both formats.
- Browser-driven checks have precedent: `harness/render/render-png.ts` and five
  `smoke:*` scripts drive `google-chrome`. An audio adapter that cannot run under Node
  can still be tested in a browser `OfflineAudioContext`.
- Fermatas carry a `duration` hint (`auto`…`none`); `MnxTie` has `targetType`
  including `crossJump`; `MnxTremolo` and `MnxGrace` are containers with performed
  values.
- 14 corpus scenarios carry repeats, endings or jumps; 6 carry tempo marks.

## The shape — decisions as revised 2026-09-08

**1. Musical time is rational; ticks appear only at MIDI export.** Positions and
durations are exact fractions of a whole note (BigInt arithmetic, canonical decimal
string numerator/denominator in JSON, with diagnosed resource limits),
so a septuplet of 4096ths is exact. A tempo map in quarter BPM at rational positions
turns them into seconds at play time. MIDI export quantises **absolute** boundaries to
a declared PPQ with stated rounding, so error never accumulates. This replaces the
first draft's "PPQ 960" — which is not divisible by 7 and puts a 4096th under one tick.

**2. Written spans and sounding events are two lists, linked.** A tie merges attacks
but the cursor must still reach the tied continuation; a tremolo turns one written note
into several attacks. So the performance carries *written occurrences* (a written note
key at a performed ordinal, with its span) and *sounding events* (what a voice does),
with explicit links both ways. Neither list is derivable from the other.

**3. Three identities, not one "pass".** The first draft conflated them; the existing
pass model already keeps two apart:
- **performed ordinal** — position in the performed order (`order[k]`); the playback
  and seek unit;
- **occurrence** — the nth sounding of a written bar (`passCounts`); what an unrolled
  engraving labels;
- **iteration** — which time through the enclosing strain (`soundingPasses`); the
  repeat *context* — what an inspection cursor shows, and what selects a verse.
A second ending sounds once (occurrence 1) on iteration 2. Playback is keyed by
ordinal; the cursor's repeat index is an iteration; verse resolution goes through
iteration. An iteration can name multiple visits after D.S.; item 2 returns candidate
ordinals and selects relative to live playback. Inspection and playback iteration are separate.
A selected inspection iteration stays selectable on a bar it skips — the bar reads
*not performed on iteration 2*, which is the reviewer's whole point.

**4. The sound backend is decided by a spike, and the transport is ours either way.**
Tone.js is the incumbent (the user has used it and liked it), but if the transport,
tempo map and scheduling stay ours — and they must, for the harness — the spike
measures what Tone actually saves against a small native Web Audio sink. Whichever
wins is a *renderer* behind an injected `Sink`; nothing musical lives in it.

**5. Voices are independently addressable; string ownership is a property of a
voice, not the browser's voice model.** A bent note inside a chord needs its own pitch
control, and a fretted part's authoritative string choice should be audible. So a
fretted part gets one voice per string. **MIDI channel-per-string is the export's
allocation, bounded**: 16 channels, kit on 10, independent curves disabled on
fallback parts and export refused if even one melodic channel per part cannot fit.
Missing string choices get explicit pitch-only voices (item 5).

**Where MIDI runs out.** Timbre semantics — harmonics, palm mute, vibrato — have no
single universal MIDI encoding; the compiler uses velocity, duration, timbre hints
and bend curves. Harmonic metadata never overrides sounded `note.pitch`. The MIDI file
is an **export of a supported subset**, never "the golden in another form": written identities, continuous curves beyond the bend range and
articulation semantics do not survive it, and the writer says so.

## The shared contract

**No item writes code before its agreement block is written down.** Each indexed
proposal opens with, and is reviewed on:

1. **Pure before audible.** Every musical decision lives in `model/` or `audio/` as a
   pure function with a golden or a conformance test that runs under Node. Nothing
   about correctness lives in the sink. An item that can only be checked by ear has not
   found its test yet — and "cannot run under Node" means a browser `OfflineAudioContext`
   check, not "manual only".
2. **Rational time.** Musical positions are exact fractions; seconds are derived at
   play time; ticks exist only inside the MIDI writer, with declared PPQ and rounding.
   No golden stores a second or a tick.
3. **Three identities, and the editor untouched.** Performed ordinal, occurrence and
   iteration are distinct and named as such. The editor cursor stays a written rhythmic
   position (`edit/cursor.ts`); the playback context is separate
   state, provided by the common host from player events. Live playback and inspection
   iteration never overwrite each other; neither writes the edit session or selection. `elements/` does not
   import `edit/`; the host maps between them.
4. **The proof, named first; the verification path owned.** A new golden hashes
   **separately** (`renderHash`'s file set is frozen), and the item that adds one owns
   the whole path: `meta.schema.json`, `verify-scenarios.mjs` queue detection and
   stale-approval rules, the approval writer, and the `/verify` review page. Existing
   engraving approval does not approve newly added evidence: a missing new hash is
   unseen evidence in the queue, while the older approval remains intact. "Add a
   hash" is not an item. Moved batches register in
   [lab-verify.md](lab-verify.md).
5. **The dependency budget.** At most **one** runtime audio dependency, chosen by item
   4's spike, confined to `src/audio/<backend>/` by a dependency-cruiser rule, never
   reachable from `engine/headless.ts` or Node conformance imports. Browser harness
   entry points may import the sink to test it. Its cost is measured on **both**
   embed formats before it is admitted. Anything else argues its case here first.
6. **Spec findings go in the log, not upstream.**
7. **Reviewer gain, stated.** Items 1–10 serve the reviewer; 11–13 serve practice and
   are ordered after the last verified reviewer item.
8. **The cursor follows the audio clock.** Scheduling lookahead never drives the UI;
   onsets carry audio-clock times and the playhead moves when they arrive.

## The index

Reviewer path: extend the traversal and fix identity → the timing and pitch contracts
→ the spike → compiler, transport and player **over the written score** → expression →
the oracle → the unrolled engraving. Items 2 and 3 are independent of each other; 4 can
run any time before 6.

| # | Item | Scope | Serves | Proof | Status |
|---|------|-------|--------|-------|--------|
| 1 | [Traversal](../complete/core-player-traversal.md) | **Extend `model/passes.ts`**, keeping its consumers and suite: performed entries with ordinal, occurrence and iteration; partial-measure bounds for mid-bar segno/Fine/D.S.; diagnostics; the D.S.-into-voltas simplification resolved. | reviewer | the existing suite + hand-stated orders for the 14 navigation scenarios + a committed corpus report | complete; new engraving review pending |
| 2 | [Playback context and the iteration cursor](../complete/core-player-pass-cursor.md) | A host-owned playback context (replacing the dormant `PlaybackState` shape) carrying ordinal and iteration; the chip ladder shows `iteration 2 of 3` / *not performed*; changeable; feeds `selected-verse`. The edit session is untouched. | reviewer | conformance tests on the pure resolver; no golden moves | complete |
| 3 | [Timing and pitch contracts](../complete/core-player-timing-pitch.md) | `audio/time.ts` (rational arithmetic, tempo map, `secondsAt`); the pitch rule as tests over transposing parts, guitar clefs, ottavas and capo (**nothing shifts**); grace, fermata (incl. `duration` hints and cross-part sync) and tie conventions written down with numbers; the performance golden's format. | reviewer | conformance tests | complete |
| 4 | [Audio backend spike](../complete/core-player-tone-spike.md) | Tone.js **versus a native Web Audio sink**, measured: Node import, browser Offline render, per-voice detune ramps, both embed formats' size, what Tone saves once the transport is ours. Output: a log entry and the `Sink` interface. | both | its findings | complete; native selected |
| 5 | [Performance compiler and MIDI export](../complete/core-player-performance.md) | `audio/performance.ts`: two linked lists (written occurrences, sounding events), rational time, ties merged after unrolling, nested tuplets (with the identity change `noteWalk.ts` needs), grace, tremolo, fermatas, `pitch` read as sounded. `expected.performance.json` with the verification path owned. **MIDI as a bounded export** with channel allocation, overflow, bend range and quantisation stated. | reviewer | the golden; item 9 where it can see | complete; performance review pending |
| 6 | [Transport](../complete/core-player-transport.md) | `audio/transport.ts` pure over an injected clock and sink, fake-clock tests: audio-clock-timestamped onsets, seek into sustained notes, cancel and voice release, controller reconstruction on rate change, loops across ties. `audio/<backend>/` with independently addressable voices and per-string ownership for fretted parts. | reviewer | fake-clock suite; a browser Offline smoke for the sink | complete |
| 7 | [Player element, written view](../complete/core-player-element.md) | `<mnx-player>` over the written score: transport bar, position as bar/iteration/beat, **performed-order table**, playback highlight separate from selection, click-to-seek, Listen on `/verify`. **The first reviewer milestone.** | reviewer | element census; embed smoke on both formats | complete; human review pending |
| 8 | [Expression and technique](../complete/core-player-expression.md) | Dynamics, articulations, arpeggio, guitar curves and voice flags; tempo-relative vibrato; harmonics preserve sounded pitch with technique validation; conventions numbered. | reviewer | performance golden; ear for what MIDI cannot see | complete; human performance review pending |
| 9 | [MIDI oracle](../complete/core-player-midi-oracle.md) | MuseScore or Verovio performing the W3C comparisons; observable pitch/navigation compared strictly; ambiguous bar order marked unobservable; timing aligned around interpretive regions. A small experiment as soon as a tool is chosen, the full baseline after item 5. | reviewer | itself | complete; 22/27 W3C observable strict matches |
| 10 | [Unrolled engraving](../complete/core-player-unrolled-view.md) | An **occurrence-aware layout plan**: `planHorizontal` takes performed entries, every dependent index (curves, beams, lyrics, ottavas, dynamics) resolved per occurrence, inherited clef/key state correct at jump targets. Opt-in goldens, path owned. | reviewer | opt-in `expected.unrolled.svg` through `/verify` | complete; unrolled engraving review pending |
| 11 | [WebMIDI out](../proposed/core-player-webmidi.md) | A second sink; the export's channel plan on the wire; never the default. | practice | the writer's tests | proposed — after reviewer items 1–10 |
| 12 | [Sampled guitar](../proposed/core-player-sampled-guitar.md) | A sampled voice per string; the asset question is the item; per-voice pitch control verified for the chosen sampler first. | practice | ear | proposed — after reviewer items 1–10 |
| 13 | [Practice mode](../proposed/studio-player-practice.md) | Loop a selection — with the **written-range → performed-occurrences policy stated** — speed trainer, count-in, metronome, mute/solo. | practice | fake-clock tests | proposed — after reviewer items 1–10 |

### Decisions still open

- **Grace and fermata numbers.** Item 3 records executable conventions below; item 5
  applies them to the performance golden.
- **Repeats after a D.S.** Resolved by item 1: no repeats on return; take the final
  declared iteration in strains with endings.
- **Backend.** Item 4 measured both and selected native Web Audio; see the log below.

## Progress + learnings

### 2026-09-08 — the plan reviewed before a line was written

An independent review of the first draft (all thirteen docs) found three errors of fact
and six design faults; every point was checked against the tree and every one held.
Recorded because each is the kind of thing a later item would otherwise rediscover.

1. **The traversal existed.** `model/passes.ts` had done the walk for the lyric tooling
   since the one-surface campaign; the draft said "no traversal exists anywhere". A
   grep had listed the file. **Lesson: open the file the grep lists.** A second walker
   would have let lyrics and playback disagree at the edges — exactly what the existing
   header says it exists to prevent.
2. **"Pass" was two things.** The draft defined it as an occurrence count and then
   promised a "not performed on pass 2" state that its own clamp rule made
   unreachable. The pass model already distinguished occurrence from iteration.
3. **MNX pitch is sounded, not written.** The draft read the transposition
   description alone and inverted the conclusion; the note object says "sounded
   pitch", and ottavas are display-only. The pitch stage collapsed into a set of
   tests that nothing shifts.
4. **960 is not divisible by 7**, and a 4096th is under a tick. Rational time
   internally; quantise at export.
5. **One written key per sounding note loses ties and tremolos** in opposite
   directions. Two linked lists.
6. **Unrolling is a plan change.** The horizontal plan's measure indexes underpin
   curves, beams, lyrics and ottavas; "spacing untouched" was wishful, and "the
   unrolled note set equals the document's" is false under a D.S. al Fine. Moved
   after the player so the reviewer hears trustworthy playback sooner.
7. **Emitting UI events from the scheduling window puts the cursor ahead of the
   sound by the lookahead.** Now contract clause 8.
8. **"Lossless MIDI" and unbounded channel-per-string** — three guitars need 18
   channels of 16. Bounded export, allocation stated.
9. **The embed is IIFE + ESM with no splitting on the IIFE, and `npm run build`
   does not build it**; the lazy-chunk promise was untested. And `elements/` cannot
   import `edit/`, which the element draft quietly required.

Also corrected: links to the display-settings doc, which had moved to `complete/`
while the draft was being written — its `selected-verse` property is what item 2 feeds.

### 2026-09-08 — follow-up review: contracts made executable

The second review retained the architecture and sequencing; this plan-only update
closes remaining ambiguities. No implementation or scenario approval is implied.

- D.S. can revisit a measure on the same iteration. Candidate ordinals, not a unique
  `(measure, iteration)` lookup, drive seek; loop selection chooses a concrete start
  and subsequent end and previews intervening performed bars.
- The common host is the sole Lit context provider. Player state changes update it;
  inspection iteration remains separate from playback and Follow controls reveal/verse.
- Exact arithmetic uses BigInt with a canonical JSON form and resource limits. Grace
  budgets, shared holds, insertion ordering, source maps and jump-state restoration
  now have worked examples. Vibrato is tempo-relative; harmonic pitch remains sounded.
- MIDI preflights all channels, drops independent curves on fallback parts, refuses
  impossible minimum allocations and diagnoses collapsed quantized boundaries.
  WebMIDI clears queued messages before reset/reconstruction and converts clock origins.
- New performance/unrolled evidence is queued as unseen despite older engraving
  approval. Approval stamps only presented evidence and preserves unrelated provenance.
- The oracle distinguishes observable results from ambiguous bar order and aligns
  around interpretive shifts; discrepancies are attributed rather than presumed ours.
- Recursive container types/consumers, unassigned-string voices and visible versus
  performed notes in partially drawn measures are explicit implementation obligations.

The backend spike can start independently of musical implementation. The later practice
items retain the campaign-wide prerequisite that reviewer items 1–10 are verified.


### 2026-09-08 — item 1: traversal implementation

- Extended the existing walker with performed ordinal, occurrence, iteration,
  metric bounds, diagnostics and a structural inspection-iteration domain. The
  existing seven pass tests and lyric consumer are unchanged; 16 hand-stated
  navigation examples and a whole-corpus report pin the new evidence.
- D.S. returns take the final declared iteration in strains with endings and do
  not retake repeats. Ending membership includes interior bars. A Fine before the
  return's segno offset does not terminate that return. Plain strains retain
  iteration 1 on D.S.; no visit invents a new verse.
- The mirrored simple/advanced ending examples label ending 3 with default
  `times: 2`; preserve existing orders and report unmatched endings. The tab marks
  showcase offers three inspection iterations even though its second ending exits
  the walk on iteration 2. **Lesson:** declared strain iterations and observed
  visits are different evidence; neither can substitute for the other.
- MNX's pinned jump types still provide no coda/D.C. vocabulary or rule for
  repeats/endings after D.S. The chosen final-ending behavior is a lab convention;
  no upstream proposal was filed.
- Existing engravings are unchanged. The new D.S./mid-bar fixture is queued in
  [lab-verify.md](lab-verify.md#player-traversal--2026-09-08); implementation completion
  does not imply its engraving has human approval or release the practice gate.


### 2026-09-08 — item 3: exact timing and sounded-pitch contracts

- Reused the model's single base-duration table; exact BigInt time has a 512-bit
  reduced-component budget, 1,024-bit intermediates, 32 dots and 32 tuplet levels.
  Resource exhaustion is a typed diagnostic/failure, never approximate event time.
- Tempo normalization and integration honor mid-bar marks. Clock inverse rounds
  half-up to 1/2^20 whole note for display/seek only; transport applies rate once.
- Independent written-state lanes restore state on every entry, including marks
  before a mid-bar segno and marks in a skipped ending. The compiler supplies real
  measure spans, persistent changes and resolved dynamic scopes.
- Shared insertions combine by maximum, ordered fermata then make-time. Existing
  releases sustain through a coincident hold but release before make-time; grace
  uses its own interval. Tempo changes at that point follow the insertions, which
  therefore retain the earlier tempo. Source lookup keeps the written position.
- Sounded-pitch tests cover transposition, guitar octave clefs, ottavas, capo and
  natural/artificial harmonics with/without touchingPitch. No display or technique
  field transposes the pitch. Vibrato's period is 1/10 whole note, tempo-relative.
- Version 1 performance types and [the format documentation](../../docs/player-time.md)
  fix written/sounding lists, their reciprocal links, rational tempo, measure spans
  and source segments. Item 5 still owns compilation, serialization, opt-in goldens
  and approval. No scenario evidence/approval or upstream spec proposal was added.

The conventions adopted for the compiler (lab choices, not new MNX requirements):

| Case | Convention | Why |
|---|---|---|
| No tempo mark | 120 quarter BPM | chosen campaign default |
| `tempos[].value` | normalised to quarter BPM; mid-bar `location` honoured | `lab/40-navigation/04` |
| Grace, `stealPrevious` / `stealFollowing` | group budget = min(1/32 whole note, half the neighbour's performed duration before holds); taken from its end / start, divided among grace events in proportion to their notated durations | bounded, leaves the neighbour positive time |
| Grace, `makeTime` | insert 1/32 whole note before the principal onset; simultaneous groups share one insertion and each fits within it | one score-wide insertion, not one per part |
| Fermata, `duration` `auto`/`normal` | × 1.5 on the event; `short`/`veryShort` × 1.25, `long` × 2, `veryLong` × 3, **`none` × 1** | the model already carries the hint |
| Fermata sync | event requests extra duration `(multiplier − 1) × event span` at its release; barline requests `(multiplier − 1) × 1/4` whole note at the boundary; simultaneous requests combine by **maximum**, not sum | duplicated marks do not multiply the hold |
| Tie | target extends the source's sounding event; the target keeps its **written occurrence** (the cursor still lands on it) | contract §3 / decision 2 |
| `lv` tie | rings for one whole note or until the string is re-struck | fretted-instrument convention |
| Tremolo | subdivided by `marks` within the container's performed value | model semantics |

### 2026-09-08 — item 2: playback context and inspection cursor

- The common host provides live ordinal/iteration and independent inspection state.
  Inspection disables Follow without seeking or touching editor history/selection.
  Stopping falls back to inspection; absent verse indexes explicitly clear the hook.
- Iteration queries retain every D.S. candidate. Candidate selection only wraps on
  explicit seek; repeated clicks can cycle. Structural domains drive chip cycling,
  while navigation retains skipped iterations as “not performed.”
- The source embed demonstrates a plain ancestor provider. The library exports the
  context and pure helpers; item 7 must invalidate compiled revisions on document
  changes and emit updates on the audio clock. Highlighted-ink reveal is available;
  the public position/rest reveal remains that item's responsibility.
- 21 pure conformance tests cover the navigation corpus and state transitions.
  No golden or verification record changed; no new approval batch is needed.

### 2026-09-08 — item 4: backend measured, native Web Audio selected

- [Full report and versioned measurements](../../research/player-backend-spike.md).
  Both Node imports pass. Both offline oscillator paths pass C4 rendering,
  independent +200-cent bends/5 Hz vibrato, re-pitch without attack, scheduled
  cancellation and isolated release. User-gesture unlock and raw clocks pass.
- Actual IIFE/ESM builds: native adds 573/619 gzip bytes to the viewer baseline;
  Tone 15.1.22 adds 57,612/65,184. These are disposable prototype sizes, not a
  promise for the full player. Select **native Web Audio**, bundled in both faces.
- Tone supplies envelopes, parameter timelines and Offline/context convenience,
  but source generations, cancellation and the transport remain ours. Sampler's
  active sources are private with no public per-voice detune; item 12 will need
  native sample voices. Default Tone.now() includes lookahead: use raw currentTime.
- The type-only [Sink contract](../../src/audio/sink.ts) fixes seconds, action order,
  separate attack/pitch, raw now, unlock, cancellation and disposal. A <=5 ms
  de-click tail is the lab convention. Item 6 owns crossing-ramp cancellation,
  generation-safe cleanup and durable offline tests; the spike does not implement them.
- Prototype code and temporary dependency are discarded. No package manifests,
  engraving goldens or approvals change; no verification batch is needed.

### 2026-09-09 — item 5: performance compiler and bounded MIDI evidence

- The canonical note walker now handles recursive container paths; shallow keys
  remain unchanged. Editor lookups/equality, selection, references and JSON anchors
  use those paths. Nested geometry diagnoses instead of inventing ink. Existing
  primitives/SVGs are byte-identical.
- Compilation separates written occurrences from sounding spans: ties merge after
  traversal, tremolos emit repeated attacks, partial bars clip content, and grace/
  fermata insertions shift all parts together. Authored `space` durations are fraction
  arrays and must be handled before the permissive timed-event classifier.
- Added `voices[]` metadata to the unapproved v1 format, so MIDI allocation does not
  parse voice-id strings. Declared strings retain their actual numbers; conflicts
  preserve pitches on fallback voices, and later string attacks truncate sound.
- MIDI exports type 1 at PPQ 960, rounds absolute boundaries, preflights channels,
  composes/quantizes bounded curves and reports lost information. The small byte
  reader checks structure; it does not replace item 9's independent oracle.
- 32 opt-in performance/MIDI goldens are registered in
  [the new-evidence ledger](lab-verify.md#player-performance--2026-09-09). The checker,
  queue, static review page and approval receipt own the entire lifecycle. New
  evidence is unseen despite current engraving approval; approval records are kept.
- The legacy audio approximation is retired. The library exports compiler, exact
  time and MIDI writer; the [API/conventions](../../docs/player-performance.md) describe
  resource bounds and limits. No sound/transport or human verification is implied.

### Item 6 — transport and native sink (2026-09-09)

- Built the pure injected-clock transport and lazy native sine sink. The
  [API/limits](../../docs/player-transport.md) document pause/resume, seek through
  sustained/tied notes, rate-as-seek, loop re-strikes, written highlight lifetimes,
  source-map snapshots and logical pitch transitions. The player UI remains item 7.
- Exact rational anchors must survive a seek unchanged. The inverse clock's display
  grid must not stop playback a fraction before the final release; completion uses
  audio time. Delayed scheduler callbacks reconstruct current state rather than
  replaying attacks missed while the tab was suspended.
- Cancelling a future attack leaves its physical cleanup pending, but it must cease
  to be a logical voice boundary immediately. Otherwise a replacement source ends
  at the cancelled attack's old time. The offline smoke pins this regression, along
  with preserving the already-scheduled portion of a ramp before cancellation.
- Offline contexts also have `resume()`, but it cannot be used before rendering.
  Unlock explicitly distinguishes them from live contexts. A supplied context is
  host-owned; idle imports/construction are Node-safe. No runtime audio dependency.
- The native fence is tested with actual dependency-cruiser rejection/admission.
  Fake-clock conformance and the permanent `smoke:audio` buffer tests own the proof.
  No scenario goldens or verification records changed; item 5's review debt remains.

Measured on `8f40315` plus item 6, using the real embed configuration, retained
exports and default Node gzip. Reproduce with `audio-bundle-cost.mjs`. Bytes:

| Variant | IIFE raw | IIFE gzip | ESM raw | ESM gzip |
|---|---:|---:|---:|---:|
| Viewer baseline | 196,718 | 64,030 | 254,420 | 72,684 |
| Viewer + complete native sink | 201,368 | 65,570 | 260,093 | 74,349 |
| Viewer + compiler, transport, sink | 229,601 | 74,839 | 296,242 | 84,849 |

The sink increment is 1,540/1,665 gzip bytes (IIFE/ESM); complete playback adds
10,809/12,165. Both are bundled comparison variants, with no lazy-IIFE claim.
The shipped viewer entry stays unchanged until item 7 consumes playback.

### Item 7 — the written-score player (2026-09-09)

- `<mnx-player>` now supplies controls, a performed-order table and timed events;
  [public API and wiring](../../docs/player-element.md). The existing scenario side
  panel houses it beside the engraving. Both plain-DOM embed examples use a common
  ancestor provider; the player does not provide context to its sibling viewer.
- Context updates must be about changed live state, not every clock poll. Playback
  ink is a paint overlay, so a highlight never rebuilds the engraved SVG. Its blue
  survives the selection's higher-specificity accent rules; tests cover coincident
  playback/selection and all three views. Reveal shares scroll math, not selection.
- Plain-DOM hosts may install a provider after the viewer's first context request.
  The host helper uses a public provider subscription for that already-connected case
  and removes its listeners/subscriptions on disposal. Inspection/Follow remain separate.
- Document edits stop sound before recompilation and invalidate live ordinals. The
  smoke sends an actual edit key and requires a new document plus cleared playback.
  Route `at` is a one-shot seek, never autoplay or a standing instruction to reinterpret
  an old visit after an edit. A D.S. return is checked on the newly mounted viewer.
- Static `/verify` Listen plays the exact presented performance and highlights its
  committed SVGs. JSON is escaped in inert script blocks; the player bundle is inline,
  retaining self-contained review and the existing receipt hashes. No approvals granted.
- Volume remains native-backend work: the sink owns its master gain and lazy context;
  the element only requests a level. The offline smoke measures attenuation.
  Both ESM/IIFE smokes prove playback, context, seek cycling, inspection, replacement
  and disposal. Existing scenario goldens and verification records are unchanged.

### Item 8 — expression and technique (2026-09-09)

- Pure interpretation in `audio/expression.ts`, after ties and before string
  re-strikes. The [numbered conventions](../../docs/player-expression.md) cover
  scoped dynamics, hairpins, articulation, arpeggio, tremolo intensity, guitar
  curves and harmonic validation. Written occurrence spans remain unchanged.
- `damped` joins the sounding flags; pitch transitions carry target velocity to
  the sink. Native harmonic hints use a triangle patch with the same fundamental.
  MIDI explicitly reports retriggered legato and omitted timbre semantics.
- The committed schema's dynamic end is a measure id plus rhythmic position; the
  old TypeScript shape was stale. Cross-bar interpolation now uses compiler
  lengths. Missing hairpin ends remain diagnosed, not guessed.
- Harmonic touching metadata is checked only for known natural nodes; artificial
  harmonics cannot use open-string arithmetic. Sounded pitch is never rewritten.
- Offline rendering exposed a native automation discontinuity: scheduling a bend
  reset and the following ramp could erase the source's incoming ramp endpoint.
  Preserve the left-hand endpoint and separate it from the step by one sample.
  The compiled bend and hammer now both measure 493.883 Hz, with target attenuation
  55/80 and harmonic third-partial ratio 1/9.
- [Review debt](lab-verify.md#player-expression--2026-09-09): 16 new baselines and
  four changed existing baselines. Engraving output and provenance are unchanged;
  automated buffer checks are not listening approval. Item 9 remains the
  independent MIDI oracle obligation.

- Landing checks: 1,496 tests across 87 files, corpus/build, both embed formats,
  workbench/review Listen, offline audio and Node package smoke passed. Goldens
  reproduced byte-identically after rebase; the implementation worktree was
  retired before the item moved to `complete/`.

### Item 9 — independent MuseScore MIDI oracle (2026-09-09)

- The user selected MuseScore CLI. Official Studio 4.7.5 is installed user-locally,
  with its AppImage digest pinned. No runtime audio or npm dependency was added.
- The three-score experiment preceded the full baseline: tuplets matched at
  480 PPQ, simple voltas produced six versus four attacks, and D.S. al Fine
  produced five versus seven. MuseScore import receipts locate missing jump
  objects and zero-length grace playback. External behavior is evidence, not
  automatic authority to change a convention.
- The baseline is **22/27 W3C observable strict matches**, beside the engraving
  oracle's 24/27; **0/4 converter fixture matches**. The latter exposes separate
  sounding notation/TAB parts and, in two fixtures, chord accompaniment. These
  extra attacks are retained as input/interpretation discrepancies. All nine
  mismatches have pinned attribution; the advanced-volta internal cause remains
  unresolved after localization to external playback/export.
- Strict timing uses 1/64 quarter tolerance. Interpretive measures and alignment
  gaps split timing; only independently unique matching content can re-anchor.
  Bar fingerprints must also be unique inside other bars. Identical/silent bars
  stay unobservable, and coverage counts expose exclusions and unmatched notes.
- Independent raw MIDI and five imported-score receipts carry version/input/hash
  provenance. Normal tests replay those recordings and fail on report movement
  in either direction; the explicit live check re-runs the actual executable.
- No item-3 convention changed: ordinary external gates end one tick early, while
  our full gate remains intentional. No noncentral pitch bends were exported,
  so no guitar-curve agreement is claimed. The [contract](../../docs/player-midi-oracle.md)
  records unsupported coverage and the experiment's later-than-proposed timing.
  No scenario golden or human approval changed.

- Landing checks: 1,506 tests / 89 files, corpus/build, strict harness typing, and
  reproducible live MuseScore capture all passed. Scenario goldens are unchanged;
  the implementation worktree was retired before closing the roadmap item.

### Item 10 — unrolled engraving (2026-09-09)

- Written state is resolved before traversal metrics are copied; every visit has
  independent geometry without expanding or rewriting MNX. Repeated unchanged
  time signatures are not restated. Reference resolution uses actual contiguous
  visits, including the one adjacent pair that a cross-jump tie can join.
- Occurrence `sourceId`s carry a separate written identity. Playback and clicks
  address the exact visit; JSON and editor selection still address the written
  note. Visual inspection caught a selection hull spanning repeated bars: each
  occurrence now earns its own enclosure.
- Partial-bar membership uses exact arithmetic promoted to the model floor,
  retaining the audio export. Pickup lengths, crossing notes and end-of-bar
  steal-previous graces must agree with the compiler's half-open clipping.
- The original 14 cases plus two later navigation regressions carry 18 new SVGs
  with an independent approval lifecycle and side-by-side presentation receipt.
  [Review debt](lab-verify.md#unrolled-engraving--2026-09-09) remains human-owned;
  existing written goldens and approval records are unchanged.
- Browser checks cover route/toggle state, exact visit seeking, all-copy selection,
  playback paint without relayout and excluded partial-note activation/reveal.
  The partial browser fixture is isolated from the workbench document provider,
  which correctly replaces ad-hoc changes to its subscribed viewer.

- Landing checks: 1,601 tests / 92 files, corpus/build, clean regenerated goldens,
  headless browser interaction/review and installed Node package smoke passed.
  Commit `a0fd152` was pushed and the implementation worktree retired before
  the item moved to `complete/`.
