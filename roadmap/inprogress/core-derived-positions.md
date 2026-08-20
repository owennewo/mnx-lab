# Derived positions — the extension adopts its own proposal

> **Status: in execution (2026-08-07). Stages 2 and 3 are built.** Stage 2 —
> the v5 reshape: schema, the v4→v5 upgrade hop, both converters, the corpus
> scores, the edit layer and the Worker prompt all speak the flat shape.
> Stage 3 — derivation hardening: `guitarPositions.ts` implements the
> authority ladder against the declared strings + capo (contexts threaded
> through both tab layouts), `validate.ts` raises the red `scope: 'tab'`
> issues (mismatch, undeclared string, unplayable annotated/bare), the silent
> clamp + `console.warn` are gone, and the edit layer's echo
> (`defaultStringFor`, `fingerboardMidi`) is capo-aware with the renderer's
> tie-break. The golden gate held at every step (primitives + SVG
> byte-identical; all suites green). Stage 4 scenarios are authored and
> rendered: the family landed as **`lab/22-tab-derivation/`** (renamed from
> the planned `22-derived-positions` so the ids ride the existing `lab/tab-*`
> category naming and rail group) — nine scenarios, goldens generated,
> awaiting the `/verify` sweep. The execution half of
> [spec-instrument-position.md](../proposed/spec-instrument-position.md): that doc designs what the *spec*
> should adopt and stays deliberately upstream-facing; this one migrates the built
> `_x.mnxLab` extension to the same shape, and gives the renderer a **specified
> derivation** so a document with no position annotations at all still renders valid
> tab. [docs/mnx-extensions.md](../../docs/mnx-extensions.md) records what is built
> today.

## The goal

Two moves, in order:

1. **Reshape the extension to the proposal's shape.** The string becomes the
   authoritative choice; the fret becomes optional and non-authoritative (validation
   only); fingering un-nests from the `tab` namespace.
2. **A derivation ladder with a default tuning.** When a note carries no string, the
   renderer assigns one from pitch alone — lowest playable fret — and when the part
   declares no strings, standard guitar tuning is assumed.

The contract in one sentence: **any guitar-range score renders playable tab;
annotations make it the *intended* tab.** "Playable but perhaps not the ideal
fingering" is the deliberate quality bar — see
[Why the assignment is presentation](#why-the-assignment-is-presentation-not-content).

## What exists (checked 2026-08-07)

- `resolveEventPositions` in
  [src/engine/tab/guitarPositions.ts](../../src/engine/tab/guitarPositions.ts)
  **already implements the fallback**: candidate frets per string, lowest fret wins,
  chords assigned highest-pitch-first to avoid string collisions, out-of-range pitches
  clamped with a `console.warn`. But it is an undocumented renderer courtesy, and
  promotion exposes its gaps: it hardcodes standard tuning (**never reads the part's
  tuning declaration**), ignores capo, and is pinned by no scenario.
- The extension stores `position: {string, fret}` with **both required**; both
  converters round-trip both fields losslessly.
- ~~The MusicXML importer writes written pitches, so the fallback derives 12 frets
  sharp~~ — **checked against the fixtures and found false** (2026-08-07, stage 3):
  MNX `pitch` in our documents is the **sounding** pitch. The MusicXML importer
  converts written→sounding on import (and back on export); `part.transposition` is
  display metadata that never enters fret arithmetic. Proof from data: Sun-did-glide
  (capo 4) stores C♯4 on open string 2 — declared open A3 + capo 4 — and the
  converter round-trip suites assert `midi(open) + capo + fret === midi(pitch)`
  across every annotated note. The fallback's remaining real gaps are the tuning
  declaration and the capo, not transposition.

## The authority ladder

| The note carries | The renderer does | Status of the result |
|---|---|---|
| `string` + `fret` | render the *derived* fret; if the stored fret disagrees, flag it | content, cross-checked |
| `string` only | derive the fret (arithmetic) | content |
| neither | assign string and fret by the default algorithm | **presentation** |

Two adjudications worth stating because they are the conflict rule from
[spec-instrument-position.md](../proposed/spec-instrument-position.md) made concrete:

- **A stored fret never wins.** When both are present and the derived fret differs,
  the derived fret renders and a red, `scope: 'tab'` diagnostic marks the note — a
  stored-vs-derived mismatch is one of the few signals that catches a broken importer,
  which is the fret's entire remaining job.
- **A derived assignment is never written back.** The document is unchanged; the
  guess lives only in the render, like default beaming. If the user (or the editor's
  string-mode cursor) makes a choice, *that* becomes content.

## The sounding-pitch rule — precondition #1, resolved

**MNX `pitch` is the sounding pitch.** That is how both converters write it (the
MusicXML importer converts written→sounding on import; `part.transposition` is
display metadata for notation and round-tripping, never a derivation input), and it
is exactly the proposal's forward-compatibility clause 3 — satisfied by our data
already. The implementation contract is therefore two lines:

```
effectiveOpen(s) = strings[s].pitch + capo            (both sounding; capo in semitones)
fret(note, s)    = semitones(pitch − effectiveOpen(s))  (printed capo-relative, by construction)
```

The worked example that motivated this doc is still the trap, one level up: "C4
resolves to string 5 fret 3" is true of C4 *read off a guitar staff* (written an
octave above sounding — written C4 sounds C3). In an MNX document, `{step: "C",
octave: 4}` is sounding C4 and resolves to string 2 fret 1. Anyone hand-authoring
tab scores from notation will hit this; the derivation must not try to compensate —
the fix belongs at authoring/import time, and our importers already do it. The
`prefersWrittenPitches` composition question stays upstream.

## The algorithm (v1, pinned by goldens)

Inputs: the effective string set (declared or defaulted, capo applied) and the
event's notes — sounding pitches throughout, per the rule above.

Per event: honor annotated strings first (they reserve their string even when other
notes in the chord are bare), then assign remaining notes highest-pitch-first; for
each, the candidate set is every unreserved string where the derived fret lands in
`[0, 24]`; **lowest fret wins**, ties broken by lower string number. A note with no
candidate gets a red `scope: 'tab'` diagnostic ("not playable on the declared
strings") and a placeholder — the current silent clamp + `console.warn` is replaced
by the forgiving-rendering system like everything else.

**Non-goals, recorded so they are decisions:** no position coherence across events,
no open-string preference, no hand-span model. Lowest-fret-greedy produces valid tab
that a player may re-finger, which is the stated contract. Better heuristics are
future work and land as **golden demotions reviewed through `/verify`** — the corpus
makes heuristic churn a visible review event instead of silent drift, which is a
feature, not overhead.

### Why the assignment is presentation, not content

"Encode the choice, not the consequence" cuts both ways: when the author made no
choice, the renderer's guess is presentation — the same category as default beaming
and stem direction. Consequences: the algorithm is **not** proposed as normative spec
text (at most a RECOMMENDED default upstream, so the CG never standardizes an
assignment algorithm); different consumers may legitimately differ; *our* renderer's
determinism is owned by the goldens, not by the spec.

### Defaults and their scope — superseded by instrument neutrality (2026-08-07)

The original plan kept "absent ⇒ standard guitar" as a load-bearing default. That
default is now **retired**: absent `strings[]` means *no fingerboard* — no consumer
assumes an instrument, and tab views require the strings to be KNOWN, from exactly
two sources: the document's declaration (content) or the viewer surface's override
(`TabSetup` on the engine → `stringsOverride`/`capoOverride` on
`<mnx-score-viewer>` → the workbench's instrument selector — presentation, never
written back, user > document). Consequences executed with the change: the upgrade
shim materializes explicit standard strings into older tab documents; the MusicXML
importer writes them for TAB parts without `<staff-tuning>`; the corpus's tab
scenarios all declare; `lab/tab-derivation/undeclared-strings` pins the bare-staff
degradation + red badge. Still no inference from part names or ranges. Derivation
runs only when a tab staff is actually being laid out.

## Schema v5 — the reshape

The blocks principle ("shaped like what they draft, so adoption deletes the
wrapper") currently fails for the tab block: the proposal's adopted shape is flat on
`note` and `part`, so adoption would be a rename-and-flatten, not an unwrap. v5 fixes
the mirror:

| Today (v4) | v5 | Drafts (adopted form) |
|---|---|---|
| `note.…tab.position.string` (req) | `note._x.mnxLab.string` | `note.string` |
| `note.…tab.position.fret` (req) | `note._x.mnxLab.fret` (opt, non-authoritative) | optional validation field |
| `note.…tab.fingering` | `note._x.mnxLab.fingering` | `note.fingering` (flat — the piano argument) |
| `part.…tab.tuning[]` | `part._x.mnxLab.strings[]` | `part.strings[]` (avoids "tuning" / #365) |
| `part.…tab.capo` | `part._x.mnxLab.capo` | `part.capo` |
| `note.…tab.technique.*` | unchanged | graduates via [core-guitar-technique.md](../proposed/core-guitar-technique.md) |
| `part.…tab.staffKind` | unchanged | upstream placement undecided (staff-source?) |

Migration mechanics:

- **v4→v5 hop** in
  [src/model/upgradeTabExtension.ts](../../src/model/upgradeTabExtension.ts) —
  mechanical, same pattern as the existing hops.
- **Converters keep writing `fret`.** MusicXML and Guitar Pro both store both, the
  lossless round trips depend on it, and the optional non-authoritative field is
  exactly the migration [spec-instrument-position.md](../proposed/spec-instrument-position.md)'s tension
  section planned. No converter behavior changes.
- **Worker**: regenerate `worker/generated/` validators
  (`spec/tools/compile-validator.mjs`); audit
  [worker/prompts/editNotation.ts](../../worker/prompts/editNotation.ts) for tab
  field names.
- **The golden gate**: the reshape touches inputs only, so `npm run
  update:primitives` must leave `git diff -- scenarios/` clean apart from the
  rewritten `score.mnx.json` shapes. Any primitives or SVG delta means the reshape
  leaked into layout — stop the line.

## The scenario family

New category `scenarios/lab/22-tab-derivation/` (the number is free between
21-tab-positions and 24-tab-spec-gaps; named `tab-derivation` in execution so the ids
ride the `lab/tab-*` group), pinning the fallback path that previously had no oracle:

- bare single-voice line (no annotations at all — the headline case)
- chord forcing collision-avoidance (C major open shape from pitches alone)
- partial annotation (one note pinned to a high string, rest derived around it)
- drop-D declared, bare notes (proves the declaration flows into derivation)
- capo'd part (proves capo-relative printing)
- a `part.transposition`-carrying source (proves the block is display-only and never enters derivation)
- out-of-range pitch (proves the red diagnostic, not a clamp)
- stored fret contradicting the derived fret (proves the validation role)

First-appearance rule means the new goldens demote nothing; the family then goes
through a `/verify` sweep like any renderer feature
([lab-spec-approval.md](../complete/lab-spec-approval.md) recipe).

## Staging

1. **Rules first** — this doc; update spec-instrument-position.md's tension section to
   point here (done alongside this doc).
2. **v5 reshape** — schema, upgrade hop, converters, worker, corpus scores.
   Golden-neutral by the gate above.
3. **Algorithm hardening** — tuning/capo-aware derivation,
   diagnostics replace `console.warn`. Golden-neutral *if* the audit confirms no
   existing scenario exercises the fallback; any that do are reviewed demotions.
4. **Scenarios** — the `22-tab-derivation` family + verify sweep.

## Out of scope

- **Ideal fingering** — position coherence, open-string preference, hand span; future
  heuristics behind the goldens.
- **Violin** — finger-based hand-position derivation (proposal point 5) has no
  renderer to land in.
- **Mid-piece capo/tuning changes** — the positioned-declaration pattern, named in
  the proposal, still out.
- **Rendering `fingering`** — still schema-only; unblocked but not included.
- **The CG posting** — [spec-instrument-position.md](../proposed/spec-instrument-position.md) owns the
  upstream half; nothing here changes what gets proposed, only how much of it we
  already run.
