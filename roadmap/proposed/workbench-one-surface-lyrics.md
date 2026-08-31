# Retire the lyric popover — one-surface campaign item 6

> **Status: proposed 2026-08-31 — design open, no sweep yet.** Campaign:
> [workbench-campaign-one-surface.md](../inprogress/workbench-campaign-one-surface.md),
> item 6 — the first item that is not a sweep. Two design investigations are
> deliberately unresolved here; the doc is written so a fresh conversation can
> pick them up without re-deriving the ground. **The popover stays until the
> design lands and coverage is demonstrated** (contract §1 unchanged).

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

## The minimum to retire (independent of the investigations)

A `lines` surface for verse metadata. The natural shape, if nothing better
comes out of investigation A: the *document* rung (where `lineOrder` and the
labels actually live) grows `line` pills — `line 2: Nederlands (nl)`,
removable, with the typed `line …` arm routed there. That alone closes the
census. Everything below is about doing better than the minimum.

## Investigation A — lyric lines × bar repeats

The reason verse lines exist at all is repetition: line 1 is sung on the first
pass, line 2 on the second. Today the two systems don't know about each other:

- Repeats (`repeatStart`/`repeatEnd`, voltas via `ending`) are bar attributes;
  lines are event-keyed text stacked by `lineOrder`. Nothing connects a line
  to a pass.
- Engraving convention *implies* the connection (stacked verses under a
  repeated strain; volta bars often carry only the later verse's text).
- Questions for the design pass:
  1. Should the workbench *say* which pass a line belongs to — line labels
     defaulting to pass numbers inside a repeated span, a HUD/inspector
     reading, or nothing?
  2. Do voltas gate lines? A bar under ending 2 carrying `line 1` text is
     arguably a smell the diagnostics lane (blue, not red) could name.
  3. Is any of this *data* (a `line ↔ pass` declaration — which would be an
     `_x.mnxLab` draft and a spec-loop conversation) or purely *presentation*
     (derived at render/inspect time from repeat structure)? The repo's prior
     (derived positions, no-instrument-assumed) leans derived.
- Grounding: `src/engine/layout/notation.ts` (lyric stacking, `:1826`;
  repeats), `spacing.ts:786` (lyric width pricing), the repeat/volta
  scenarios under `scenarios/`, and playback's repeat handling in `audio/` if
  pass-awareness is to be more than ink.

## Investigation B — WYTIWYG lyric entry

The wish: typing lyrics should feel like writing under the staff — type a
word, it lands under the note; `-` or space advances to the next note
(the Finale/MuseScore convention), instead of one popover/pill round-trip per
syllable.

What the design must reckon with, honestly:

- **The standing decision it reopens**: campaign item 12 ruled "text entry as
  a popover, not a mode — a syllable is one short string attached to one
  note" (`keymap.ts`'s old comment; the popover carried it). A WYTIWYG lane IS
  a mode: while it holds the keyboard, letters stop being commands (`S` must
  type an S, not arm a slur).
- **The precedents that make it plausible anyway**: the digit layer already
  owns bare keys transiently (`pendingFret`); an open inspector pill already
  owns the whole keyboard DOM-side (`PENDING_PRECEDENCE`'s `overlay`
  consumer); Escape/Enter arbitration is built. A "lyric lane" could be an
  overlay of per-note text cells over the score — Enter opens it at the
  cursor's note, typing fills the cell, space/hyphen commits `setSyllable`
  and moves right, Escape leaves. Each commit is an ordinary op through the
  one funnel, so traces stay honest (the recorded intents are the syllables,
  not the keystrokes).
- **Open questions**: which line the lane edits (the active `lyric N` pill?);
  melisma/extender handling (a syllable held over notes — skip with →?);
  whether the lane generalizes (fingering and harmonies are also per-note
  text — is this a lyric feature or a *text lane* feature?); and whether it
  lives in `elements/` (embeddable) or stays workbench chrome.

## The Shift+L question (contract §5)

Items 1–5 freed their keys. Lyrics was flagged from the start as the possible
exception: if investigation B lands, `Shift+L` (or bare typing in some state)
may deserve to *open the lane* — an accelerator into the WYTIWYG surface
rather than a resurrected popover. Decide with the design, not before.

## Exit criteria

1. Line metadata editable somewhere the census can point at (minimum bar).
2. A decision recorded on A (even "derived-only, diagnostics later") and B
   (build the lane / don't, with reasons).
3. Then, and only then, the standard sweep: popover, tile, binding, docs —
   with `parseLyric` surviving wherever the winning surface consumes it.

## Relations

- [core-element-ops-lyrics.md](../complete/core-element-ops-lyrics.md) — campaign
  item 12: the ops and the popover-not-a-mode ruling this item may partially
  reopen.
- [workbench-rung-inspector.md](../inprogress/workbench-rung-inspector.md) —
  the pill/word machinery the minimum bar extends.
- [core-selection-range-grain.md](../inprogress/core-selection-range-grain.md)
  — rung discipline; where document-level line pills would sit.
