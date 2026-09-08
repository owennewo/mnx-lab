# Campaign: the player — a reviewer hears what the score asserts

> **A campaign** (see CLAUDE.md → Conventions): this doc is an index over many normal
> proposals, the shared contract they follow, and the running log of progress and
> learnings as items land. Indexed items are ordinary `core-*` (and one `studio-*`)
> proposals that name this campaign. **Opened 2026-09-08; nothing built yet.**

## The goal

**First, for the reviewer.** A scenario's engraving says what the music *looks* like; a
player says what it *means* — which bars are performed, in what order, how many times,
at what pitch and when. Today a reviewer verifying `repeats-alternate-endings-advanced`
approves an SVG and takes the traversal on trust. The campaign ends when the review
page can play the scenario, the cursor knows which pass of a repeat it stands on, and
the performed order is a golden the harness checks on every commit.

**Then, for practice.** Studio's practice features — loop a selection, slow it down,
count in, mute a part — are follow-up items in the index, not a second campaign. They
inherit the transport, the pass-aware cursor and the string-per-voice sound the reviewer
items build, and none of them is started until the reviewer items are verified.

Playback is **not in the spec loop** for now. Items will find spec gaps (there is no
coda or D.C. vocabulary; grace steal timing is loose) and record them in the log below;
filing a `spec/proposals/` topic is a separate human decision.

## What is true today

- `src/audio/mnxToAudio.ts` (74 lines) walks events into beat offsets and Tone-style
  pitch names. Nothing in the app imports it; it is exported as `mnx-lab/audio` only. It
  handles no ties, tuplets, grace, repeats, tempo marks, dynamics or transposition.
- The pre-rebuild tag holds a working Lit controller over Tone.js
  (`git show pre-rebuild:src/controllers/PlaybackController.ts`): PolySynth, Transport
  scheduling in ticks, a `setInterval` playhead. It is a reference, not a starting point
  — it made Tone's Transport the timeline, which is the design this campaign rejects.
- **No traversal exists anywhere.** `engine/layout/repeats.ts` and `endings.ts` draw
  the signs; nothing computes the performed order. 14 corpus scenarios carry repeats,
  endings or jumps; 6 carry tempo marks.
- The layer order already reserves the slot: `audio` is a peer of `engine` over `model`,
  and `elements` may import it (`.dependency-cruiser.cjs`). `audio` must stay
  Node-importable — no DOM or AudioContext at module top level.
- The viewer already emits a note id on click and takes a set of note keys to highlight,
  so cursor sync has its hooks. Keys are per written note (`model/noteKeys.ts`); nothing
  distinguishes pass 1 of a note from pass 2.
- [core-display-settings.md](core-display-settings.md) defers "current verse" to a
  playback/repeat context that does not yet exist. Item 2 is that context.

## The shape — three decisions, taken 2026-09-08

**1. The performance is MIDI-shaped: ticks at a fixed PPQ plus a tempo map.** The
compiler emits an unrolled, pass-numbered list of note events in ticks, with sounding
pitch, velocity, pitch curves and the written note each came from. A separate pure
function turns ticks into seconds through the tempo map, at play time, so tempo scaling
is a scalar. This is the golden, and it serialises losslessly to a standard MIDI file —
which gives an independent oracle (MuseScore and Verovio export MIDI from the same
MusicXML fixtures), a portable artifact a reviewer can open anywhere, and a second
output path later (WebMIDI out is a small adapter over the same events).

**2. Tone.js is a renderer, not the model.** The old controller was half right: musical
time, not seconds, is the primary axis. What went wrong is the other half. Tone's
Transport is linear, so repeats have to be unrolled before anything reaches it, and once
that code exists it owns the timeline. Tone needs an AudioContext, and the harness is
Node — anything expressed as Tone objects has no golden and no test. And tuplets and
grace encoded in Tone's time strings are a DSL nothing else can read. So Tone's job
shrinks to: take events in seconds, schedule them with lookahead, expose play/pause/seek/
loop, fire a callback per event for the cursor. That is what it does well, and the
campaign keeps it for exactly that, loaded lazily on first play.

**3. One voice per string, from the start.** Tone's PolySynth and Sampler cannot bend
one voice inside a chord, and a bent note inside a chord is ordinary guitar writing. The
MIDI answer is one channel per string, because pitch bend is per channel; the Tone
answer is one mono synth per string with its own detune signal. The same architecture
in both worlds, so the campaign commits to it even for the reviewer cut: parts that
declare `strings[]` play string-per-voice, honouring the model's authoritative string
choice; everything else plays pitch-only. The audible difference between string choices
is itself a verification aid for tab scenarios.

**Where MIDI runs out** is timbre semantics — harmonics, palm mute, vibrato have no MIDI
meaning. The compiler resolves them into pitch, velocity, duration and bend curves
before emission, so the golden asserts what the music *sounds like*, not what the score
*says*. That is a different kind of verdict from the primitives, recorded here so no
item mistakes one for the other.

## The shared contract

**No item writes code before its agreement block is written down.** Each indexed
proposal opens with, and is reviewed on:

1. **Pure before audible.** Every musical decision — order, timing, pitch, velocity,
   curves — lives in `model/` or `audio/` as a pure function with a golden or a
   conformance test that runs under Node. Nothing about correctness lives in the Tone
   adapter. An item that can only be checked by ear has not found its test yet.
2. **Ticks, not seconds.** Musical time is integer ticks at one PPQ for the whole
   campaign; seconds are derived at play time through the tempo map. No item stores a
   second in a golden.
3. **Identity is pass-qualified, and the edit cursor stays written.** Every performed
   event names its written note key **and** its pass. Highlight, cursor sync and
   click-to-seek use the pair. The editor cursor remains a rhythmic position in the
   written score (`edit/cursor.ts`), because a note edited on pass two is the same note
   as pass one; the pass is a view position layered over it, never a field on it.
4. **The proof, named first.** Visual items (unrolled view, pass labels) are proved by
   the primitives/SVG goldens and `/verify`, and register any moved batch in
   [lab-verify.md](../inprogress/lab-verify.md). Performance items are proved by the
   performance golden and, where the MIDI oracle can see the feature, by it. A new
   golden file hashes **separately** — `renderHash`'s file set is frozen
   ([docs/corpus.md](../../docs/corpus.md)), and adding to it would demote every
   approval at once.
5. **The dependency budget: Tone.js, and only Tone.js.** It is the one runtime
   dependency this campaign admits, confined to `src/audio/tone/` by a
   dependency-cruiser rule, loaded lazily, never imported by `engine/headless.ts` or
   any harness path. Anything else — a sample set, a MIDI parser, a synth library —
   argues its case in this doc first.
6. **Spec findings go in the log, not upstream.** Playback is out of the spec loop.
   An item that finds MNX underspecifies a performance rule states the convention it
   chose and why, here, under *Learnings*. Filing a proposal is the human's call.
7. **Reviewer gain, stated.** Each item says what a reviewer can do after it that they
   could not before. An item with no answer is a studio item and is ordered after the
   last reviewer item.

## The index

Traversal first, because everything consumes it and it can be verified by eye through
the ordinary golden flow before any sound exists. Items 2 and 3 are independent of each
other and of the sound-source decision, so they can run in parallel worktrees once
item 1 lands. Item 5 (the spike) can run at any time and should run before item 6.

| # | Item | Scope | Serves | Proof | Status |
|---|------|-------|--------|-------|--------|
| 1 | [Traversal](core-player-traversal.md) | `model/traversal.ts`: global measures → performed order with pass numbers and partial-measure bounds. Repeats with counts, implied start repeats, voltas incl. open, segno, Fine, D.S. and D.S. al Fine. Cycle guard with a diagnostic. | reviewer | committed corpus report + hand-stated orders for the 14 navigation scenarios | proposed |
| 2 | [Pass-aware cursor](core-player-pass-cursor.md) | The session carries a pass; the chip ladder shows "pass 2 of 3" and lets the user change it; a measure not performed on the chosen pass says so. Resolves the current-verse hook. | reviewer | session conformance tests; no golden moves | proposed |
| 3 | [Unrolled view](core-player-unrolled-view.md) | A toggle on any of the three views that lays out the traversal's order instead of the document's: repeat signs and brackets dropped, pass labels drawn, pass-qualified note keys, cross-highlight mapping every occurrence back to its written note. | reviewer | opt-in `expected.unrolled.svg`, hashed separately, through `/verify` | proposed |
| 4 | [Performance timeline](core-player-performance.md) | `audio/performance.ts`: the compiler. Ticks at PPQ 960, tempo map, ties merged, nested tuplets, grace steal modes, tremolo subdivision, fermatas, sounding pitch (transposition inverted, clef octave, ottava), fixed velocity. Plus the MIDI file writer. | reviewer | `expected.performance.json`, opt-in, hashed separately | proposed |
| 5 | [Tone.js spike](core-player-tone-spike.md) | Research only: does `tone` import under Node; can Offline render there; does a mono synth's detune ramp cleanly for bends; scheduling in our seconds vs Tone's ticks; bundle cost and lazy load. Findings go in the log; the adapter's shape comes out of it. | both | its own findings section | proposed |
| 6 | [Transport and Tone renderer](core-player-transport.md) | `audio/transport.ts`, pure: state machine, tick↔seconds with a rate scalar, window queries, loop region, seek by (pass, measure, onset), injected clock and sink so it runs under a fake clock. `audio/tone/`: string-per-voice mono synths for fretted parts, PolySynth otherwise. | reviewer | transport conformance tests under a fake clock; the adapter has none | proposed |
| 7 | [Player element](core-player-element.md) | `<mnx-player>` in `elements/`: transport bar, position as measure/pass/beat, tempo scalar, volume. Wired to the viewer's highlight by pass-qualified key, auto-scroll, click-to-seek, and to the pass cursor. On the scenario page and the `/verify` review page; registered by the embed face. | reviewer | element census; manual | proposed |
| 8 | [Expression and technique](core-player-expression.md) | Dynamics → velocity, staccato/accent/tenuto, arpeggio stagger, and the guitar techniques as curves: bends, slides, hammer/pull, palm mute, vibrato, harmonics, laissez-vibrer. All in the compiler; carried as bend and CC in the MIDI file. | reviewer | performance golden; ear for what MIDI cannot see | proposed |
| 9 | [MIDI oracle](core-player-midi-oracle.md) | Someone else's code performs the same MusicXML: MuseScore's CLI or Verovio's MIDI output over the 27 W3C comparisons and the converter fixtures, diffed as note tables with tolerance. Baseline report committed; moving it either way is red. | reviewer | itself | proposed — **needs a dev-environment decision**: neither tool is installed |
| 10 | [WebMIDI out](core-player-webmidi.md) | A second sink over the same events: one channel per string, bend-range RPN, permission prompt. Never the default. | practice | the MIDI file is the same bytes | proposed — after 7 |
| 11 | [Sampled guitar](core-player-sampled-guitar.md) | A sampled instrument per string in place of the synth. The asset question (no R2; bundle, CDN or user-supplied) is the whole item. | practice | ear | proposed — after 7 |
| 12 | [Practice mode](studio-player-practice.md) | Loop a selection, speed trainer, count-in, metronome, mute/solo, persisted preferences. Studio's first player feature; also usable in the workbench. | practice | element census; manual | proposed — after 7 and 8 |

### Decisions still open

- **Unrolled view: toggle or fourth mode?** Drafted as a **toggle** applying to notation,
  tab and both (less work, less surface, no fourth deep-link vocabulary). Reopen only if
  the unrolled score turns out to want its own review target per view.
- **Grace and fermata defaults.** Item 4 picks conventions (a grace takes a fixed short
  value; a fermata multiplies by 1.5) and records them under clause 6. They are the
  numbers most likely to be argued with; the golden makes the argument cheap.
- **Repeats after a D.S.** The common convention is that repeats are not retaken after a
  jump. Item 1 adopts it and records it; MNX does not say.

## Progress + learnings

*(appended as items land — cause, what moved, what the next item should know)*
