# The viewer surface — naming and defining the component's public contract

> **Status: proposed (2026-08-07), not started.** Design direction agreed in conversation;
> nothing built. Subsumes the "where do the levers live" open question of
> [render-density-zoom.md](render-density-zoom.md) and the view-default design below.

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
- Density/zoom levers ([render-density-zoom.md](render-density-zoom.md)) have named
  engine knobs but no answer to "toolbar, embed attribute, `RenderOptions`, or all three?"
- Feature visibility (lyrics, harmonies, diagnostics badges, tempo marks) is not
  controllable anywhere; layouts always draw everything they support.

## The design

**Name:** *the viewer surface* — documented as `docs/viewer-surface.md` when built, with
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
([both-view-single-system.md](../inprogress/both-view-single-system.md)), `tab` → tab,
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
  workbench chrome; move the panel up into `ui/`, or explicitly document these as
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

1. **Write `docs/viewer-surface.md`** — the contract as it *should* be, marking each
   current prop keep/derive/evict. Cheap, and everything after cites it.
2. **`view="auto"`** + `hasTab` derivation + precedence documented in
   mnx-extensions.md's staffKind entry. (Smallest slice; fixes the read-only player.)
3. **Evict the exhibit panel** into `ui/` (or document the workbench tier).
4. **`hide` set**, starting with `badges` (emit-side, easy) and `lyrics` (layout-side,
   proves the reflow path through `RenderOptions`).
5. **Density levers land per render-density-zoom.md**, entering through
   `RenderOptions` → attributes, per the layering rule.

✔ when: a bare `<mnx-score-viewer>` + document shows the author's intended view;
every host-controllable behavior is listed in `docs/viewer-surface.md`; no prop on the
element is workbench-private without being marked as such.
