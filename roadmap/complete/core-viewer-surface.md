# The viewer surface — naming and defining the component's public contract

> **Status: COMPLETE 2026-08-14 — all five stages addressed** (3 built, 1
> answered, 1 handed on to [core-render-density-zoom.md](../inprogress/core-render-density-zoom.md),
> whose own status records the levers landing since). Stage 5 states the ✔
> condition is met without building here, so nothing is outstanding. Unblocked by the arrival of
> its consumer: [core-viewer-embedded-app.md](../proposed/core-viewer-embedded-app.md)
> is the read-only player this doc's first symptom describes, and it committed that
> exact sin — a host string-searching the document JSON
> (`JSON.stringify(mnxJson).includes('"strings"')`) to decide `hasTab`, then
> restating `viewMode`, because the surface made it. Two lines that are now deleted.
>
> Shipped: **[docs/core-viewer-surface.md](../../docs/core-viewer-surface.md)** — the
> contract, with every current prop marked keep / derive / evict / workbench-tier;
> **`view="auto"`** with the precedence chain resolved in the element
> (`ScoreViewer.resolvedView`), replacing `viewMode`'s unconditional `notation`;
> **`hasTab` evicted** (it was never even *read* inside the component); the
> `staffKind` rule centralized as `declaredStaffKind`/`wantsTabView` in `model/` so
> the engine's tab gate and the element's `auto` cannot drift into two definitions of
> what a document means; and the fingerboard gate applied to every branch — asking
> for `tab` on a part with no strings still renders notation, because no instrument
> is ever assumed.
>
> Verified in headless Chrome across the whole precedence chain: a document with no
> `staffKind` renders notation under `auto` (the old host hack forced tab merely
> because the JSON contained "strings" — the fix corrected behavior, not just code);
> `staffKind: both` renders the composed system with zero host JavaScript; a host
> attribute outranks the document in both directions; and forcing `tab` on a
> string-less score declines to notation rather than drawing a guessed fretboard.
> `smoke:embed` now asserts the zero-config promise. The workbench renders
> identically across notation/tab/both, goldens byte-identical.
>
> **Stage 3 — the exhibit evicted.** `invalidByDesign`/`pinnedErrors`/`errorPointer`
> are gone from the element, along with its `error-row-selected` event: the spec-gap
> exhibit *is* the document (rendering is deliberately skipped), so the workbench
> renders the panel itself and does not mount the viewer at all. Verified in the
> browser: no `mnx-score-viewer` on an invalid-by-design page, the panel and its
> pinned rows render, and clicking a row still opens the json tab with the pointer
> highlighted.
>
> **Stage 4 — the `hide` set**, one attribute (`hide="lyrics,badges"`), with the
> sorting question answered per member and *both answers implemented*: `lyrics` is
> layout-side, so it travels through `LayoutNotationOptions.hide` and the system
> closes up (CSS could remove the ink but never the gap); `badges` is emit-side and
> hidden in the element's stylesheet, because it reclaims nothing.
> `harness/conformance/viewer-surface.test.ts` pins both directions — lyrics must
> shrink the layout, badges must NOT move it — so a future feature that changes
> category is caught rather than silently mis-implemented. Unknown names are
> ignored, so an older artifact degrades to showing a newer feature.
>
> **Stage 5 — density: answered, not built, and deliberately so.** The layering rule
> settles *where* the levers go (`RenderOptions` first, attribute second), which is
> the question [core-render-density-zoom.md](../inprogress/core-render-density-zoom.md)
> was blocked on. Exposing an attribute before the engine option exists would make
> the element the implementation rather than a binding — the one thing this doc
> forbids. The work stays that doc's; the ✔ condition here is met without it.
>
> **Note on history**: commit `775d115` claims stages 1–2 but contains only the
> file rename — its `git add` aborted on a stale pathspec and the error was
> suppressed. The code for all of it landed in the follow-up commit.

## The problem

`<mnx-score-viewer>` is the embed face's product, but its host-facing API has never been
designed, named, or documented — it is an accretion of whatever the workbench needed.
Today's props mix four different kinds of thing:

| Kind | Props today | Verdict |
|---|---|---|
| Content | `mnxDoc` (+ `playbackState`, `selection` via context) | surface |
| Presentation knobs | `viewMode`, `zoom`, `compact` | surface — the undesigned tier |
| Derived data the host must compute | `hasTab` | not surface: derivable from the document |
| Workbench leakage | `invalidByDesign`, `pinnedErrors`, `errorPointer` | workbench tier riding on the element |

One tier of host control **was** deliberately designed and proves the pattern: theming.
`src/elements/tokens.ts` defines the public `--mnx-*` custom-property vocabulary with a
stated principle. This effort does for behavior what that did for color.

Concrete symptoms of the gap:

- A read-only player must set `viewMode` (and compute `hasTab`!) to show a document the
  way its author intended — `_x.mnxLab.tab.staffKind` is documented as a hint
  ([docs/mnx-extensions.md](../../docs/mnx-extensions.md)) but no surface consults it.
- Density/zoom levers ([core-render-density-zoom.md](../inprogress/core-render-density-zoom.md)) have named
  engine knobs but no answer to "toolbar, embed attribute, `RenderOptions`, or all three?"
- Feature visibility (lyrics, harmonies, diagnostics badges, tempo marks) is not
  controllable anywhere; layouts always draw everything they support.

## The design

**Name:** *the viewer surface* — documented as `docs/core-viewer-surface.md` when built, with
the same contract status as the `--mnx-*` token vocabulary and the layer diagram in
CLAUDE.md. The doc is the review question "does this belong on the surface?" made
answerable.

### 1. Layered, and the layers already exist

```
engine RenderOptions        pure, Node-safe — the behavior ground truth
   ↑ bound by
element props/attributes    <mnx-score-viewer> — a BINDING, not a second implementation
   ↑ composed by
workbench chrome            toolbar, URL ?view=, palette — explicitly NOT the surface
```

Rule: **every element knob corresponds to an engine option.** The element never
implements presentation behavior itself. Density levers thereby enter `RenderOptions`
first and the element exposes them — that answers render-density-zoom's open question.

### 2. Attribute-first for scalars

The embed story is "one script tag, then HTML". A passive host writes

```html
<mnx-score-viewer view="tab" density="compact" hide="lyrics,harmonies"></mnx-score-viewer>
```

with zero JavaScript. Complex objects (the document, selection, playback state) stay
properties/contexts. Attributes reflect, so they are also the inspection story.

### 3. Unset defers downward: the precedence chain

For any knob where the document can express intent, resolution is

```
user toggle  >  host attribute  >  document hint  >  built-in default
```

and *unset means "defer to the layer below"*, not "the default value". First instance:
`view` gains an `'auto'` default (replacing `viewMode`'s unconditional `'notation'`),
resolved from `staffKind` — `both` → the composed system
([core-both-view-single-system.md](../complete/core-both-view-single-system.md)), `tab` → tab,
absent/`notation` → notation. The read-only player becomes zero-config; the author's
declared presentation finally works; interactive shells still override at will.
`staffKind` stays a **hint, never a command** — read-only means "I don't edit the
document", not "the document edits me."

### 4. `hide` — feature visibility as one set-valued knob

One attribute (`hide="lyrics,harmonies,badges,tempo"`), not N boolean props. Per
feature, the design question is forced and recorded: is hiding a **layout** concern
(space reflows — must be an engine option; lyrics reserve vertical room, so lyrics are
this kind) or an **emit/style** concern (space stays — may be CSS)? That test sorts
every future candidate.

### 5. Evictions

- `hasTab` — derived from the document inside the element (the one-liner already lives
  in `src/engine/headless.ts`); prop deleted or demoted to override.
- `invalidByDesign` / `pinnedErrors` / `errorPointer` — the spec-gap exhibit is
  workbench chrome; move the panel up into `workbench/`, or explicitly document these as
  workbench-tier extensions outside the surface contract. Either way the surface doc
  draws the line.

### Non-goals / resisted shapes

- **No kitchen-sink `config` object.** The repo's pattern is named knobs with a written
  vocabulary; granular attributes match it. An options bag hides the precedence chain
  and turns every addition into a silent contract change.
- **Not a workbench refactor.** The shell keeps composing the surface; only leakage
  moves.
- **Not versioning/packaging.** Independent versioning still waits for a real external
  consumer (CLAUDE.md's check); this doc is what that consumer would be handed.

## Order of work

1. ~~**Write `docs/core-viewer-surface.md`**~~ — **built** — the contract as it *should* be, marking each
   current prop keep/derive/evict. Cheap, and everything after cites it.
2. ~~**`view="auto"`**~~ — **built** + `hasTab` derivation + precedence documented in
   mnx-extensions.md's staffKind entry. (Smallest slice; fixes the read-only player.)
3. **Evict the exhibit panel** into `workbench/` (or document the workbench tier).
4. **`hide` set**, starting with `badges` (emit-side, easy) and `lyrics` (layout-side,
   proves the reflow path through `RenderOptions`).
5. **Density levers land per core-render-density-zoom.md**, entering through
   `RenderOptions` → attributes, per the layering rule.

✔ when: a bare `<mnx-score-viewer>` + document shows the author's intended view;
every host-controllable behavior is listed in `docs/core-viewer-surface.md`; no prop on the
element is workbench-private without being marked as such.
