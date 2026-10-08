# Instrument host contract: `mnx-sound/1`

> **8 October 2026 — superseded in part by `mnx-sound/2`** (the synth's chain campaign, C9, C13, C14 — in the guitar-faust repository's `plans/`). Notes, controls, techniques, `lower()`, capabilities, conformance and the commit horizon are unchanged in meaning. The setup changed: parts carry an ordered `chain` of blocks (`{id, type, state: on|off, params}` (Bypass and Off were merged into Off on 8 October 2026)) and a `strip` (`levelDb, pan, mute, solo, sends`); the session carries `buses` (return buses such as the Room) and `master` (`volumeDb, ceilingDb`). Rig 3.0.0 wraps one setup with a name; earlier rigs are not imported. Tempo moved from the setup into the stream (a session-wide `tempo` control, §2.4). The schema is `web/contract/mnx-sound-2.schema.json`. **Moved into mnx-lab** as `synth/docs/contract.md` (core-campaign-synth); its history is in the guitar-faust repository.

Status: **agreed — signed off by the project lead on 7 October 2026 (all recommendations accepted, including the D13 reading).** Created 7 October 2026.
Part of the instrument host campaign (guitar-faust `plans/instrument-host-campaign.md`). Nothing here is
implemented yet. All decisions in §10 are *agreed*; changes from here on are recorded as new decisions.

This document fixes the data shapes, timing rules, fallback rule, versioning and
conformance format that Phases 1–8 build on. It also records what Phase 0 found in the
code that changes the plan's original proposals (§10 marks these as **revised** or **new**).

## 1. Shape of the system

```
event log (Setup + Notes + Controls)            ← mnx transport later; fixtures and studio now
        │  validate (strict on known fields, unknown fields ignored)
        ▼
InstrumentHost ── per part: instrument.plan(notes) → DSP control events
        │                    (native techniques)     (lower() for the rest, with diagnostics)
        ▼
part DSP → part gain/pan → insert chain (rack 3.0.0) ─┬─ dry ─────────────┐
                                                      └─ send → room bus ─┴→ master → ceiling
```

Same code in the AudioWorklet, in Node and offline. Native C++ stays guitar-only (D14).

## 2. Data types

All objects are plain JSON. Times are seconds (D5). Unknown fields are ignored on read and
preserved on round trip. Known fields are validated strictly; a bad value rejects the
object with an error naming its id.

### 2.1 Setup

```js
{
  contract: 'mnx-sound/1',
  session: {
    tempo: {bpm: 96},                  // only for tempo-synced effects (echo division); not a clock
    room: {enabled, mix, decay, predelay, damping, width},   // today's room layer, unchanged ranges
    master: {gainDb: -3}               // the existing .97 ceiling stays after master gain
  },
  parts: [{
    id: 'gtr',                         // unique within the setup; [A-Za-z0-9_-]{1,64}
    instrument: {
      kind: 'plucked',                 // D1: 'plucked' | 'keys' | 'kit'
      design: 'rounded-steel',         // factory id, or an inline design object of that kind
      layout: {                        // plucked only; default = standard 6-string guitar
        strings: [{pitch: 64}, {pitch: 59}, {pitch: 55}, {pitch: 50}, {pitch: 45}, {pitch: 40}],
        capo: 0
      }
    },
    inserts: {…},                      // today's effects layer (drive/vibrato/tremolo/echo + switches)
    player: {…},                       // optional today's player layer (D10); default disabled
    send: 1, levelDb: 0, pan: 0, mute: false,
    seed: 20261004                     // noise/humaniser seed; default derived from part id
  }]
}
```

- `layout.strings` is **positional**: index 0 is string 1, the first tab line, nearest the
  floor (D3). `pitch` is the open sounding MIDI pitch before the capo. Fractional pitches are
  allowed for alternate temperaments. 1–6 strings this campaign (D7).
- Pan is a balance law with unity gain on both sides at centre (pan 0 must be bit-transparent).

### 2.2 Note

```js
{
  id: 'n12',                // unique per session; schedule() upserts by id
  part: 'gtr',
  at: 1.25,                 // onset, seconds on the host clock (D5)
  duration: 0.5,            // seconds, > 0
  velocity: 0.7,            // 0–1 (mnx sends velocity/127)
  target: {pitch: 64.0},    // sounding MIDI pitch (fractional = microtonal), or {piece: 'snare'} for kit
  fingering: {string: 1, fret: 0},   // optional, plucked only; string is positional (D3)
  techniques: [ … ],        // optional, §2.3; order irrelevant; at most one of each type
  nuance: {                 // optional, D16: performer micro-variation; never diagnosed
    intonationCents: 0.4, attackBendCents: 1.2,
    excitation: {positionDelta: .01, hardnessDelta: 0}
  }
}
```

- `target.pitch` is the **sounding** pitch, as in mnx (capo and tuning are already applied).
  For `plucked`, `fingering` chooses the string. If `fingering.fret` disagrees with
  `pitch − open − capo` by more than 1 cent, pitch wins, the fret is recomputed and a
  `fingering-mismatch` diagnostic is emitted. Without `fingering`, the plucked voice policy
  picks a string (lowest fret that keeps the string free, then lowest string number).
- Overlapping notes on one plucked string follow today's latest-pluck ownership: a newer
  pluck takes over the string, and older trajectories never return.

### 2.3 Techniques (intent level)

Curve points are positioned as **fractions of the note** (0 = onset, 1 = end). Gesture
timings that are physiological rather than metrical are in **seconds/Hz** (D5 revised).
Cross-note references point **backwards only** (to an earlier-onset note id).

| `type` | Fields | Meaning |
|---|---|---|
| `bend` | `points: [{at, cents}]` (≥ 1, `at` ascending in [0, 1]) | Pitch offset from the target, linear between points, held after the last point. Pre-bend = non-zero first point; release = a return point. |
| `vibrato` | `depthCents`, `rateHz`, `start?` (fraction, 0), `delaySeconds?` (0), `fadeSeconds?` (0.2), `phase?` (radians, 0) | Sinusoidal pitch modulation, faded in linearly after `start·duration + delaySeconds`. |
| `slide` | `direction: 'in' \| 'out'`, `cents?` (∓200), `span?` (fraction, 0.25), `fretted?` (false) | Slide in: glide from `cents` to 0 over the first `span`. Slide out: glide from 0 to `cents` over the last `span`. `fretted` steps in semitones. |
| `legato` | `from: noteId`, `via: 'hammer' \| 'pull' \| 'slide'`, `glide?` (fraction, 0.1, slide only) | Continue the earlier note's string without a new pluck. For a slide, pitch glides from the previous pitch. |
| `mute` | `kind: 'palm' \| 'dead'`, `amount?` (0–1, 0.5, palm only) | Palm: partial finger damping for the whole note. Dead: no pitched attack, immediate damping. |
| `harmonic` | `kind: 'natural' \| 'artificial' \| 'pinch' \| 'tap' \| 'semi' \| 'feedback'` | The sounding pitch is the target. Lowered on every kind this campaign (non-goal). |
| `letRing` | — | Do not damp at note end. The string, key or piece rings until re-struck, choked or muted. |

These cover every instrument technique mnx's `expression.ts` handles today (bend, vibrato,
slide in/out/shift/legato, hammer/pull, palm mute, dead, harmonic). Musical timing and
dynamics stay in mnx: accents, staccato, dynamics, arpeggio rolls, swing and tremolo picking.

**`mnx-sound/2` — chord gestures (chain campaign C18).** How a chord is played is part of the
stream, as Guitar Pro's brush/arpeggio and MNX's `arpeggio` say it:

```js
{id: 'e1', part: 'gtr', at: 2.0, duration: 1, velocity: .8, target: {pitch: 40},
 gesture: {id: 'chord-7', type: 'strum', direction: 'down', spreadSeconds: 0.05}}   // one per member
```

- Members are the notes of one part that share `gesture.id`, the written onset and the gesture.
  Member k of N, in the order the gesture meets them, starts `spreadSeconds`·k/(N−1) late and keeps
  its written end (at least half its written length).
- `strum`: `direction` is the **stroke**. `down` runs from the highest-numbered string towards
  string 1 (a standard guitar: low to high pitch; a re-entrant ukulele: string 4, the high G,
  first). This is Guitar Pro's stroke direction.
- `roll`: `direction` is the **pitch**, as MNX's `arpeggio` (`up` rises). Guitar Pro's
  `<Arpeggio>Up</Arpeggio>` is an upstroke, i.e. an MNX `down` roll (mnx-lab's converter already
  maps it that way).
- The plucked instrument plays gestures natively, in the order of the strings it assigned. Other
  kinds are timed by pitch in the host; a strum there is reported `approximated`.
- Members that disagree with the others (`gesture-mismatch`) or name an unknown gesture type
  (`unknown-gesture`) play as written. Validators reject a group that spans parts or differs.

### 2.4 Control

```js
{id: 'c3', part: 'keys', at: 4.0, type: 'sustainPedal', value: 1}   // 0–1; ≥ 0.5 = down for basic keys
{id: 'c4', part: 'gtr',  at: 9.0, type: 'mute', value: true}        // part mute, click-free
{id: 't1',               at: 0.0, type: 'tempo', bpm: 96}            // mnx-sound/2: session-wide, no part
```

**`mnx-sound/2`:** `tempo` is session-wide and names no part. The stream carries the tempo
(C16), and tempo-synced blocks (the echo's time in beats) follow it from the control's exact
frame. Before the first tempo control the tempo is 120 bpm (`DEFAULT_BPM`). The setup has no
tempo of its own.

Controls upsert by id like notes. New control types are added the same way as techniques.
Unknown types are ignored with a diagnostic (D11).

### 2.5 Capabilities

Each instrument kind publishes:

```js
{kind: 'plucked', contract: 'mnx-sound/1', revision: 1, basic: false,
 targets: 'pitch', range: {pitch: [lowest open, 88]},
 techniques: ['bend', 'vibrato', 'slide', 'legato', 'mute', 'letRing'],   // natively rendered
 controls: ['mute'], primitives: ['pitchCurve', 'gate', 'velocity', 'damping'],
 horizonSeconds: 0.1}                                                      // D15
```

`keys`: `techniques: ['letRing']`, `controls: ['sustainPedal', 'mute']`,
`primitives: ['gate', 'velocity', 'damping']`, `basic: true`. `kit`: `targets: 'piece'`,
`pieces: […]` (D8), `techniques: []`, `primitives: ['gate', 'velocity', 'damping']`, `basic: true`.

### 2.6 Diagnostics

`{code, severity: 'info' | 'warning' | 'error', noteId?, controlId?, part?, at?, message}`.
They are emitted by validation, `lower()`, the voice policy and the host (late notes, voice
stealing, unknown ids). Codes form a stable, documented list. Hosts de-duplicate them per
(code, id).

## 3. Fallback rule: `lower()`

`lower(note, capabilities, {resolve}) → {note, primitives, diagnostics}`. It is pure and
deterministic. `resolve(id)` returns an earlier note (for `legato.from`).

1. Native techniques (listed in `capabilities.techniques`) pass through untouched.
2. Other **known** techniques are reduced to core primitives the instrument supports:
   - `pitchCurve` (cents over note fractions)
   - `gate` (duration multiplier or extension)
   - `velocity` (absolute change)
   - `damping` (0–1 at a fraction of the note)

   Each reduction emits an `approximated` (info) diagnostic naming the note id and technique.
   A primitive the instrument lacks is dropped with a `dropped` (warning) diagnostic.
3. **Unknown** technique types are ignored with `unknown-technique` (warning). Nothing ever throws (D11).

Lowering table: it reproduces today's mnx `expression.ts` flattening, so a generic host matches current mnx playback.

| Technique | Primitives |
|---|---|
| bend, slide | pitchCurve (exact shape) |
| vibrato | pitchCurve sampled at `rateHz·32` points per second |
| legato | resolved previous note gated to this onset; velocity −25/127 (hammer/pull) |
| mute palm | gate ×3/5, velocity −15/127, damping `amount` from 0 |
| mute dead | gate ×1/8, velocity −20/127, damping 1 |
| harmonic | velocity −10/127; `timbre: ['harmonic']` hint |
| letRing | gate extended to at least 2 s; damping removed |

`kit` lowers every pitch technique to nothing (`dropped`). `nuance` is never lowered or
diagnosed: an instrument either uses it or ignores it.

## 4. Versioning

- The document tag is `contract: 'mnx-sound/1'`. The major version changes only for
  incompatible meaning changes. Adding a technique, control, field or piece is **not**
  breaking, because unknown things are ignored or lowered.
- Instruments advertise `revision` (an integer, +1 per additive change) so a sender can tell
  whether a technique will render natively or be lowered.
- Instrument designs, layouts, part rigs and sessions have their own `schemaVersion` with
  migrations (§9). The contract never embeds DSP control names.

## 5. Time, frames and batching

- **Clock.** `at` is seconds on the host clock: AudioContext time live, or seconds from
  render start offline. Float64.
- **Frame rule.** Every host converts with `frame(t) = floor(t·rate + 0.5 + 1e-6)`, never
  `Math.round(t·rate)`. Evidence: today's planner rounds the integer ratio
  `onset_frame·rate/48000`. Converting through float seconds puts 6 reference note edges at
  44.1 kHz (exact half-sample ties) one frame early. The snapped rule matches today's
  rounding for all 338.6 M (source rate, target rate, frame) pairs over 10 minutes
  (44.1/48/96 kHz).
- **Commit horizon (D15).** An instrument's output at time *t* may depend on notes up to
  `horizonSeconds` after *t*. Plucked's is 0.1 s: live thwack sizes each transient's fade
  from the next pluck on the same string (`THWACK_SETTLING`), and ownership cuts trajectories
  at the next onset. Every `schedule()` batch therefore carries `through`: "complete up to
  this time".
  - **Offline:** renders only up to `through − horizon`. That makes all-at-once, lookahead
    batches and cancel/seek render identically **by construction**.
  - **Live:** a note arriving inside the horizon still plays, with a `late-note`
    diagnostic, and invariance is not promised for it. The mnx transport's 0.1 s lookahead
    is too tight for this, so the integration should use ≥ 0.25 s.
- **Edits.** A note or control can be upserted or cancelled while its `at` is after
  `committed = now + horizon`. Later edits are rejected with `late-edit`, and the
  scheduled version plays.

## 6. Host API (Phase 2)

```js
host.configure(setup)                       // validates, migrates designs, loads DSP; diff-applies on reconfigure
host.schedule({notes, controls, through})   // upsert by id; returns diagnostics
host.cancel({from} | {ids}, silence?)       // drop notes/controls with at ≥ from (or by id); started notes keep playing.
                                            // silence: true also cuts notes sounding at `from` (gate end only; curves keep
                                            // their timing) — mnx Sink seek/stop semantics, outside the invariance promise
host.now()
host.on('meter' | 'diagnostic' | 'sounding', fn)   // 'sounding' acknowledges note ids as they start
host.dispose()
renderOffline(setup, {notes, controls}, {rate, seconds?, batches?}) → {audio, labels, diagnostics}
```

## 7. Golden equivalence (built in Phase 1, before any internals change)

- **Reference.** Today's code path, driven in Node:
  1. `rigPlan` → `instrumentPlanV2` builds the packet.
  2. `web/audio/processor.js` renders it with stubbed worklet globals: `LiveThwackEngine` +
     `EffectsEngine` rack 2.0.0, gain ramps, fades and the .97 ceiling, with 128-frame blocks.

  SHA-256 of each Float32 stereo output is stored in `tests/golden/engine2-2.0.0.json`,
  captured from the baseline tag.
- **Cases.** 150 renders:
  - 10 factory designs × full passage × 44.1/48/96 kHz × {default rig, full rig (player on,
    all four pedals, room on)}: 120 renders.
  - Plus, at 48 kHz, the accents, fingerpick, strum and six single-string passages for every
    design.
- **Candidate.** The same passages become contract notes:
  - string `s` → `fingering.string 6−s`
  - `pitch = openMidi + fret`
  - `performed_velocity` → `velocity`
  - vibrato fields → `vibrato` technique
  - intonation, attack bend and position/hardness deltas → `nuance`

  They render through `renderOffline` with the standard layout, then are compared hash for
  hash. Old path and new path coexist until it passes. The player layer runs before
  conversion (D10), so both sides share the same performed take.
- **Invariance.** The same cases also run in 16- and 128-frame blocks, and as
  all-at-once vs 0.5 s batches vs batches with a cancel and re-schedule.

## 8. Conformance fixtures

```js
{
  contract: 'mnx-sound/1',
  fixture: {id: 'plucked-techniques', description: '…'},
  setup: {…},
  batches: [{through: 4, notes: […], controls: […]}, {cancel: {from: 3}}, …],   // or plain notes/controls
  render: {rate: 48000, seconds: 8},
  expect: [
    {kind: 'pitch', note: 'b1', curve: 'commanded', toleranceCents: 15, maxCents: 35},
    {kind: 'noNewAttack', note: 'h2'},
    {kind: 'decayRatio', note: 'pm1', reference: 'open1', max: 0.5},
    {kind: 'silentWithin', note: 'x1', seconds: 0.08, belowDb: -40},
    {kind: 'activeStrings', part: 'uke', count: 4},
    {kind: 'peakBelow', dbfs: -0.3},
    {kind: 'diagnostic', code: 'approximated', note: 'harm1'}
  ]
}
```

- **Batches** apply in order. Within a batch the `cancel` applies first (as a seek does): notes
  and controls at or after `from` are removed. Notes that started earlier keep playing; cutting
  them would rewrite sound already committed (curve points are fractions of the note). Then
  notes and controls upsert by id. An id may appear only once per batch. `effectiveEvents()`
  gives the resulting event set, which is what an all-at-once schedule of the same log contains.
- **Expectation kinds** form a closed list owned by the conformance kit (`web/contract/conformance/`).
  `format.js` documents exactly what each kind measures.
- **Measured pitch.** Port the NumPy estimator (now `scripts/pitch_estimator.py`)
  to JS, cross-checked against the Python original. Track in 40 ms windows. Skip 30 ms after any
  attack and windows where the commanded slope exceeds 50 cents per window.
- **Proposed tolerances**, to be calibrated in Phase 3 against steady notes (which must
  measure within ±3 cents) before they are finalised:
  - pitch: median ≤ 15 cents, maximum ≤ 35 cents
  - palm mute: time to −40 dB ≤ 0.5× the same note unmuted
  - dead note: below −40 dB within 80 ms
  - legato: onset flux ≤ 0.25× a plucked onset of the same pitch
- **Fixtures** (Phase 1):
  - plucked technique study
  - ukulele layout (G4 C4 E4 A4, reentrant)
  - keys pedal study
  - kit study with hi-hat chokes
  - short multi-part mix

## 9. Formats and migrations

| Format | Today | Campaign | Migration |
|---|---|---|---|
| Plucked design | preset schema 2, 6 per-string records, `setup` arrays of 6 | design schema 3: register curves keyed by open pitch, optional per-string overrides | Anchors at 40/45/50/55/59/64 carry the exact old values. At an anchor the curve returns the stored value with no arithmetic, so the standard layout is exact. Between anchors: linear in MIDI. Outside: clamped. |
| Per-string tuning cents | `strings[i].tuningCents` | design `detuneCents` curve (instrument imperfection); nominal tuning comes from the layout | Same anchors |
| Rig | rig 1.3.0 (`instrument`, `layers{player,effects,room}`) | rig 2.0.0: `{session:{room,master}, parts:[{instrument, inserts, player, send:1, …}]}` | room → session.room, send = 1, effects → inserts. 1.3.0 files keep loading; tested. |
| Effects rack | 2.0.0 (one module) | 3.0.0: insert chain + room bus | Single part with send 1 must be bit-identical to 2.0.0 (Phase 2 test) |
| Engine1 sounds, saved Engine2 sounds | unchanged | unchanged readers; Engine2 schema-2 sounds migrate to design schema 3 on load | Migration tests per version |

## 9a. Plucked rendering notes (Phase 3, implementation choices within the agreed decisions)

- **Palm mute.** The stage-5 string multiplies its loop gain every period by `m + (1 − m)·sustain`, so
  sustain is solved per note for a target decay of `min(0.05 + 0.9·(1 − amount)², (0.15 + 1.2·(1 − amount)) s / decay)`
  of the free string's. A linear mapping damps almost at once.
- **Free-ringing strings** ignore finger damping. A muted note finger-mutes its string, and the next unmuted
  pluck there restores the design's setting. Let ring changes nothing on a free string, which already rings
  after note-off.
- **Hammer-on/pull-off** glides from the previous pitch over 5 ms with a frequency event every sample.
  Jumping the waveguide's delay length clicks: an instant jump gave 20× the high-band energy of a real pluck.
- **Event grids.** Plain and vibrato notes keep the pre-host 200 Hz frequency grid (golden). Notes with bend,
  slide or slide-legato curves use 1 kHz.
- **Dead notes** pluck with the string finger-muted from the start.
- **String conflicts.** Two plucks on one string less than two samples apart cannot both sound. The later one is
  dropped with `retrigger-conflict`, an additive diagnostic code.
- **Saved tunings.** A saved schema-2 sound whose open pitches are not ascending by string index now gets
  pitch-ordered DSP slots (D3). Its per-string values stay exact, but the hidden slot dispersion law moves with
  the slot. No factory design is affected.

## 10. Decisions register (agreed 7 October 2026)

| # | Decision | Proposal | Change from plan |
|---|---|---|---|
| D1 | Kind names | `plucked`, `keys`, `kit` | — |
| D2 | Name, version, location | `mnx-sound/1` in `web/contract/` (plain JS + `.d.ts`), major-only tag, additive `revision` per instrument (§4) | Adds `revision` |
| D3 | String numbering | **Positional:** 1 = first tab line (nearest the floor). The layout lists each string's pitch, so for non-reentrant tunings 1 = highest-pitched. Internally, active strings take the **top N DSP slots in ascending open pitch**: standard guitar → slots 0–5 exactly as today; reentrant ukulele C,E,G,A → slots 2–5; slots below are parked. | **Revised.** "Highest-pitched" is ambiguous for reentrant ukulele (string 4 = high G). The slot rule matters because the DSP has a hidden per-slot law, dispersion × (1 − 0.06·slot), in both `guitar.dsp` and `instrument-stage5.dsp`. |
| D4 | Tuning authority | Layout (strings, pitches, capo) from the score; note `pitch` is sounding pitch and wins over `fret`. The design owns tone, small per-string detune (`detuneCents` curve) and fret intonation (setup curves). | Clarifies where `tuningCents` and setup arrays go |
| D5 | Time units | Seconds (float64) on the host clock; the snapped frame rule (§5). Curve **points** are fractions of the note; gesture **timings** (vibrato delay/fade/rate, attack-bend decay) are seconds/Hz. | **Revised.** Today's player vibrato starts after 0.18 s and fades over 0.2 s regardless of note length, and mnx curves are absolute offsets too. Fractions alone could not express either. |
| D6 | Room | Shared room bus (rack 3.0.0); rig split into part rig + session. The room's dry duck `(1 − 0.35·mix)` stays on the **master sum**, as today. | Keeps single-part bit identity. Note: with several parts every dry signal is ducked by the room mix, whatever its send; revisit after the campaign. |
| D7 | String count | Parked strings: `free_ringing 0`, `sustain 0`, never triggered. That gives bridge weight 0 (no loading, no sympathy). CPU unchanged. Weights stay √(1/6) and are not renormalised, so a 4-string layout has less total bridge loading. | Mechanism confirmed in `instrument-bridge.dsp` |
| D8 | Kit vocabulary | `kick`, `snare`, `side-stick`, `tom-high`, `tom-mid`, `tom-low`, `hihat-closed`, `hihat-open`, `hihat-pedal`, `crash`, `ride`. A `pieceFromGm(n)` helper maps GM numbers 35–59; unmapped → silent + `unknown-piece`. Choke group `hihat`: closed/pedal cut open. | Adds `side-stick` and the GM helper (mnx resolves kit sounds to MIDI numbers) |
| D9 | Basic quality bar | Correct behaviour, bounded levels, cost ≤ 25% of one plucked part; `basic: true` in capabilities and UI | — |
| D10 | Player layer | Today's `perform()` stays an optional per-part humaniser for standalone use and data generation, bypassed for score playback. It emits ordinary notes with `vibrato` + `nuance`, so its output is itself a valid event log. Guitar-only fields (strum spread) apply only to `plucked`. | Output defined as contract data |
| D11 | Unknown techniques | Lowered if known, otherwise ignored + `unknown-technique`; never throw. The same applies to controls and pieces. | — |
| D12 | `classic.html` / Engine1 | Retired after Phase 6 (lead, 7 Oct 2026); Engine1 sounds still convert explicitly | Revised |
| D13 | Performance budget | Native ≥ 10× end-to-end (stretch 20×); browser offline ≥ 5× per workload; multi-part session ≥ 5× (stretch 10×); live tracked, not gating; keys/kit ≤ 25% of one plucked part. Minimums over repeated trials. | Reading confirmed by the lead |
| D14 | Native renderer | Guitar-only; parity checks unchanged | — |
| D15 | Commit horizon | **New.** Instruments declare `horizonSeconds` (plucked 0.1 s); batches carry `through`; offline renders lag by the horizon; live late notes play with `late-note`; mnx lookahead ≥ 0.25 s at integration. | Needed for batching invariance; live thwack depends on the next pluck |
| D16 | Performer nuance | **New.** Optional `note.nuance` (intonation cents, attack bend cents, excitation deltas): never diagnosed, never lowered, ignored by kinds that cannot use it. | Golden equivalence needs it: today's take carries per-note intonation, attack bend and position deltas |
| D17 | Synth packaging | **New (lead, 7 Oct 2026).** Separate repository and deployable configuration app plus a versioned headless library; mnx-lab consumes the library and never edits instruments or rigs. Rig 2.0.0 JSON is the hand-over format. | Replaces "move into `mnx-lab/synth`" |
| D18 | Pedalboard studio | **New (lead, 7 Oct 2026).** Replaced by the synth app rather than extended | — |

## Appendix A. Runtime assets versus research data (Phase 0 inventory)

| Path | Needed by | In git? |
|---|---|---|
| `web/*.html`, `web/studio/`, `web/audio/`, `web/model/` | studio and classic pages | yes |
| `web/generated/` (5 MB) | published WASM for Engine1, Engine2 rack and guitar, probes | yes |
| `web/data/instrument-v2/` | Engine2 factory designs, engine metadata, history | yes |
| `web/data/{engine,presets,performance}.json` | Engine1 legacy sounds, reference performance (studio `legacySounds()` and `start()`) | yes |
| `web/data/dry-comparison/report.json` | `comparison.html` research page | yes |
| `web/data/dry-comparison/*.wav`, `web/data/instrument-model/` (592 MB) | research comparison pages only | **ignored** |
| `build/{instrument-v2,attack-trials,instrument-v2-live}/dsp-snapshot/` | DSP sources the published Engine2 was compiled from (`dsp/` plus scripted transforms) | force-tracked |
| `build/instrument-stage{5,6}/guitar.{wasm,json}`, `output/instrument-model/baseline-1.4.0/web/data/*.json`, `output/*.automation.tsv` | unit-test fixtures | force-tracked |
| rest of `build/` (770 MB), `output/` (13 GB), `references/` (2 GB) | rebuildable outputs, renders, reference recordings | ignored |

A fresh clone of `baseline-pre-host` passes `npm test` (142 pass, 0 fail). Native and browser
checks rebuild their own outputs.
