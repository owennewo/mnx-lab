# The element-ops exemplar — two scenarios prove the forward/reverse harness

> **Status: in progress — stages 1–4 built 2026-08-12, same day as proposed.**
> Shipped: the genesis ops (`addPart` with skeleton-on-demand, plus `setStaffKind`
> — discovered necessary, see below) and `{}` hardening across `edit/`; the two
> construct traces (`harness/fixtures/construct-traces/`) and their forward
> harness (`harness/conformance/construct-traces.test.ts`: schema, undo-to-`{}`,
> the keyboard join over `SURFACE_INTENTS`, the key-normalized primitives
> verdict, the informational doc-delta report); the destruct sweep v0
> (`harness/conformance/destruct-sweep.test.ts`: per-element address/delete/
> oracle checks + two-order exhaustive pass); the ops panel (side-panel `ops`
> tab, `session.opQueue` intent-stamped history, `src/workbench/opRows.ts`
> reverse key join, click-to-jump undo/redo) and the Shift+P part popover +
> palette entries. Results: `minimal-single-note` replays to a **byte-identical**
> document (11 intents → 5 ops); `open-strings-chord` passes the primitives
> verdict with a doc delta of exactly its note ids + declared clef (24 intents →
> 13 ops). Goldens untouched throughout. **Remaining: stage 5** — hands-on
> workbench pass over the ops panel, learnings threaded back as items 2–3 draft.
>
> Empirical answers to the open questions: `tab.staffKind` is NOT invisible — it
> gates the tab/both projections in `engine/headless.ts`, so a document-level
> `setStaffKind` op was added (palette-tier). The engine's default clef for a
> tab part matches the declared treble-8, so the chord verdict passes without a
> clef op — clef-*bearing* scenarios still wait on campaign item 5. Construct
> fixtures got their own kind (`{target, intents}`, no inline expectations —
> the goldens are the oracle, so there is nothing for an update mode to write).

> Campaign: [core-campaign-element-ops.md](core-campaign-element-ops.md), item 1.
> This item IS the harness-proving step, so its "agreement block" is the algorithm
> itself: both harness halves built end-to-end over two deliberately simple scenarios,
> plus the op-queue panel that makes the command sequence visible and reviewable.

## Why an exemplar first

The campaign's harnesses (items 2–3) commit the whole corpus to an algorithm nobody
has watched run. Two scenarios fully reachable with today's twelve ops let us build
the forward (construct) and reverse (destruct) machinery end-to-end, surface the
representation decisions cheaply (two are already visible — below), and give the
op-queue panel real content to display. Everything here rides existing machinery:
`replayIntents`, the trace fixture format and its four assertions
(`harness/conformance/edit-traces.test.ts`), `npm run update:edit-traces`, the
workbench's "copy trace", and `session.appliedOps`.

## The two exemplars

1. **`lab/document/minimal-single-note`** — one whole-note C4. No time signature, no
   clef, no tuning, no note ids: the closest thing the corpus has to a fixed point.
   Notation projection (no strings ⇒ staff mode). Forces the *what-is-empty* decision
   (below), and is the one scenario where trace-built output may equal the committed
   `score.mnx.json` outright — worth recording as data either way.
2. **`lab/tab-positions/open-strings-chord`** — 4/4, the six open strings as one
   whole-note chord, flat `string`/`fret` on every note, note ids `n-s1`…`n-s6`. Tab
   projection; its genesis run is the full setup ladder (part with id/name, tuning,
   time signature) and its one irreducible doc-level delta is **the note ids**, which
   entry does not mint. That makes it the minimal case that forces the
   equality-normalization decision (below), and its destruct direction exercises the
   chord-member collapse (last note out ⇒ rest).

## The forward algorithm (construct)

A **construct trace** is a recorded intent sequence whose replay, from an agreed
start document, renders identically to the target scenario's committed goldens:

```
fixture: { target: <scenario id>, intents: [...] }     start is always {}

replay:  {} ─ replayIntents ─▶ session
assert:  1. the standing trace invariants (schema-valid; undo-all restores the
            start doc byte-identically) — same as every edit-trace today
         2. THE VERDICT: layout session.doc through the same harness path the
            goldens use (corpusPrimitives) and compare against the target's
            committed expected.primitives.json (notation + tab projections),
            after key normalization (below)
         3. THE KEYBOARD JOIN (static, no replay needed): every intent type
            appearing in the trace is either bound in the active keymap layers
            or emitted by a documented shell surface (popover grammar, palette
            command) — the keymap-docs joins' style, extended to traces
         4. informational, never failing: deep-equality of session.doc vs the
            target's score.mnx.json — recorded per scenario as data, because
            where it fails (ids, key order) is itself a finding
```

**What layer does a trace test?** Intents — deliberately, and unchanged by the
`{}` decision. Traces were never keys (`intents.ts`: fixtures are written in
intents, NEVER keys, so they survive rebinding) and are not ops (navigation is in
the trace, absent from the op queue). The split of proof: the *replay* proves the
intent sequence reaches the target; the *keyboard join* (assertion 3) proves the
keyboard surface can produce every intent in it — where "keyboard" includes the
popover tier (Shift+T → typed grammar → the emitted intent is what the trace
records, per the input layer's standing rule) and the palette. Genesis intents
(`addPart`) pass the join only once their popover/palette entry exists — the join
is what keeps "keyboard-reachable" a machine-checked tier rather than an
assumption. A key-level proof beyond this is deliberately out of scope: replaying
a trace under a *specific* keymap table is the emulation-preset completeness test,
owned by that future work.

**What is "empty" — DECIDED (2026-08-12): the literal empty document, `{}`.** No
blank scenario, no per-family templates — every construct trace starts from nothing
and *builds* its scaffolding, which pulls document genesis into the op funnel where
the "setup is ops, not chrome" posture always said it belonged (undoable, traceable,
AI-emittable: the assist loop gains authoring-from-nothing the day these ops exist).
Consequences this item now owns:

- **Genesis ops enter scope** — the exemplar lands the campaign's first *new* ops.
  The vocabulary is exemplar-driven, not speculative: `addPart` (optional id/name —
  exemplar 1's part is anonymous, exemplar 2's is `guitar`/"Guitar") plus the
  existing `appendMeasure`/`setTuning`/`setTimeSignature` covers both targets;
  neither carries a title, so no title op yet. Granularity leaning: **skeleton on
  demand** (each op materializes `mnx`/`global`/`parts` if absent, the `??=` pattern
  `entrySequence` already uses) rather than a ceremonial `newScore` op — one op per
  *choice*, no op for ceremony. Agreement block: genesis verbs are setup-tier
  (popover/palette, no single keys) and attach at the **score rung** — the rung the
  cheatsheet currently shows as honestly near-empty gets its verbs.
- **The session must survive `{}`** — `buildGrid`/cursor with zero parts and zero
  measures (no positions; only setup intents meaningful until a part and a bar
  exist). Note `{}` is not schema-valid MNX and needn't be: the trace assertions
  validate the *final* document only, and mid-flight invalidity is already the norm
  (an underfull bar mid-entry isn't valid either).
- **The recording story changes.** "Copy trace" stamps a corpus scenario id as the
  start, so workbench recording of construct traces needs the *new-document* journey
  (File → New on the documents side) — which stops being chrome and becomes the very
  flow under test. Until that lands, the two exemplar traces are recorded test-first
  through `replayIntents`.

The second decision the exemplar must settle:

- **Key normalization.** The primitives goldens embed note keys for cross-highlight
  (real ids preferred, positional keys as fallback — `open-strings-chord`'s golden
  contains `n-s6`), so an id-less trace-built doc cannot match byte-for-byte. Options:
  normalize both sides to positional keys before comparing; strip key fields from the
  comparison; or declare id-bearing scenarios unreachable until an id-authoring op
  exists (rejected — ids are plumbing, not ink). Exemplar 2 decides and the campaign
  contract inherits the answer.

## The reverse algorithm (destruct)

For these two scenarios the element universe is notes only — the walker's v0:

```
load:    scenario score.mnx.json ─▶ session (history-less, as documents arrive)
baseline: record the renderer's diagnostics for the untouched doc
enumerate: the noteKeys walk = the element list (v0: notes; later items grow
          the walker per element kind — "element = distinguishable ink")
per element (each from a FRESH session):
         1. address it with cursor navigation — the addressability half; a
            note the cursor cannot reach is a finding, not a skip
         2. delete (the Delete intent → deleteNote)
         3. assert: the doc changed; no diagnostics beyond baseline; every id
            referenced anywhere in the doc still resolves (the dangling-
            reference oracle — trivial here, load-bearing from item 2 on);
            undo restores the loaded doc byte-identically
exhaustive pass: delete every element in one session, in at least two orders
         (chord members must commute); terminal state = the walker enumerates
         zero elements. A measure of rests IS the legal terminal — rests are
         absence, not elements; and although construct now starts at {}, destruct
         does NOT end there. The asymmetry is principled: individual destruct
         removes ink; tearing down scaffolding (part, measures, tuning) is
         exactly the coarse-op territory the campaign's framing excludes.
report:  per-element verdicts — the sweep's artifact (no fixtures; the walk
         regenerates each run)
```

## The op-queue panel

The visibility half: a side-panel **ops** tab on the scenario page (joining
description | tags | actions | hud | compare | json) rendering the session's op log
as the undo/redo queue it already is — `appliedOps` (shrinks on undo) plus the redo
stack, one human-readable line per op (`insertNote m1 @ 1/4 · string 6 fret 3`),
current position marked. Clicking an entry steps undo/redo to that boundary — the
history already supports it; display-only is an acceptable v1. Same layering as the
HUD: the formatter produces display rows workbench-side; `edit/` types don't leak.

The panel shows **ops, not intents** — navigation never appears (it is not an op),
which is itself the lesson: the queue is the semantic residue of a session, the trace
is its full recording. Replaying an exemplar construct trace with the panel open is
the "how does the sequence fit together" walkthrough this item exists to enable, and
the panel becomes the standing review surface for every later item's traces before
"copy trace" freezes them.

**Provenance columns (decided 2026-08-12): forward-stamp, reverse-join.** Each
queue entry renders three columns — the op, the intent that provoked it, and the
key/surface that produced the intent — built without reverse *inference*:

- **Intent provenance is recorded forward, at apply time**: `EditHistory` entries
  grow an `intent` field (`{op, intent, before}`, redo stack likewise) — the session
  knows the provoking intent the moment it applies, so the correlation is exact and
  free. Undo/redo entries display as their provoking intents' labels.
- **Intent → key/surface is the existing `KEY_DOCS` + `SHELL_BINDINGS` table queried
  backwards** — the cheatsheet asks "what can these keys do", the panel asks "what
  key did this". Alias rows are already collapsed (`Alt+←/→ · −/=`), which is
  correct: the physical key pressed is deliberately not recorded (keys are the
  unstable layer). Popover ops reconstruct their surface from the payload:
  `setTimeSignature {4,4}` → `Shift+T · "4/4"`; `setTuning` reverse-matches
  `TUNING_PRESETS` → `Shift+U · "standard"`.
- **Key-less ops render `(no key)` honestly** — a feature twice over: the panel
  becomes a *live* gap detector (a `setDuration {dots: 1}` op displays its own
  missing binding — the campaign's tier-A table surfacing in the UI), and when the
  assist loop converges on emitting `EditOp[]`, the same reverse join turns AI edits
  into keyboard lessons ("how you'd have done that by hand") while any unmappable AI
  op is a keyboard-reachability finding caught on real edits, continuously.
- **Deliberate limit**: the columns show the key that *did* this, never a runnable
  key script — the op consumed its cursor context from navigation intents that
  don't enter the op log, so re-deriving an aiming sequence is the trace
  synthesizer's job (the campaign's parked escape hatch), not the panel's. True
  op→intent inference is reserved for foreign (AI/synthesized) ops, where it doubles
  as the reachability audit.

## Stages

1. The genesis ops (`addPart`, skeleton-on-demand) + session hardening for `{}`,
   then the two construct traces, recorded test-first through `replayIntents`
   (workbench recording arrives with the new-document journey).
2. The forward harness: the construct-fixture kind (likely its own
   `harness/fixtures/construct-traces/` — different oracle and update mode than
   edit-traces), the primitives verdict, the key-normalization decision.
3. The reverse sweep v0 (notes-only walker) over both exemplars, including the
   two-order commute check.
4. The ops panel tab, including the history `intent` stamp and the reverse key
   join (the provenance columns).
5. Learnings → the campaign log: fixture shape, walker interface, normalization
   rule — the pieces items 2–3 scale corpus-wide.

## Open questions

- Does exemplar 2 need a document-level `setStaffKind` op, or is `tab.staffKind`
  invisible to the ink verdict (a default-view hint the per-projection primitives
  never see)? The exemplar answers empirically; if invisible, it joins the
  informational doc-delta report rather than blocking the verdict.
- Fixture home: extend `TraceFixture` with `target`, or a sibling fixture kind?
  (Leaning sibling — the oracle is the goldens, not an inline `expect.doc`, and
  `update:edit-traces` must not rewrite construct fixtures' expectations.)
- Does the ops tab belong on non-scenario documents too (IndexedDB docs)? Probably,
  but the exemplar only needs the scenario page.
- ~~Should the panel offer "replay trace" for committed fixtures naming this
  scenario?~~ **Built (2026-08-12, stage-5 feedback)**: the ops tab's empty state
  offers "replay construct trace" when a fixture targets the scenario
  (`src/workbench/constructTraces.ts` globs the committed fixtures read-only, the
  same posture as the corpus itself). The session is rebuilt from `{}` through the
  recorded intents, so the queue shows the genesis ops and undo walks construction
  backward — the "real need" was watching the sequence, not re-recording it.
