# Retire the lyric popover — one-surface campaign item 6

> **Status: in progress 2026-08-31 — phases 1–2 built (popover retired, the
> lyric text surface live on `Shift+L`); phase 3 (the pass model) designed,
> not started.** Campaign:
> [workbench-campaign-one-surface.md](workbench-campaign-one-surface.md),
> item 6. The first draft of this doc left two investigations open; a design
> conversation (2026-08-31) settled both, and the rewrite recorded the
> decisions. Phase 1 landed the same day — see *What shipped* below.

## The census (contract §1)

- **Grammar** — `parseLyric` (`src/edit/setupGrammar.ts:757`):
  - a bare syllable at the cursor's note — hyphens carry the role the way a
    singer writes it (`sleep-` starts a word, `-ing` ends, `-ly-` continues);
  - `2: Am` — an explicit verse line, else line 1;
  - `line 2 Nederlands nl` — declare a verse's **label and language**
    (a trailing 2–3 letter token is a language code);
  - removals: `no lyric [line]` (syllable), `no line 2` (whole line).
- **Ops** — `setSyllable`/`removeSyllable` (note-keyed, per line) and
  `setLyricLine`/`removeLyricLine` (document-level verse metadata; the
  renderer stacks lines by `global.lyrics.lineOrder`, `notation.ts:579`).
- **Surfaces** — `Shift+L` binding + arm; popover spec/submit/palette row;
  `KEY_DOCS`; credits; the `lyric` tile (event rung, lines-and-text group).
- **Inspector today** — syllable pills per line (`lyric` / `lyric 2`), typed
  add/amend through the same parser, hyphen round-trip. **Gap: the `line …`
  and `no line …` arms are refused** — line metadata has no pill and no word.

## The ground: where lyrics live in the spec

`event.lyrics.lines` is a map of line id → `{text, type}` (`type` ∈
`start|middle|end|whole` — the syllable role); `global.lyrics` holds the verse
metadata — `lineOrder` (stacking) and `lineMetadata` (id → `{label, lang}`).
Line ids are arbitrary strings; nothing in the schema ties a line to a repeat
pass. Two consequences the design leans on: the `line` concept really is
document-level (the minimum bar below goes to the document rung), and **MNX
cannot encode a melisma extender** — `event-lyric-line` is `{text, type}`
only (MusicXML has `<extend>`; MNX has nothing), so a held syllable is
representable only as following events *with no lyric entry*, and the
extender line must be derived by the renderer. Noted for the spec loop; not
pursued now.

## Decision A — the pass model: derived, shared, no new data

Verse lines exist because of repetition, and the connection is **derivable**:
pass count per measure is a pure function of the global measure attributes
(`repeatStart`/`repeatEnd` with `times` defaulting to 2, `ending` with
`numbers`/`open`, `jump` `dsalfine|segno`, `fine`, `segno`). The ruling:

- **No `line ↔ pass` data declaration** — no `_x.mnxLab` block, no spec
  conversation. The repo's prior (derived positions, no instrument assumed)
  holds here too.
- The pass-linearization walk becomes **one shared pure function in the model
  layer** — not private to `audio/` — because three consumers must agree at
  the edges (D.S. returns not taking repeats, open endings): the future
  player (per-bar play index, and a "show only the current pass's line"
  option), lyric entry (the cursor gains a pass index; a typed syllable
  routes to the pass's line), and diagnostics.
- **pass → line resolves by ordinal within a language group of `lineOrder`**
  (group by `lineMetadata.lang`; absent lang = the primary group), never by
  id. Translations are the confound that forces this: an English and a Dutch
  line are sung on the *same* pass, so a flat ordinal breaks on bilingual
  documents. Lab authoring mints numeric ids (`"1"`, `"2"`, …) matching pass
  order as a readability convention, but resolution never depends on it —
  foreign documents work unmodified.
- The diagnostic is a **bound, not an equality**, and it is blue: fewer lines
  than passes is a chorus (normal); more *same-language* lines than a bar's
  pass count is the smell worth naming. Volta bars get this per measure
  (a bar under `ending [2]` carrying pass-1 text is detectable).

## Decision B — the lyric text surface (paste-and-tweak)

The WYTIWYG per-note lane the first draft investigated is **not built**.
Lyrics usually already exist as text; the winning surface is a modal text
editor — paste, tweak, apply — which covers what the lane promised at a
fraction of the cost (one overlay owning the keyboard via the existing
`PENDING_PRECEDENCE` machinery, not per-note cells with focus management).
Item 12's popover-not-a-mode ruling is reopened only this far: one modal
overlay, entered and left deliberately.

**Mechanics.** The canonical direction is document → text: a serializer
projects the stored lyrics into the format deterministically, so regenerating
is always safe and the format is a projection, never a second store. The
buffer is workbench state — the document is never invalid, because it only
changes on apply. A live parse produces a ghost preview under the score and
bar-anchored diagnostics ("bar 6: 5 syllables, 4 events"); **apply diffs the
parse against the document and emits ordinary `setSyllable`/`removeSyllable`/
`setLyricLine` ops through the one funnel** (traces record syllables, not
keystrokes; undo and the edit loop stay honest), and is refused while errors
stand — bar checks make fixes local and fast.

**The format** (locked 2026-08-31; kin to LilyPond lyric mode, and every
token mirrors what engravers draw):

| Token | Meaning |
|---|---|
| syllables | separated by runs of whitespace — one boundary; **whitespace is never otherwise semantic** (invisible syntax dies in transit through editors and chat) |
| `-` | word split; a run of *n* hyphens = split + (*n*−1) held events for the preceding syllable (`fant--as-tic`) — the engraved repeated hyphen |
| `_` | one event each. Suffix run = word-final melisma (`day__ next` — the engraved extender); standalone run = untexted events (`____` = 4 skips); leading standalone reaches a mid-bar start. LilyPond's spaced `_ _` is accepted and normalized on serialize. Today both spellings compile identically (the spec gap above); if an extender marker is ever added they gain distinct meanings with zero grammar change — the reason there is no separate skip character |
| `~` | elision, two words on one event (`you~are`) — LilyPond's character |
| `\|` / `6\|` | bar check / numbered bar check: asserts position, resyncs on mismatch (errors stay local), and a jumped-to number auto-skips the untexted bars between — long skip runs are never needed; `_` is bounded by events-per-bar |
| `nl 2:` | line header, optional, order-free tokens before a colon — an integer (pass) and/or a 2–3 letter language code, shape-distinguished (the `parseLyric` trick). Each text line is the next pass within its language group; a header overrides. `\` escapes a first syllable that would parse as a header |

Rests, tie continuations and grace notes skip automatically — most pasted
text needs no special tokens at all, which is the test of the format. Held in
reserve, unbuilt: a count suffix (`_4`), and a voice-selection header token
(convention: voice 1 carries lyrics).

**Cross-highlight.** The text surface is a third projection of the event
keys: the parse maps every syllable token to its event, so selection
highlights bidirectionally — caret in a syllable lights the note, selecting
an event lights its **column** of syllables (one per text line, stacked in
`lineOrder` order, exactly as engraved). Same lockstep pattern as
`model/noteKeys.ts` ↔ `model/jsonView.ts`; keep all three on one traversal.

## Decision C — both surfaces, divided

Inspector = *see and point-tweak*; text editor = *entry and restructuring*;
both compile to the same ops, so neither is a second source of truth.

- **Minimum bar (unchanged from the first draft, still phase 1):** the
  document rung grows `line` pills — `line 2: Nederlands (nl)`, removable —
  and the typed `line …` / `no line …` arms route there. That alone closes
  the census.
- **Inspector collapse:** 1–2 lines (the overwhelming majority of events)
  show syllable pills exactly as today. Beyond that, show the *active* line's
  syllable (the cursor's pass) plus one summary pill — `lyrics · 6 lines /
  2 langs` — whose activation opens the text editor focused at the event,
  where the "all 12 things" are one coherent column. The typed grammar
  routes regardless of what is displayed, so collapsing costs no census
  coverage.
- The editor is workbench chrome first; nothing in the format prevents a
  later promotion to `elements/` if embedders want it.

## The Shift+L question (contract §5) — answered

The exception the campaign flagged is confirmed, in the text surface's
favor: when the editor exists, **`Shift+L` opens the lyric text editor at the
cursor's event** — an accelerator into a surface, not a resurrected popover.
Until phase 2 lands the key is simply freed at the sweep, like items 1–5;
the campaign log records the earmark.

## Phases + exit criteria

1. **Minimum bar:** document-rung `line` pills + typed routing; census reads
   covered; then the standard sweep (popover, tile, binding, docs — with
   `parseLyric` surviving as the inspector's shared arm). **The popover
   retires here.**
2. **Text surface:** serializer + parser + overlay editor + apply-as-ops +
   cross-highlight; `Shift+L` reassigned to it.
3. **Pass model:** the shared walk in `model/`, pass-aware line resolution,
   default labels, the blue bound diagnostic. The player itself is *not*
   this item — the walk is built to be its foundation.

Phases 2–3 may land as follow-on efforts under this doc; the campaign item
itself closes with phase 1's sweep, and the design above is recorded so the
later phases start without re-deriving it.

## What shipped — phase 1, 2026-08-31

- **Document-rung `line` pills**: one per `lineMetadata` entry
  (`line 2: Nederlands (nl)`, removable), recited in `lineOrder` with
  unlisted ids after — mirroring the renderer's stacking rule. The typed
  `line …` / `no line …` arms route through `parseLyric`'s own arms at the
  document rung; a pill amend composes (`line 2` + `Chorus`). Typed at the
  event/note rung, both arms signpost the document rung (item 4's pattern).
- **The sweep**: `Shift+L` binding + `ShellAction` arm, `KEY_DOCS` row,
  `SURFACE_INTENTS.lyricPopover` (its two line intents credited to
  `rungInspector` first — the construct-traces join enforces the order),
  popover spec/actions/submit arm + palette row, the op-queue surface label,
  the registry's `lyric` tile. The note rung's `text` band was the campaign's
  first band retirement — the tile was its only member. `KNOWN_TWINS` billed
  nothing. `parseLyric` survives whole; the grammar's header comment now
  names its two consumers.
- **Coverage evidence**: `rung-inspector.test.ts` — "lyric verse lines live
  at the document rung (one-surface item 6)": both typed arms, the amend
  composition, both signposts, pill recital incl. `lineOrder`, removal via ×.
- **`Shift+L` is freed, not reassigned** — the earmark (reopen the phase-2
  editor) is recorded at the unbound slot in `keymap.ts` and in the campaign
  log.

## What shipped — phase 2, 2026-08-31

- **The format engine** — `src/edit/lyricText.ts`: `lyricEventWalk` (staff-1
  voice 1, tuplet/tremolo content sung, grace content and rests and `space`
  items and tie continuations skipped; events outside the walk keep their
  lyrics untouched), `serializeLyricText` (canonical projection: stacking
  order, `lang`/ordinal headers only when needed, bar checks between texted
  bars, gaps > 3 jump by number, skips after a bar's last syllable never
  emitted), `parseLyricText` (the full token set + bar-anchored diagnostics +
  token→entry spans), `planLyricEdits` (the diff; `whole` ≡ absent type;
  elision stored as a plain space in `text`, spelt `~` both ways).
- **`applyLyricPlan`** — one intent carrying the note-addressed diff (the
  clipboard's materialized-plan shape), applied via the session's batch
  envelope: one undo gesture, syllables in the trace, the element census's
  named ops unchanged.
- **`<mnx-lyric-text-editor>`** — a modal over the score (ModelPickerDialog's
  modality + RungInspector's focus handoff): opens on the serialization,
  parses live, refuses apply while diagnostics stand, `Ctrl+Enter` applies,
  Esc closes. Caret → notehead over the selection context's **preview
  channel**; opening at the cursor's note selects its token.
- **`Shift+L` reopened** as the earmark promised — a surface, not a popover —
  plus a palette row, the `KEY_DOCS` row, `SURFACE_INTENTS.lyricTextEditor`,
  and the op-queue label.
- **Evidence**: `harness/conformance/lyric-text.test.ts` (walk, parse,
  serialize, round-trip `plan(parse(serialize(doc))) = []`, diff, batch
  apply/undo); `smoke:inspector` grew a real-browser lap — open, type a
  verse, apply, reopen on the document's own serialization, Esc.
- **Recorded deviations**: no ghost preview under the staff yet (live
  diagnostics + caret highlight carry that weight; revisit with phase 3's
  pass-aware labels if wanted); the score→text column highlight exists only
  as open-at-cursor token selection; the voice-selection header token stays
  reserved (voice 1 is the convention).

## Relations

- [core-element-ops-lyrics.md](../complete/core-element-ops-lyrics.md) — campaign
  item 12: the ops, and the popover-not-a-mode ruling that decision B reopens
  narrowly (one modal overlay) rather than wholesale.
- [workbench-rung-inspector.md](workbench-rung-inspector.md) —
  the pill/word machinery phase 1 extends; the collapse rule lives by its
  charter.
- [core-selection-range-grain.md](core-selection-range-grain.md)
  — rung discipline; where the document-level line pills sit.
- The extender gap is a candidate spec-loop topic (an `_x.mnxLab` extender
  draft would slot into the format without grammar changes) — deliberately
  not filed; derivation is expected to suffice.
