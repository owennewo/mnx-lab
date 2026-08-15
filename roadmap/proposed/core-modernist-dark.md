# Modernist: the dark pass, and finally wiring it

> **Status: proposed 2026-08-15.** Item 2 of
> [core-campaign-modernist.md](../inprogress/core-campaign-modernist.md). Blocks on
> [core-modernist-tokens.md](../complete/core-modernist-tokens.md). Retires the residue ledger's *"the tray
> on a dark page"* row **by unblocking** it.

## The problem, which is two problems

**The workbench has a complete dark theme that nothing can turn on.**
`src/elements/tokens.ts:128-151` declares a full `:host([resolved-theme='dark'])` block —
surfaces, ink ramp, accent, shadows, status pips, JSON syntax colours, all of it
authored. The string `resolved-theme` appears **exactly once in the codebase**: in that
selector. Nothing sets the attribute. There is no toggle, no media query, no
persistence. It has never rendered.

**And Modernist has no dark variant to convert it to.** The design bundle is light-only
by construction: its readme describes *"a light ground with a single accent"*, its
elevation tokens are *"soft ink-tinted shadows on a light theme"*, and its whole thesis
is paper, ink rules and one red. There is no `#201e1d`-ground counterpart drawn
anywhere in the design project.

So this item is not a token conversion. **It is a design task**: authoring a dark half of
an art direction that does not have one, then building the wiring that would let anyone
see it.

## Why do it at all

The honest alternative was to cut the dark block, declare the workbench light-only, and
close the residue row by decision — the residue doc explicitly permits that (*"if a
row's unblocker is cut, the row converts into the design decision to drop the tile"*).
It is much less work and it deletes dead code.

The campaign chose to keep and author it instead. The reasoning worth recording: **the
restyle should not quietly remove a capability on its way past.** A theme that was
authored and never wired is a bug in the wiring, not evidence that nobody wanted it —
and the moment to decide "this app is light-only forever" is not the moment you happen
to be editing the palette for other reasons. There is also a concrete consumer already:
the viewer has followed the page's colour scheme since 2026-08-14 via `light-dark()`,
so a dark host page already gets a dark score. The chrome is the part that cannot
follow.

## Get the dark half drawn, don't invent it in CSS

**Preferred: ask the design project for it.** The tray and the score panel both came
from *"Notation selection modes and command palette"* as spec-grade mocks, and the
campaign's whole method has been to transcribe rulings rather than improvise them. A
dark Modernist is a real design question — what happens to "2px ink rules" when the
ground *is* ink, whether the red holds at 3:1 on a dark ground or needs the ramp's
lighter step, whether the paper-white score card stays white (it should) and what that
does to the surrounding chrome's contrast. These are answered better in a mock than in a
token sheet.

**Fallback, if no mock arrives:** author it here, in OKLCH, and record it as *ours* —
the way `src/corpus/groups.ts` is recorded as our grouping and not the spec's. Three
rules to hold to, derived from what Modernist actually asserts rather than from how it
looks:

1. **Rules stay structural.** Modernist organises by alignment and the strength of its
   dividers. On a dark ground the 2px rule must stay *visible as structure* — that means
   a lighter-than-ground line, not a darker one, and it must not soften to a hairline
   (the readme's explicit "don't").
2. **The accent lightens, per the system's own instruction.** The design readme says
   pressed states go one step past base — *"`--color-accent-600` on a light ground,
   `--color-accent-400` on a dark one"*. So the ramp direction is specified even though
   the dark theme is not. The existing dark block already does exactly this for the
   slate accent (`--accent-fg: color-mix(in oklab, var(--accent), white 38%)`); keep the
   mechanism, retune the value.
3. **The score card stays paper.** `--paper` is a light surface because a score is
   printed on paper, and the corpus's engravings are the crown jewels. A dark chrome
   around a light score card is the correct answer and already how `viewerTokens` is
   built — do not invert the staff.

And the campaign's tripwire still applies with more force in the dark: the diagnostic
`#b91c1c` is frozen in the goldens and cannot lighten to meet a dark ground, so
**selection-red and error-red must be re-checked in dark**, where the error red will be
the *darker* of the two against its ground.

## Wiring it

Three pieces, none large:

- **Resolution.** A `theme` setting of `auto | light | dark`, resolved against
  `prefers-color-scheme` when `auto`, written to `resolved-theme` on `<mnx-workbench>`'s
  host — the attribute the selector has been waiting for. `ScoreViewer` already models
  exactly this (`theme: 'auto'|'light'|'dark'` pinning `color-scheme`); **mirror its
  shape rather than inventing a second vocabulary**, and pass the resolution down so the
  viewer and the chrome can never disagree.
- **Persistence.** localStorage, alongside `mnx-lab.panel-width` and
  `mnx-lab.rail-hidden`. Same pattern, same file.
- **The control.** A palette command is the cheapest honest answer (`view: theme
  dark/light/auto` in `commandItems()`, which already carries the view commands) plus,
  optionally, a header button. **No new keystroke** — the free-key budget belongs to the
  element-ops campaign, and a theme toggle does not deserve a chord.

Also land `color-scheme` on the host so native widgets follow: the HUD's `<select>` and
its numeric capo `<input>` in `ScoreHud.partLine()`, and the scrollbars. Without it a
dark chrome renders light dropdowns.

## The tray comes too

`SelectionTray.ts` is light-only hard-coded — that is the residue row's actual content.
Once item 4 has moved it onto `designTokens`, the tray gets the dark half for free
*provided* item 4 landed no residual literals. **That is the real test of item 4's
completeness**, and it is worth sequencing this item immediately after it for exactly
that reason: dark is the assertion that the de-hexing was total.

One exception to check rather than assume: the score panel's HUD tab carries a
**deliberately dark footer** (`#201e1d`, white text, "Edit commands live in the tray ·
CTRL+K") — the one intentionally dark element in a light app. In dark mode it must not
vanish into the ground; it likely inverts to the light-on-dark equivalent, i.e. it
becomes the *contrasting* band rather than the dark one. Whoever writes the panel (item
5) should leave a comment saying it is intentional, and this item should decide what it
becomes.

## Not this

- **Not a dark embed.** `viewerTokens` already has a live, working dark half via
  `light-dark()` and it is the public contract — contract rule 3. This item does not
  touch it.
- **Not a print theme.** Out of scope, and the PNG engravings are deliberately not
  goldens anyway.
- **Not auto-switching by time of day**, and not a per-scenario theme.

## Verification

- Goldens unaffected, same argument as item 1 — assert it anyway.
- **Extend `harness/conformance/design-tokens.test.ts`**: every token declared in the
  light `:host` block has a counterpart in the dark block. The current dark half is
  *complete*, and the cheapest way for that to stop being true is a new token added to
  light only during a later campaign item. This assertion is why keeping dark is
  affordable.
- **Hands-on in both themes**, headless Chrome over CDP, zero console errors — the
  campaign's fixed scenario list run twice. Specifically in dark: the 2px rules still
  read as structure; a selected note against a validation badge (both re-checked); the
  score card still paper; native `<select>` and capo input follow the theme; the HUD's
  dark footer still separates from its surroundings.
- Toggle through all three settings including `auto`, with the OS preference flipped
  underneath, and confirm persistence across reload.
