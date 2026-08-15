# The viewer surface — `<mnx-score-viewer>`'s public contract

The embed face's product is one custom element. This document is its contract:
what a host page may set, what it must never need to compute, and where a new
knob belongs. It has the same standing as the `--mnx-*` token vocabulary and
the layer diagram in CLAUDE.md — **the review question "does this belong on
the surface?" made answerable.**

Design rationale and staging live in
[roadmap/inprogress/core-viewer-surface.md](../roadmap/inprogress/core-viewer-surface.md).

## The layering rule

```
engine RenderOptions        pure, Node-safe — the behavior ground truth
   ↑ bound by
element props/attributes    <mnx-score-viewer> — a BINDING, not a second implementation
   ↑ composed by
workbench chrome            toolbar, URL ?view=, palette — explicitly NOT the surface
```

**Every element knob corresponds to an engine option.** The element never
implements presentation behavior of its own; it binds one. A knob that cannot
be expressed as an engine option is a sign the behavior belongs in the engine
first — that is the test, and it is what keeps the element from quietly
becoming a second renderer.

## Attribute-first

The embed promise is *one script tag, then HTML*. Everything scalar is an
attribute, so a passive host needs no JavaScript at all:

```html
<script type="module" src="https://…/mnx-lab.esm.js"></script>
<mnx-score-viewer view="tab" theme="dark"></mnx-score-viewer>
```

Only genuinely complex values (the document, selection, playback state) are
properties or contexts. Attributes reflect, so the DOM inspector is also the
documentation.

## Unset defers downward

For any knob where the *document* can express intent, resolution runs:

```
user toggle  >  host attribute  >  document hint  >  built-in default
```

and **unset means "defer to the layer below"**, never "the default value".
That distinction is the whole reason `view="auto"` exists rather than
`view="notation"` as a default: a host that says nothing gets *the author's*
intent, not ours.

A document hint stays a **hint, never a command**. Read-only means "I do not
edit the document", not "the document edits me": a host that sets `view="tab"`
outranks any `staffKind`, always.

## The surface

### Content

| Name | Kind | Notes |
|---|---|---|
| `mnxDoc` | property | the document. The one thing a host must supply. |
| `selection`, `playbackState` | context | complex, live, shell-supplied. Not attributes. |

### Presentation

| Attribute | Values | Default | Resolution |
|---|---|---|---|
| `view` | `auto` · `notation` · `tab` · `both` | `auto` | `auto` reads the document's `_x.mnxLab.tab.staffKind`: `both` → the composed system, `tab` → tab, otherwise notation. A part with no declared strings has no fingerboard, so it renders notation regardless — no instrument is ever assumed. |
| `theme` | `auto` · `light` · `dark` | `auto` | `auto` needs no host cooperation: `color-scheme` is an inherited CSS property and the component resolves `light-dark()` against the *used* value, so it follows the host page (and, for a page declaring `light dark`, the reader's preference). The attribute exists for what CSS cannot expose — a host's private convention (a `.dark` class). |
| `hide` | comma-separated set: `lyrics`, `badges` | empty | features to omit. **One set-valued knob, not N booleans** — an options bag of `hideLyrics`/`hideBadges`/… turns every addition into a silent contract change. Unknown names are ignored, so a host naming a newer feature on an older artifact degrades to showing it rather than to a broken render. |
| `compact` | boolean | absent | tighter paper padding for small frames. |
| `zoom` | number | *unset* | **staff scale** — a multiplier on `pxPerSp`, so line gap, glyphs, text and stems scale together. Clamped 0.6–1.6. **Unset is not `1`**: with no `pxPerSp` the renderer *fits* a short score to the viewport, and defaulting to `1` would silently retire fit-to-width for every host that never set it. Until 2026-08-15 this prop sized the paper card and never reached the engine. |
| `density` | `normal` · `compact` · `spacious` | `normal` | **horizontal density** — how much music fits on a line, *without* shrinking glyphs. The engine scales the springs and never the rigid columns, which is what keeps this independent of `zoom` so the two compose. |
| `density-h` | number | *unset* | the numeric form of the same axis; wins over `density` when set. Clamped by the engine's own `clampDensity` (0.5–2), so a host and a control get the same floor. The floor is **legibility, not collision** — no density can make ink overlap. |

#### How a `hide` member is sorted

One question decides where a feature is implemented: **does hiding it reclaim
space?**

- **Layout-side** (`lyrics`): verse rows reserve a vertical band, so hiding
  them must close the system up. That can only happen in the engine, and it
  travels as a `RenderOptions` member — CSS can remove the ink but never the
  gap where it sat.
- **Emit-side** (`badges`): diagnostic markers sit in the margin and reclaim
  nothing, so the element's stylesheet is the honest tool.

The host never needs to know which kind a feature is — same attribute either
way. `harness/conformance/viewer-surface.test.ts` asserts both directions
(lyrics shrink the layout; badges must not move it), so a future feature that
changes category is caught rather than silently mis-implemented.

### Styling

The `--mnx-*` custom properties (`src/elements/tokens.ts`) are the styling
surface — shadow DOM admits no other seam. `--mnx-accent`, `--mnx-paper`,
`--mnx-paper-ink`, `--mnx-paper-line`, `--mnx-bg`, `--mnx-ink`, `--mnx-line`,
`--mnx-surface`, `--mnx-focus-ring`. They work in an embed as of 2026-08-14;
before that the vars reading them lived in a block the element did not carry.

`--mnx-paper-width` (2026-08-15) is the one that is not a colour: the paper
**fills its container** by default, so the engine gets every pixel the host
gave it and lays out more bars per system on a wider one. It used to be capped
at 820px, which meant a host making room for music got margin instead. A page
look is still one declaration away — `--mnx-paper-width: 820px` — and any value
is bounded by the container. Layout follows the container, not just the window:
the element observes its own box, so a host folding a sidebar re-engraves the
score without a window resize to prompt it.

### Assets

The artifact locates its own SMuFL metadata and registers Bravura itself, from
the URL it was loaded from. A host hosting the assets elsewhere sets
`smufl-base` **on the script tag**, not on the element — it is a property of
the build, not of a viewer instance.

### Density and zoom — on the surface as of 2026-08-15

Both axes now sit in the Presentation table above, and they arrived in the order
the layering rule prescribes: `RenderOptions` first (`PlanOptions.densityH`
2026-08-14, `pxPerSp` reached from the element 2026-08-15), attribute second.
The horizontal axis shipped as a **preset** and gained its numeric form only
when a continuous control needed one — presets are names for numbers, so the
vocabulary widened without a breaking change, exactly as
[core-render-density-zoom.md](../roadmap/complete/core-render-density-zoom.md)
predicted.

They are two axes and not one knob on purpose: `zoom` changes how big the notes
are, `density` changes how much air sits between them. Conflating them in the
engine would be irreversible; a control that couples them for the user is not
(the workbench's pad —
[core-zoom-density-pad.md](../roadmap/complete/core-zoom-density-pad.md) — keeps
them separate and shows both).

**Vertical density is deliberately still absent.** Systems packing closer
without shrinking the staff is a third axis, and `ROW_HEIGHT_SP` is a
module-level constant derived from the row pads, so it is a real refactor rather
than a wiring job — and the stem-length clamp should land first or alongside,
since stem headroom feeds vertical spacing. It has its own item now:
[core-vertical-density.md](../roadmap/proposed/core-vertical-density.md).

The `density-h` range widened at the bottom on 2026-08-15 (`MIN_DENSITY`
0.5 → 0.02): the old floor stopped a reader two systems short of what this
engraver draws readably, and 0.02 is where packing bottoms out — rigid notehead
columns fill the line and no lower value fits another bar. The clamp is still
the engine's, so a host writing `density-h="0.001"` gets the floor rather than
an error — and `densitySteps()` below is how a control finds out which values
in the range are worth offering.

### Reporting back

`render-scale` fires after each paint with `{ pxPerSp, staffScale, fitted }`.
It exists because **a host cannot compose a scale control without knowing the
scale**: while `zoom` is unset the renderer picks the factor from the viewport,
so the true number moves on resize with nobody touching a control, and any
readout printing a hard-coded `100%` would be lying on first paint. `fitted`
is carried rather than inferred so a control can say the value was *derived*
rather than chosen.

`densitySteps()` — a method, not an event — returns the `density-h` values
that would actually **change** the score as currently drawn, ascending from the
engine's floor, or `null` before the first successful paint. Same principle as
`render-scale`, one level up: a host cannot compose a *density* control without
knowing which values do anything, and most of them do not. Every horizontal
coordinate is `spring × densityH × stretch`, and inside the justifier's linear
range `stretch` is inversely proportional to `densityH` — the two cancel, and
the engraving is byte-identical until density repacks a system. A control
stepping a flat percentage therefore spends most of its clicks drawing exactly
what was already on screen. The answer depends on the document, the viewport
width and the staff scale, so only the layer that just laid the score out can
give it; the value is recomputed per paint and cached in between, so a host may
call it on every render of its own. See
[core-render-density-zoom.md](../roadmap/complete/core-render-density-zoom.md).

> Gap, recorded honestly: the element also emits `note-selected` and
> `selection-anchored`, which predate this contract and are not described here.
> Documenting the event surface properly is its own small pass.

### Evicted

| Was | Why it went |
|---|---|
| `hasTab` | Host-computed data the element already had. It was never even *read* inside the component — a pure chore that made hosts string-search the document (`apps/viewer-embedded` did exactly that). `view="auto"` derives the same fact from `staffKind`. |
| `viewMode` | Renamed `view`, and given the `auto` default that makes zero-config work. Property-only and unconditionally `notation`, it forced every host to restate what the document already said. |
| `invalidByDesign`, `pinnedErrors`, `errorPointer` | The spec-gap exhibit: workbench chrome riding on the element as three props an embed could never want. The exhibit *is* the document — rendering is deliberately skipped — so the workbench now renders the panel itself and does not mount this element at all. The `error-row-selected` event went with it; the shell talks to itself directly. |

## Adding a knob

1. Can the engine express it? If not, it belongs in `RenderOptions` first.
2. Can the *document* express intent about it? Then the attribute defaults to
   `auto` and defers, per the precedence chain.
3. Is it scalar? Then it is an attribute, not a property.
4. Would an embed ever need it? If not, it is workbench chrome — compose it
   outside, or mark it workbench-tier here.
5. **No options bag.** Named knobs with a written vocabulary; a `config`
   object hides the precedence chain and turns every addition into a silent
   contract change.
