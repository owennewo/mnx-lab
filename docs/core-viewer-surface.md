# The viewer surface — `<mnx-document-viewer>`'s public contract

The embed face's product is one custom element. This document is its contract:
what a host page may set, what it must never need to compute, and where a new
knob belongs. It has the same standing as the `--mnx-*` token vocabulary and
the layer diagram in CLAUDE.md — **the review question "does this belong on
the surface?" made answerable.**

Design rationale and staging live in
[roadmap/complete/core-viewer-surface.md](../roadmap/complete/core-viewer-surface.md).

## The layering rule

```
engine RenderOptions        pure, Node-safe — the behavior ground truth
   ↑ bound by
element props/attributes    <mnx-document-viewer> — a BINDING, not a second implementation
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
<mnx-document-viewer view="tab" theme="dark"></mnx-document-viewer>
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
| `density-pad` | number | *derived* | **frame density** — a multiplier on the whitespace the page *reserves* (the pads above and below each system, the margins either side, and the pads inside a measure's clef/key/time prefix) as opposed to the space between the music. The prefix's glyph **slots** stay rigid — `density-h`'s ruling that a clef occupies the width it occupies applies here too — but the air between them was never covered by that ruling and now follows this axis. Floored per row by the ink that row actually holds, so no value can put one system's stems through the system above. **Unset is neither `1` nor a preset: it is DERIVED from the effective `density-h`** (`padDensityFor`, a square root) — see below. |

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
without shrinking the staff was a third axis, deferred because `ROW_HEIGHT_SP`
is a module-level constant derived from the row pads. **It shipped 2026-08-15**
as `density-pad` above — and the refactor that doc expected never happened,
because the axis runs as a post-pass over a finished `LayoutResult` instead:
`rows[]` says where each system sits, the primitives say where its ink reaches,
and rows move by translation. One implementation serves notation, tab and the
combined system, and no layout had to make its row arithmetic per-instance.
[core-vertical-density.md](../roadmap/complete/core-vertical-density.md).

#### Why `density-pad` couples to `density-h` by default

The two axes answer one reader question — *fit more music on the screen* — and
a control offering them separately asks the reader to solve for something they
do not think in. So the element couples them: unset, `density-pad` follows the
effective `density-h`, and a host that only ever writes `density-h` gets a
tighter *page* rather than the same page with the music squeezed inside it.

The coupling lives **here, at the surface, not in the engine**, and that is the
whole design: the two scalars stay independent below this line, so setting
`density-pad` explicitly wins and separates them again — the same precedence
shape as `density-h` over `density`, one level up. Coupling in the control is
reversible; conflating the scalars in the engine would not be.

It is a square root rather than a copy because the axes buy very different
amounts per unit. `density-h` runs usefully down to 0.02 before packing bottoms
out; padding is spent by roughly 0.3, floored by ink. Coupled linearly, the
pads would hit their floor in the first tenth of a control's travel and sit
there — which reads as a broken control rather than an exhausted one.

The safety argument differs from `density-h`'s, and the difference matters.
Horizontal density cannot make ink collide *structurally* — it scales springs
and never the rigid columns. Vertically there is no such guarantee, because the
row pads **are** the clearance. So this axis does not tighten toward a constant;
it tightens toward each row's measured ink (through the same `computeBoundsSp`
the snug crop uses, real SMuFL glyph boxes rather than baselines) and stops
there. The space it reclaims is the space nothing was using: measured across
the committed goldens, a notation staff reserves 6sp above itself and uses a
median of 0.5sp, and a tab staff reserves 4sp and uses a median of 0.0sp.
`harness/conformance/vertical-density.test.ts` asserts the non-overlap
guarantee at and past the clamp.

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

The numbers are the ones **on the screen**, not the ones the engine asked for,
and above about 200% staff scale those differ. The pane never scrolls
sideways: `#projection-container svg` carries `max-width: 100%`, so a drawing wider
than the pane is scaled down by the browser — both axes. Rigid columns are
ink-priced, so a larger staff widens the drawing as well as heightening it, the
shrink grows with the ask, and the two nearly cancel: measured 2026-08-21 in a
658px pane, `zoom="3.2"` drew 2.34 and `zoom="6.4"` drew 2.60. The element
measures that factor per paint and reports the product, because a control that
printed the request would tell a low-vision reader their staff is 640% while
they look at 260%. `zoom` itself is unchanged — it is still the request, and
still what the host set.

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

### Following the selection

The element **scrolls itself** to keep the selection on screen. It is its own
scroll container (`:host { overflow: auto }`), so a selection that moves to a
system below the fold — or a re-layout that moves the system out from under a
selection standing still — would otherwise leave the reader looking at music
they are no longer editing.

Three rules keep that from becoming a page that moves on its own:

- **Only a property-driven paint follows.** A new `selection`, or a layout
  input the host changed (`view`, `zoom`, `density-h`, the tab setups). The
  element's other two repaint triggers — its resize observer and the redraw
  when Bravura finishes loading — deliberately do not, because nobody asked
  for them.
- **Only when the selection is actually off screen.** A selection merely
  somewhere unusual in the viewport is left where it is; one already spanning
  the whole viewport is the most in view a selection can be.
- **The minimum scroll**, plus a little context either side, smoothly unless
  the reader asked for reduced motion.

There is nothing to configure. A host that wants to place its own chrome on
the selection listens for `selection-anchored`, which fires on the resulting
scroll like any other. The arithmetic is
[`engine/render/revealScroll.ts`](../src/engine/render/revealScroll.ts), where
the harness can reach it.

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
