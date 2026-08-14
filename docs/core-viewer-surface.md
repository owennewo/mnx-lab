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
| `zoom` | number | `1` | scale multiplier. |

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

### Assets

The artifact locates its own SMuFL metadata and registers Bravura itself, from
the URL it was loaded from. A host hosting the assets elsewhere sets
`smufl-base` **on the script tag**, not on the element — it is a property of
the build, not of a viewer instance.

### Density

Not on the surface yet, and deliberately: the levers exist as engine constants
but not as `RenderOptions`, so exposing an attribute now would make the element
the implementation rather than a binding. The layering rule answers *where they
go* — `RenderOptions` first, attribute second — which is the question
[core-render-density-zoom.md](../roadmap/inprogress/core-render-density-zoom.md)
was blocked on; the work itself stays that doc's.

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
