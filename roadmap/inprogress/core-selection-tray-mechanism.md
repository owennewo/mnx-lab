# The selection command tray — the mechanism

> **Status: in progress — stages 1–4 built 2026-08-15, same day as picked up;
> the hands-on review is open.** Shipped: `src/edit/commandRegistry.ts` (~60
> commands over all seven rungs plus the `document` scope, each declaring
> scopes/glyph/shortcut/tier and
> its own `isActive`/`action` over a narrow `SessionView`) with
> `harness/conformance/command-registry.test.ts` — 18 joins covering unique
> ids, real rungs, shortcuts that some table actually binds, surfaces that
> exist, intent types the session handles, glyph names the font carries *with
> bounding boxes*, and the ledger agreement (an unwired command names its
> residue row, a wired one carries no stale blocker). The tray is now fed
> from the registry (`trayDemo.ts` deleted), fires through
> `session.handleIntent`, and popover-tier tiles open the typed grammar they
> front. Scope preview draws a **dashed candidate enclosure** —
> `SelectionContext.preview` + `drawEnclosure(svg, kind, {preview, noteIds})`,
> found via the `data-source-id` the renderer already writes, so **no layout
> code and no golden moved**; commit walks the ladder through the shared
> `walkToLevel` (factored out of the HUD's row click). Escape precedence is
> declared once as `ESCAPE_PRECEDENCE` in the keymap layer and asserted in
> `key-scope.test.ts`, answering the ladder doc's open question. Ctrl+Shift+K
> carries the tray's search text into the global palette.
>
> Three findings. **The cheatsheet is the arbiter of rungs**: a join asserting
> that no command offers a rung where its key is documented inert caught the
> tray offering slur and beam at `event` — both are spanning gestures, but
> both are armed and closed at the *note* rung, which is what `KEY_DOCS` says
> and what the session's guards allow (the campaign index's "event→event" is
> about the span, not the rung). A tile a rung above its key would have
> contradicted the cheatsheet on the same screen. **The tray must follow the
> pane**: it offers a
> *dialect* (`S` slurs in notation, slides in tab), and the session's
> projection defaults to tab on a string document, so opening the tray over
> the notation pane showed the fingerboard's commands until `followProjection`
> ran on open — a bug the keys never had because they call it on every press.
> And the ops panel credits **the key, not the emitter**: a tray-fired
> staccato reads `Shift+A · popover`, because the reverse join answers "how do
> you do this from the keyboard", which is the more useful answer and the
> panel's existing contract — so `selectionTray` is registered as a surface
> only for `setAccidentalDisplay`, the one intent the tray genuinely adds to
> keyboard reachability. 583 tests green; goldens byte-identical.
>
> Revised 2026-08-15 (before build) after the campaign's
> vocabulary sweep (items 5, 7–13 built 2026-08-14/15 — ops 15 → ~60, "every
> kind now has its verb"). Second of the trio — builds on
> [core-selection-tray-visuals.md](../complete/core-selection-tray-visuals.md) (the component
> and its neutral contract) and hands everything it cannot wire to
> [core-selection-tray-residue.md](../proposed/core-selection-tray-residue.md).
>
> The design's own architecture ask (the "command registry" handoff note in
> `Selection Palette.dc.html`) turns out to be a thing the repo already half-owns:
> a registry row — id, rungs, glyph, key, is-it-active, what-it-fires — is the
> *surface half* of a campaign agreement block
> ([core-campaign-element-ops.md](core-campaign-element-ops.md)).
> This doc makes that identity literal, so the tray becomes the campaign's
> palette-tier surface rather than a parallel command system.
>
> The sweep inverted this doc's original emphasis, and strengthened its case: as
> first drafted, most of the design's tiles would have rendered greyed, waiting
> on verbs. One day later the verbs exist and their **only human surface is
> typed popover grammars** (Shift+C/K/B/A/L/P/T/U) — precise, and invisible.
> The tray's day-one job is now fronting a nearly complete vocabulary with
> glyphs, states and discoverable keys, not advertising gaps.

## The one ruling everything else follows from

**The tray fires intents through `session.handleIntent`, and nothing else.** No
direct `applyOp`, no side channel. That is the funnel every other surface already
uses (keys, HUD rows, popovers, palette items), and it is what makes tray clicks
land in the op queue with provenance and replay through traces exactly like
keystrokes. A command the funnel cannot express is not wired — it renders greyed
and gets a residue row.

## The registry

`src/edit/commandRegistry.ts` — in `edit/`, not the workbench, because the harness
cannot import shells: putting the registry below the boundary is what makes it
testable, and it is pure data + pure functions over the session's read surface.

```ts
interface EditorCommand {
  id: string
  scopes: CommandScope[]             // which tabs show it; SelectionLevel | 'document'
  glyph: { smufl: string } | { arc: 'slur' | 'tie' }
  label: string
  shortcut?: string                  // the KEY_DOCS label, joined against the keymap
  tier: 'key' | 'popover'
  projection?: Projection            // the tab dialect's letters only
  isActive?: (view: SessionView) => boolean | 'mixed'
  action?: (view: SessionView) => CommandAction | null
  blockedBy?: string                 // the residue row, when unwired
}
```

- **`action` absent or returning `null` ⇒ the tile renders unavailable** (the
  not-yet-built read). After the vocabulary sweep this is the exception, not the
  rule: the greyed set is the residue doc's short tail (respell, duration dots,
  the wrap verbs, entry beyond the first voice/staff, layout/score authoring,
  part transposition, mute). Each such row names its unblocker in a `blockedBy`
  field the residue doc is generated against, so ledger and tiles cannot drift.
- **The tray sees the document; the palette cannot.** The campaign's
  presentation-layer learning ruled the palette out as an authoring surface
  because it deliberately cannot enumerate what the loaded document offers. The
  registry's `isActive`/`action` read a `SessionView`, so the tray *is* a
  document-aware surface — the property the layout/score construction question
  has been waiting for (recorded in the residue, not claimed here).
- **`isActive` is queried per tile per render** — the tile flips in place after a
  command fires and the tray stays open (the design's assumption, confirmed:
  re-render is a pure function of registry + session). `'mixed'` feeds the fourth
  tile read; until the ladder grows `{level, anchor, extent}` nothing returns it.
- `SessionView` is the narrow read surface the registry sees (doc, level, cursor
  context, selected note keys) — commands never hold the session.
- Popover-tier commands (`tier: 'popover'`) fire the existing `ShellAction`s — the
  tray's time-signature tile opens the Shift+T popover rather than reimplementing
  its typed grammar.

### Joins, both directions

- **Forward**: every registry row with a `stroke` must resolve in the keymap layers
  or `SHELL_BINDINGS`, and must carry a `KEY_DOCS` row at every rung in `rungs` —
  an extension of the campaign's static keyboard join over `SURFACE_INTENTS`.
  Asserted in a new `harness/conformance/command-registry.test.ts`.
- **Reverse**: `opRows.ts` `SURFACE_LABELS` gains `selectionTray` — an op fired
  from a tile shows `/ · tray` provenance in the ops panel the way go-to's
  command list shows `Ctrl+G › · palette`.
- **Agreement with the cheatsheet**: a key inert at a rung (`KEY_DOCS` meaning
  absent) must not appear available on that rung's tab — the same
  guards-mirror-docs discipline `keymap-docs.test.ts` already enforces.

## Feeding the tray

`ScenarioPage` builds the tray's props as a pure projection each `syncFromSession`:

- `tabs` — `presentLevels()` in ladder order, `active` = the session's level (or
  the previewed one), `holdsSelection` dot on the real level while previewing.
- `tiles`/`rows` — registry filtered by the active tab's rung, states from
  `isActive`/`action`; the part tab's `rows` values read from the document
  (clef, key, transpose, mute — wired per the residue's schedule).
- `meta` — reuse `buildHudRows`' per-rung readouts; same nouns as the HUD, so the
  tray and HUD never disagree about the address.
- `tray-command {id}` → `action(view)` → `stripIntent`-style dispatch through the
  funnel → `syncFromSession()` re-renders the tray in place.

## Wired on day one (existing vocabulary, post-sweep)

Key-tier tiles — the intent fires directly:

| Tile | Fires | Rungs |
|---|---|---|
| tie to next | `toggleTie` (T) | note |
| slur | `toggleSlur` (S, notation — polymorphic with slide in tab, per [item 10](core-element-ops-spanners.md)) | note→note |
| beam | `toggleBeam` (B, notation — polymorphic with bend in tab, per [item 11](core-element-ops-rhythm-declarations.md)) | event→event |
| tab technique: bend / hammer-pull / slide / vibrato / palm mute / harmonic | `toggleTechnique` (the reserved `B H S V X O`, tab pane — [item 9](core-element-ops-technique.md)) | note |
| delete | `delete` (the ladder's polymorphic delete) | note → score |
| transpose ± semitone / ± octave | `transpose` (Alt+↑↓, Alt+Shift+↑↓) | note, event |
| shorter / longer duration | `shorterDuration` / `longerDuration` | event |
| voice cycle | `cycleSlot` (Alt+V) | note |
| add bar | `appendMeasure` | bar, score |
| begin entry | `toggleNote` | note |
| staff kind | `setStaffKind` | score |
| undo / redo | `undo` / `redo` | all (search-reachable) |

Popover-tier tiles — the tile opens the typed grammar that already owns the
family (the tray is how these grammars become discoverable):

| Tile | Opens | Rungs |
|---|---|---|
| time signature… | `timeSignaturePopover` (Shift+T; removal via `inherit`, [item 5](core-element-ops-clef-key.md)) | bar |
| clef… / key… | `clefPopover` / `keySignaturePopover` (Shift+C / Shift+K, item 5) | bar |
| barline, repeats, endings, segno/coda/jump/fine, section, rehearsal, tempo… | `barAttributePopover` (Shift+B — ten kinds, [item 7](core-element-ops-bar-attributes.md)) | bar |
| articulations, dynamics (incl. hairpins), directions… | `adornmentPopover` (Shift+A, [item 8](core-element-ops-adornments.md)) | note, event |
| lyric… | `lyricPopover` (Shift+L, [item 12](core-element-ops-lyrics.md)) | note |
| tuning… | `tuningPopover` (Shift+U) | part |
| part…, capo, strings, staves | `partPopover` (Shift+P grammar, [item 13](core-element-ops-part-declarations.md)) | part, score |

A design question the sweep sharpens, owned by the visuals review: several
design tiles (fermata, crescendo, repeat end…) are now *reachable through a
popover grammar* rather than a dedicated op call. Whether such a tile fires the
one verb directly (`setMarking fermata` — the registry can compose the intent)
or opens the family popover pre-filled is decided per family at the hands-on
review; both routes go through the same funnel either way.

What still enters the registry greyed with a `blockedBy` is the residue's short
tail — respell, duration dots, the container wrap verbs, entry beyond the first
voice/staff, layout/score authoring, part transposition, mute — enumerated in
[core-selection-tray-residue.md](../proposed/core-selection-tray-residue.md).

## Scope preview and commit

- Tab preview is tray-local plus **one presentation field**: `SelectionContext`
  gains optional `preview?: EnclosureKind`, and `drawEnclosure` grows a dashed
  variant for it. The session is untouched by preview — the viewer just draws the
  committed enclosure and the dashed candidate together, `elements/` still knowing
  shapes, never levels.
- **Commit** walks `relaxSelection`/`tightenSelection` intents until the level
  matches — the loop `onHudRow` already implements; it gets factored into a shared
  `walkToLevel(session, level)` helper both callers use, bounded and
  breadcrumb-respecting, so tab commits are recorded in traces as the ladder moves
  they are.
- Escape during preview returns to the real tab; Escape otherwise closes the tray.

## Keyboard ownership

- **`SHELL_BINDINGS` change**: **`/`** → the tray when a session exists and
  `editorHasKeyboard`; with no session it falls through to **go-to** — the job
  slash used to do from the rail, by a different mechanism. Ctrl+G → go-to (whose
  `>` prefix still reaches the global command list). **Ctrl+Shift+K retired**
  when those commands became the tray's own `global` tab
  ([core-selection-tray-global-tab.md](../proposed/core-selection-tray-global-tab.md)). **Ctrl+K is unbound**:
  Chrome owns it (the omnibox), and because we deliberately never consume keys
  typed into text fields it worked from the score and escaped to the browser
  from every input — a shortcut that works most of the time teaches that it
  cannot be trusted. (Revised 2026-08-15, after the tray shipped on Ctrl+K.)
  All of them remain workbench-tier — shell
  bindings do not travel ([core-editor-focus-scope.md](../proposed/core-editor-focus-scope.md)).
- **The tray is a scope-4 region**: while open it consumes exactly the keys the
  visuals doc lists, via the same `keyScope` discipline as the popovers; direct
  command shortcuts stay live underneath because the tray re-dispatches anything it
  doesn't name.
- **Escape precedence, stated once** — the ladder doc's open question, answered
  here in the keymap layer rather than per-surface: **overlay before ladder**,
  innermost first — popover → tray/palette → `relaxSelection`. One ordered list in
  the keymap module, asserted by a conformance test, ending the per-surface
  ad-hocery.
- The search line is `isTextEntry` territory; printable characters land there and
  the editor layers never see them.

## Tests

The component itself stays untested (workbench convention — the UI has no tests);
everything below the boundary is pinned:

- `command-registry.test.ts` — the forward join (stroke ⇒ binding + `KEY_DOCS` at
  every claimed rung); rung-filtering agrees with `KEY_DOCS` meanings; every
  `action` result is a member of the intent/shell-action unions; wired commands
  replay through a trace and land in the op log with intent provenance.
- Escape-precedence order asserted where it is declared.
- The existing suites keep their force: goldens byte-identical (nothing here
  touches layout), `key-scope.test.ts` still proves no editor layer claims a shell
  chord.

## Not this

- **No new ops.** The mechanism wires what exists; new verbs arrive per campaign
  item, each flipping its tiles from grey to live as it lands.
- **Not `{level, anchor, extent}`** — extension, closure (Ctrl+A), and the mixed
  tile state wait on the ladder's selection-state work; the registry carries the
  shapes so nothing needs redesign when it arrives.
- **Not the AI mode.** [core-editor-ai-prompt.md](../proposed/core-editor-ai-prompt.md)'s
  sentence-routing belongs to the global palette; the tray's search filters its own
  scope and hands off via Ctrl+Shift+K (`initialQuery` carries the text across).

## Staging

1. **The registry + tests** — full command set (wired and greyed), joins green.
2. **Feed and fire** — ScenarioPage projection, `tray-command` through the funnel,
   ops-panel provenance label.
3. **Preview/commit** — `SelectionContext.preview`, the dashed enclosure,
   `walkToLevel` shared with the HUD.
4. **Keyboard** — the Ctrl+K / Ctrl+Shift+K split, scope-4 region wiring, the
   Escape-precedence declaration and its test.
5. **Hands-on review** at each stage boundary, campaign-style; learnings feed the
   residue doc's rows.
